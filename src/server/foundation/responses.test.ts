import { describe, expect, it } from "vitest";

import { forbiddenError } from "./errors";
import { apiErrorResponse, jsonResponse } from "./responses";

describe("response helpers", () => {
  it("creates JSON responses", async () => {
    const response = jsonResponse({ ok: true }, { status: 201 });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("serializes API errors without leaking extra fields", async () => {
    const response = apiErrorResponse(forbiddenError("Denied"));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: { code: "forbidden", message: "Denied" },
    });
  });
});
