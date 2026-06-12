import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { forbiddenError } from "@/server/foundation/errors";

vi.mock("@/server/foundation/context", () => ({
  createApiContext: vi.fn().mockResolvedValue({
    ok: true,
    ctx: {
      db: {},
      user: { id: "user_1" },
      userEmail: "ada@example.com",
      requestId: "req_test",
    },
  }),
}));

vi.mock("@/server/foundation/logs", () => ({
  getErrorType: vi.fn(() => "Error"),
  logApiRequest: vi.fn(),
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

  it("returns validation_error for malformed JSON", async () => {
    const { parseJsonBody } = await import("./api");

    await expect(
      parseJsonBody(
        new Request("https://app.test/api/docs", {
          method: "POST",
          body: "{",
        }),
      ),
    ).rejects.toMatchObject({ status: 400, code: "validation_error" });
  });

  it("formats Zod validation failures without echoing submitted HTML", async () => {
    const { parseWithSchema } = await import("./api");
    const schema = z.object({ name: z.string().min(1) });

    try {
      parseWithSchema(schema, { name: "", html: "<script>alert(1)</script>" });
      throw new Error("expected parseWithSchema to throw");
    } catch (error) {
      expect(error).toMatchObject({ status: 400, code: "validation_error" });
      expect(JSON.stringify(error)).not.toContain("<script>");
    }
  });
});
