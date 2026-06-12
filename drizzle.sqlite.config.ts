import { defineConfig } from "drizzle-kit";

import { getSqlitePath } from "./src/db/env";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/sqlite/schema.ts",
  out: "./drizzle/sqlite",
  dbCredentials: {
    url: getSqlitePath(process.env),
  },
});
