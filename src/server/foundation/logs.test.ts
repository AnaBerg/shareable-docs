import { afterEach, describe, expect, it, vi } from "vitest";

import { getErrorType, logApiRequest } from "./logs";

describe("API logs", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits one structured event for an API request", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    logApiRequest({
      requestId: "req_1",
      method: "GET",
      pathname: "/api/docs",
      status: 200,
      outcome: "success",
      durationMs: 12,
      userId: "user_1",
    });

    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "api_request",
        service: "shareable-docs",
        requestId: "req_1",
        userId: "user_1",
      }),
    );
  });

  it("classifies thrown values for logs", () => {
    expect(getErrorType(new TypeError("bad"))).toBe("TypeError");
    expect(getErrorType("bad")).toBe("string");
  });
});
