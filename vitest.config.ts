import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => {
  const loadedEnv = loadEnv(mode, process.cwd(), "");

  return {
    test: {
      environment: "node",
      env: {
        ...loadedEnv,
        NODE_ENV: "test",
        DATABASE_URL:
          loadedEnv.DATABASE_URL ?? "postgres://localhost:5432/test",
      },
      include: ["src/**/*.test.ts"],
      passWithNoTests: true,
    },
    resolve: {
      alias: {
        "@": new URL("./src", import.meta.url).pathname,
      },
    },
  };
});
