import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import { getSqlitePath, toLibsqlFileUrl } from "../env";
import * as schema from "./schema";

type SqliteEnv = {
  SQLITE_PATH?: string;
} & Record<string, string | undefined>;

export function createSqliteDb(env: SqliteEnv = process.env) {
  const client = createClient({
    url: toLibsqlFileUrl(getSqlitePath(env)),
  });

  return drizzle(client, { schema });
}

export type SqliteDb = ReturnType<typeof createSqliteDb>;
