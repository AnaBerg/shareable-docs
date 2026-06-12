export type DatabaseKind = "postgres" | "sqlite";

type DatabaseEnv = {
  DATABASE_URL?: string;
  DATABASE_URL_UNPOOLED?: string;
  SQLITE_PATH?: string;
  VERCEL?: string;
  VERCEL_ENV?: string;
} & Record<string, string | undefined>;

export function isHostedRuntime(env: DatabaseEnv = process.env): boolean {
  return env.VERCEL === "1" || Boolean(env.VERCEL_ENV);
}

export function getDatabaseKind(env: DatabaseEnv = process.env): DatabaseKind {
  if (env.DATABASE_URL) {
    return "postgres";
  }

  if (isHostedRuntime(env)) {
    throw new Error("DATABASE_URL is required in hosted environments.");
  }

  return "sqlite";
}

export function getSqlitePath(env: DatabaseEnv = process.env): string {
  return env.SQLITE_PATH || "./data/local.db";
}

export function toLibsqlFileUrl(path: string): string {
  return path.startsWith("file:") ? path : `file:${path}`;
}

export function getMigrationDatabaseUrl(env: DatabaseEnv = process.env): string {
  const databaseUrl = env.DATABASE_URL_UNPOOLED || env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL or DATABASE_URL_UNPOOLED is required for Postgres migrations.",
    );
  }

  return databaseUrl;
}
