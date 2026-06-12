import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export type DatabaseKind = "postgres" | "sqlite";

type DatabaseEnv = {
  DATABASE_URL?: string;
  DATABASE_URL_UNPOOLED?: string;
  SQLITE_PATH?: string;
  VERCEL?: string;
  VERCEL_ENV?: string;
} & Record<string, string | undefined>;

export const env = createEnv({
  server: {
    CLERK_SECRET_KEY: z.string().min(1).optional(),
    CLERK_WEBHOOK_SIGNING_SECRET: z.string().min(1).optional(),
    DATABASE_URL: z.string().url().optional(),
    DATABASE_URL_UNPOOLED: z.string().url().optional(),
    SQLITE_PATH: z.string().min(1).default("./data/local.db"),
    VERCEL: z.string().optional(),
    VERCEL_ENV: z.string().optional(),
  },
  client: {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1).optional(),
  },
  runtimeEnv: {
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    CLERK_WEBHOOK_SIGNING_SECRET: process.env.CLERK_WEBHOOK_SIGNING_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_URL_UNPOOLED: process.env.DATABASE_URL_UNPOOLED,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    SQLITE_PATH: process.env.SQLITE_PATH,
    VERCEL: process.env.VERCEL,
    VERCEL_ENV: process.env.VERCEL_ENV,
  },
  emptyStringAsUndefined: true,
});

export function isHostedRuntime(runtimeEnv: DatabaseEnv = env): boolean {
  return runtimeEnv.VERCEL === "1" || Boolean(runtimeEnv.VERCEL_ENV);
}

export function getDatabaseKind(runtimeEnv: DatabaseEnv = env): DatabaseKind {
  if (runtimeEnv.DATABASE_URL) {
    return "postgres";
  }

  if (isHostedRuntime(runtimeEnv)) {
    throw new Error("DATABASE_URL is required in hosted environments.");
  }

  return "sqlite";
}

export function getSqlitePath(runtimeEnv: DatabaseEnv = env): string {
  return runtimeEnv.SQLITE_PATH || "./data/local.db";
}

export function toLibsqlFileUrl(path: string): string {
  return path.startsWith("file:") ? path : `file:${path}`;
}

export function getMigrationDatabaseUrl(runtimeEnv: DatabaseEnv = env): string {
  const databaseUrl =
    runtimeEnv.DATABASE_URL_UNPOOLED || runtimeEnv.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL or DATABASE_URL_UNPOOLED is required for Postgres migrations.",
    );
  }

  return databaseUrl;
}
