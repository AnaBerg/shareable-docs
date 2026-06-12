import { describe, expect, it } from "vitest";
import {
  env,
  getDatabaseKind,
  getMigrationDatabaseUrl,
  getSqlitePath,
  toLibsqlFileUrl,
} from "./env";

describe("database environment helpers", () => {
  it("exposes validated env defaults from T3 env", () => {
    expect(env.SQLITE_PATH).toBe("./data/local.db");
  });

  it("chooses postgres when DATABASE_URL exists", () => {
    expect(getDatabaseKind({ DATABASE_URL: "postgres://example" })).toBe(
      "postgres",
    );
  });

  it("chooses sqlite when DATABASE_URL is absent", () => {
    expect(getDatabaseKind({ SQLITE_PATH: "./data/local.db" })).toBe("sqlite");
  });

  it("throws in hosted environments when DATABASE_URL is absent", () => {
    expect(() => getDatabaseKind({ VERCEL: "1" })).toThrow(
      "DATABASE_URL is required in hosted environments.",
    );
    expect(() => getDatabaseKind({ VERCEL_ENV: "production" })).toThrow(
      "DATABASE_URL is required in hosted environments.",
    );
  });

  it("defaults sqlite path to ./data/local.db", () => {
    expect(getSqlitePath({})).toBe("./data/local.db");
  });

  it("converts sqlite paths to libsql file URLs", () => {
    expect(toLibsqlFileUrl("./data/local.db")).toBe("file:./data/local.db");
    expect(toLibsqlFileUrl("file:./data/local.db")).toBe(
      "file:./data/local.db",
    );
  });

  it("prefers unpooled migration url when present", () => {
    expect(
      getMigrationDatabaseUrl({
        DATABASE_URL: "postgres://pooled",
        DATABASE_URL_UNPOOLED: "postgres://unpooled",
      }),
    ).toBe("postgres://unpooled");
  });

  it("falls back to runtime postgres url for migrations", () => {
    expect(
      getMigrationDatabaseUrl({ DATABASE_URL: "postgres://pooled" }),
    ).toBe("postgres://pooled");
  });

  it("requires a postgres url for migrations", () => {
    expect(() => getMigrationDatabaseUrl({})).toThrow(
      "DATABASE_URL or DATABASE_URL_UNPOOLED is required for Postgres migrations.",
    );
  });
});
