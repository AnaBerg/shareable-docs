import { describe, expect, it } from "vitest";

import { parseJsonBody } from "./parse-json-body";

describe("parseJsonBody", () => {
  it("parses JSON and maps malformed bodies to validation errors", async () => {
    await expect(
      parseJsonBody(new Request("https://app.test", { method: "POST", body: "{\"ok\":true}" })),
    ).resolves.toEqual({ ok: true });

    await expect(
      parseJsonBody(new Request("https://app.test", { method: "POST", body: "{" })),
    ).rejects.toMatchObject({ status: 422, code: "validation_error" });
  });
});
