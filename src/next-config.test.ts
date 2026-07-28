import { describe, expect, it } from "vitest";

import nextConfig from "../next.config";

// Security invariant: no page of this app may be embedded in a cross-origin
// frame. Without this, an attacker can overlay the one-click "Create share
// link" button in /app inside an invisible iframe and clickjack a signed-in
// owner into rotating (and thereby revoking) a document's live share link.
// The viewer's own srcdoc iframe is unaffected: srcdoc content is not fetched
// over HTTP, so response headers never apply to it.
describe("framing protection headers", () => {
  it("denies framing on every route", async () => {
    const rules = await nextConfig.headers?.();

    expect(rules).toBeDefined();

    const catchAll = rules?.find((rule) => rule.source === "/(.*)");
    expect(catchAll).toBeDefined();

    const headers = new Map(catchAll?.headers.map(({ key, value }) => [key, value]));
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("Content-Security-Policy")).toBe("frame-ancestors 'none'");
  });
});
