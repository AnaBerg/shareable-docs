import { describe, expect, it } from "vitest";
import { getDatabaseUrl, getMigrationDatabaseUrl } from "./env";

describe("database environment helpers", () => {
  it("returns DATABASE_URL for runtime database access", () => {
    expect(getDatabaseUrl({ DATABASE_URL: "postgres://runtime" })).toBe(
      "postgres://runtime",
    );
  });

  it("requires DATABASE_URL for runtime database access", () => {
    expect(() => getDatabaseUrl({})).toThrow(
      "DATABASE_URL is required for database connections.",
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
