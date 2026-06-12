import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

type PostgresEnv = {
  DATABASE_URL?: string;
} & Record<string, string | undefined>;

export function createPostgresDb(env: PostgresEnv = process.env) {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for Postgres database connections.");
  }

  return drizzle(neon(env.DATABASE_URL), { schema });
}

export type PostgresDb = ReturnType<typeof createPostgresDb>;
