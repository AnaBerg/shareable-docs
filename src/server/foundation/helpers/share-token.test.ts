import { describe, expect, it } from "vitest";

import { createShareToken, hashShareToken } from "./share-token";

describe("share token", () => {
  it("generates a url-safe token and a stable hash", () => {
    const { token, tokenHash } = createShareToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hashShareToken(token)).toBe(tokenHash);
  });

  it("generates a distinct token on every call", () => {
    expect(createShareToken().token).not.toBe(createShareToken().token);
  });

  it("does not leak the token through the hash", () => {
    const { token, tokenHash } = createShareToken();

    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(tokenHash).not.toContain(token);
  });
});
