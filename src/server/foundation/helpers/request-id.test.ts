import { describe, expect, it, vi } from "vitest";

import { getRequestId } from "./request-id";

describe("getRequestId", () => {
  it("prefers x-request-id, then x-vercel-id, then generated id", () => {
    expect(
      getRequestId(new Request("https://app.test", { headers: { "x-request-id": "req_1" } })),
    ).toBe("req_1");

    expect(
      getRequestId(new Request("https://app.test", { headers: { "x-vercel-id": "vercel_1" } })),
    ).toBe("vercel_1");

    const randomUuidSpy = vi.spyOn(crypto, "randomUUID").mockReturnValue("generated");
    expect(getRequestId(new Request("https://app.test"))).toBe("generated");
    expect(randomUuidSpy).toHaveBeenCalledTimes(1);
  });
});
