import { describe, expect, it, vi } from "vitest";

import { createUlid } from "./ulid";

describe("createUlid", () => {
  it("creates a 26-character Crockford base32 id", () => {
    vi.spyOn(crypto, "getRandomValues").mockImplementation((array) => {
      const bytes = array as Uint8Array;
      bytes.fill(1);
      return array;
    });

    const ulid = createUlid(0);
    expect(ulid).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(ulid.startsWith("0000000000")).toBe(true);
  });
});
