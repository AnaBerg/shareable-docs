import { describe, expect, it } from "vitest";

import { isUniqueViolation } from "./db-errors";

describe("isUniqueViolation", () => {
  it("detects Postgres unique violation errors", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
    expect(isUniqueViolation({ code: "23503" })).toBe(false);
    expect(isUniqueViolation(new Error("duplicate"))).toBe(false);
  });
});
