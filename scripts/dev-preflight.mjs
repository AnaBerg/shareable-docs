import { spawn, spawnSync } from "node:child_process";

const POLL_INTERVAL_MS = 1_000;
const POSTGRES_TIMEOUT_MS = 60_000;

function fail(message, details) {
  console.error(`\n[dev-preflight] ${message}`);
  if (details) {
    console.error(details.trim());
  }
  process.exit(1);
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: options.stdio ?? "pipe",
  });
}

function runChecked(command, args, message) {
  const result = run(command, args);
  if (result.error) {
    fail(message, result.error.message);
  }
  if (result.status !== 0) {
    fail(message, result.stderr || result.stdout);
  }
  return result.stdout;
}

function commandExists(command) {
  const result = run(command, ["--version"]);
  return !result.error && result.status === 0;
}

function parseComposePsJson(output) {
  const trimmed = output.trim();
  if (!trimmed) {
    return [];
  }

  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return trimmed
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  }
}

function postgresHasHealthcheck() {
  const result = run("docker", ["compose", "config", "--format", "json"]);
  if (result.status !== 0 || result.error) {
    return false;
  }

  try {
    const config = JSON.parse(result.stdout);
    return Boolean(config.services?.postgres?.healthcheck);
  } catch {
    return false;
  }
}

function getPostgresStatus() {
  const output = runChecked(
    "docker",
    ["compose", "ps", "postgres", "--format", "json"],
    "Could not inspect the Postgres container with Docker Compose. Check the postgres service in docker-compose.yml.",
  );
  const containers = parseComposePsJson(output);
  return containers.find((container) => container.Service === "postgres") ?? containers[0];
}

function isPostgresReady(container, requiresHealthy) {
  if (!container) {
    return false;
  }

  const state = String(container.State ?? "").toLowerCase();
  const health = String(container.Health ?? "").toLowerCase();

  if (state !== "running") {
    return false;
  }

  return !requiresHealthy || health === "healthy";
}

async function waitForPostgres() {
  const requiresHealthy = postgresHasHealthcheck();
  const startedAt = Date.now();
  let lastContainer;

  while (Date.now() - startedAt < POSTGRES_TIMEOUT_MS) {
    lastContainer = getPostgresStatus();
    if (isPostgresReady(lastContainer, requiresHealthy)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  const state = lastContainer?.State ?? "unknown";
  const health = lastContainer?.Health ? `, health=${lastContainer.Health}` : "";
  fail(
    `Postgres container did not become ready in ${POSTGRES_TIMEOUT_MS / 1_000}s. Check the postgres service with Docker Compose.`,
    `Last observed status: state=${state}${health}`,
  );
}

async function preflight() {
  if (!commandExists("docker")) {
    fail("Docker is not installed or is not on PATH. Install/start Docker before running the dev server.");
  }

  runChecked(
    "docker",
    ["compose", "version"],
    "Docker Compose is not available. Install Docker Compose before running the dev server.",
  );

  runChecked(
    "docker",
    ["info"],
    "Docker daemon is not accessible. Start Docker Desktop or your Docker daemon before running the dev server.",
  );

  const services = runChecked(
    "docker",
    ["compose", "config", "--services"],
    "Docker Compose config could not be read. Check docker-compose.yml before running the dev server.",
  )
    .split("\n")
    .map((service) => service.trim())
    .filter(Boolean);

  if (!services.includes("postgres")) {
    fail("Docker Compose config does not contain a postgres service. Check docker-compose.yml before running the dev server.");
  }

  runChecked(
    "docker",
    ["compose", "up", "-d", "postgres"],
    "Docker Compose could not start the Postgres container. Check the postgres service and Docker logs.",
  );

  await waitForPostgres();
}

async function main() {
  const separatorIndex = process.argv.indexOf("--");
  const command = separatorIndex === -1 ? [] : process.argv.slice(separatorIndex + 1);

  await preflight();

  if (command.length === 0) {
    return;
  }

  const child = spawn(command[0], command.slice(1), {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });

  child.on("error", (error) => {
    fail(`Could not start ${command.join(" ")} after Docker/Compose preflight.`, error.message);
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
    } else {
      process.exit(code ?? 0);
    }
  });
}

main().catch((error) => {
  fail("Unexpected Docker/Compose preflight error.", error?.stack ?? String(error));
});
