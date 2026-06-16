import { describe, expect, it } from "vitest";

import { readErrorCode } from "./error-code";

describe("readErrorCode", () => {
  it("reads error code from JSON responses and ignores invalid bodies", async () => {
    await expect(
      readErrorCode(Response.json({ error: { code: "forbidden" } })),
    ).resolves.toBe("forbidden");

    await expect(readErrorCode(new Response("not json"))).resolves.toBeUndefined();
  });
});
