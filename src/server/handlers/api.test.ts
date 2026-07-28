import { describe, expect, it, vi } from "vitest";

import { forbiddenError } from "@/server/foundation/errors";

vi.mock("@/server/foundation/context", () => ({
  createApiContext: vi.fn().mockResolvedValue({
    ok: true,
    ctx: {
      db: {},
      user: { id: "user_1" },
      userEmail: "ada@example.com",
      requestId: "req_test",
      log: { add: vi.fn(), emit: vi.fn() },
    },
  }),
}));

vi.mock("@/server/foundation/logs", () => ({
  createRequestLog: vi.fn(() => ({ add: vi.fn(), emit: vi.fn() })),
}));

describe("API handler foundation", () => {
  it("converts API errors into a JSON error response", async () => {
    const { withApiHandler } = await import("./api");
    const handler = withApiHandler(async () => {
      throw forbiddenError("Forbidden");
    });

    const response = await handler(new Request("https://app.test/api/docs"));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: { code: "forbidden", message: "Forbidden" },
    });
  });

  it("converts unexpected errors into generic 500 JSON", async () => {
    const { withApiHandler } = await import("./api");
    const handler = withApiHandler(async () => {
      throw new Error("database password leaked");
    });

    const response = await handler(new Request("https://app.test/api/docs"));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: { code: "internal_error", message: "Internal server error" },
    });
  });

});
