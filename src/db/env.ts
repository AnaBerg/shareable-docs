import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

type DatabaseEnv = {
  DATABASE_URL?: string;
  DATABASE_URL_UNPOOLED?: string;
} & Record<string, string | undefined>;

export const env = createEnv({
  server: {
    CLERK_SECRET_KEY: z.string().min(1).optional(),
    CLERK_WEBHOOK_SIGNING_SECRET: z.string().min(1).optional(),
    DATABASE_URL: z.string().url(),
    DATABASE_URL_UNPOOLED: z.string().url().optional(),
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
    VERCEL: process.env.VERCEL,
    VERCEL_ENV: process.env.VERCEL_ENV,
  },
  emptyStringAsUndefined: true,
});

export function getDatabaseUrl(runtimeEnv: DatabaseEnv = env): string {
  if (!runtimeEnv.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for database connections.");
  }

  return runtimeEnv.DATABASE_URL;
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
