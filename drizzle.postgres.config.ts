import { defineConfig } from "drizzle-kit";

import { getMigrationDatabaseUrl } from "./src/db/env";

const databaseUrl = getMigrationDatabaseUrl(process.env);

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/postgres/schema.ts",
  out: "./drizzle/postgres",
  dbCredentials: {
    url: databaseUrl,
  },
});
