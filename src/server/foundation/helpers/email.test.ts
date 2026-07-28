import { describe, expect, it } from "vitest";

import { normalizeEmail } from "./email";

describe("normalizeEmail", () => {
  it("normalizes emails and treats blanks as null", () => {
    expect(normalizeEmail(" Ada@Example.com ")).toBe("ada@example.com");
    expect(normalizeEmail(" ")).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
  });
});
