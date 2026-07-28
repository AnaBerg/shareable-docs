import { afterEach, describe, expect, it, vi } from "vitest";

import { forbiddenError } from "./errors";
import { createRequestLog, describeError, getErrorType } from "./logs";

describe("API logs", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits one wide event carrying the context added during the request", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const log = createRequestLog({
      requestId: "req_1",
      method: "GET",
      path: "/api/docs",
    });

    log.add({ userId: "user_1" });
    log.add({ documentId: "doc_1", documentAccess: "owned" });
    log.emit({ status: 200, durationMs: 12 });

    expect(info).toHaveBeenCalledTimes(1);
    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "api.request",
        schemaVersion: 2,
        service: "shareable-docs",
        requestId: "req_1",
        method: "GET",
        path: "/api/docs",
        statusCode: 200,
        outcome: "success",
        durationMs: 12,
        userId: "user_1",
        documentId: "doc_1",
        documentAccess: "owned",
      }),
    );
  });

  it("keeps request fields authoritative over added context", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const log = createRequestLog({
      requestId: "req_1",
      method: "GET",
      path: "/api/docs",
    });

    log.add({ requestId: "spoofed", statusCode: 200 });
    log.emit({ status: 500, durationMs: 3 });

    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: "req_1",
        statusCode: 500,
        outcome: "server_error",
      }),
    );
  });

  it("separates client failures from server failures", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const emitWith = (status: number) => {
      createRequestLog({ requestId: "req_1", method: "GET", path: "/api/docs" }).emit({
        status,
        durationMs: 1,
      });
      return info.mock.calls.at(-1)?.[0] as { outcome: string };
    };

    expect(emitWith(200).outcome).toBe("success");
    expect(emitWith(403).outcome).toBe("client_error");
    expect(emitWith(500).outcome).toBe("server_error");
  });

  it("describes API errors with code, message and retriability", () => {
    expect(describeError(forbiddenError("Document access denied"))).toEqual({
      errorCode: "forbidden",
      errorType: "ApiError",
      errorMessage: "Document access denied",
      errorRetriable: false,
    });
  });

  it("describes unexpected errors without leaking their raw message", () => {
    expect(
      describeError(new TypeError("connect to postgres://user:secret@host failed")),
    ).toEqual({
      errorCode: "internal_error",
      errorType: "TypeError",
      errorMessage: "Unexpected error",
      errorRetriable: true,
    });
  });

  it("classifies thrown values for logs", () => {
    expect(getErrorType(new TypeError("bad"))).toBe("TypeError");
    expect(getErrorType("bad")).toBe("string");
  });
});
