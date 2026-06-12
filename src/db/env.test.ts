import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_DATABASE_URL = process.env.DATABASE_URL;

afterEach(() => {
  vi.resetModules();
  if (ORIGINAL_DATABASE_URL === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = ORIGINAL_DATABASE_URL;
  }
});

async function importEnv() {
  vi.resetModules();
  process.env.DATABASE_URL = "postgres://schema";
  return await import("./env");
}

describe("database environment helpers", () => {
  it("returns DATABASE_URL for runtime database access", async () => {
    const { getDatabaseUrl } = await importEnv();

    expect(getDatabaseUrl({ DATABASE_URL: "postgres://runtime" })).toBe(
      "postgres://runtime",
    );
  });

  it("requires DATABASE_URL for runtime database access", async () => {
    const { getDatabaseUrl } = await importEnv();

    expect(() => getDatabaseUrl({})).toThrow(
      "DATABASE_URL is required for database connections.",
    );
  });

  it("requires DATABASE_URL in the T3 environment schema", async () => {
    delete process.env.DATABASE_URL;

    await expect(import("./env")).rejects.toThrow(
      "Invalid environment variables",
    );
  });

  it("requires DATABASE_URL to be a valid URL in the T3 environment schema", async () => {
    process.env.DATABASE_URL = "not-a-url";

    await expect(import("./env")).rejects.toThrow(
      "Invalid environment variables",
    );
  });

  it("prefers unpooled migration url when present", async () => {
    const { getMigrationDatabaseUrl } = await importEnv();

    expect(
      getMigrationDatabaseUrl({
        DATABASE_URL: "postgres://pooled",
        DATABASE_URL_UNPOOLED: "postgres://unpooled",
      }),
    ).toBe("postgres://unpooled");
  });

  it("falls back to runtime postgres url for migrations", async () => {
    const { getMigrationDatabaseUrl } = await importEnv();

    expect(
      getMigrationDatabaseUrl({ DATABASE_URL: "postgres://pooled" }),
    ).toBe("postgres://pooled");
  });

  it("requires a postgres url for migrations", async () => {
    const { getMigrationDatabaseUrl } = await importEnv();

    expect(() => getMigrationDatabaseUrl({})).toThrow(
      "DATABASE_URL or DATABASE_URL_UNPOOLED is required for Postgres migrations.",
    );
  });
});
