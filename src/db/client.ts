import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { getDatabaseUrl } from "./env";
import * as schema from "./schema";

export function createDb(databaseUrl = getDatabaseUrl()) {
  return drizzle(postgres(databaseUrl), { schema });
}

type Db = ReturnType<typeof createDb>;

let dbInstance: Db | undefined;

function getDb(): Db {
  dbInstance ??= createDb();
  return dbInstance;
}

export const db = new Proxy({} as Db, {
  get(_target, property, receiver) {
    return Reflect.get(getDb(), property, receiver);
  },
});
