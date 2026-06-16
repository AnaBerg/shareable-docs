import { describe, expect, it } from "vitest";

import { apiErrorResponse, jsonResponse } from "./response";

describe("handler response exports", () => {
  it("re-exports foundation response helpers", async () => {
    await expect(jsonResponse({ ok: true }).json()).resolves.toEqual({ ok: true });
    expect(
      apiErrorResponse({
        kind: "api_error",
        status: 404,
        code: "not_found",
        message: "Missing",
      }).status,
    ).toBe(404);
  });
});
