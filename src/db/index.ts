export { createDb, db } from "./client";
export {
  getDatabaseKind,
  getMigrationDatabaseUrl,
  getSqlitePath,
  toLibsqlFileUrl,
} from "./env";
export { createPostgresDb } from "./postgres/client";
export * as postgresSchema from "./postgres/schema";
export { createSqliteDb } from "./sqlite/client";
export * as sqliteSchema from "./sqlite/schema";
