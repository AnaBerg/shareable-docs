import { describe, expect, it, vi } from "vitest";

import { getRequestId } from "./request-id";

describe("getRequestId", () => {
  it("prefers request id headers before generating a new id", () => {
    expect(
      getRequestId(new Request("https://app.test", { headers: { "x-request-id": "req_1" } })),
    ).toBe("req_1");

    vi.spyOn(crypto, "randomUUID").mockReturnValue("generated");
    expect(getRequestId(new Request("https://app.test"))).toBe("generated");
  });
});
