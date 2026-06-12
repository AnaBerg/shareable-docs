import { defineConfig } from "drizzle-kit";

import { getMigrationDatabaseUrl } from "./src/db/env";

const databaseUrl = getMigrationDatabaseUrl(process.env);

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: databaseUrl,
  },
});
