import { getDatabaseKind } from "./env";
import { createPostgresDb } from "./postgres/client";
import { createSqliteDb } from "./sqlite/client";

type DbEnv = {
  DATABASE_URL?: string;
  SQLITE_PATH?: string;
} & Record<string, string | undefined>;

export function createDb(env: DbEnv = process.env) {
  if (getDatabaseKind(env) === "postgres") {
    return createPostgresDb(env);
  }

  return createSqliteDb(env);
}

export const db = createDb();
