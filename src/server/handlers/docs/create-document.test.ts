import { describe, expect, it, vi } from "vitest";

const ctx = { db: {}, user: { id: "user_1" }, userEmail: "ada@example.com" };
const service = vi.hoisted(() => ({ createDocument: vi.fn() }));

vi.mock("@/server/services/docs/create-document", () => service);
vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return {
    ...actual,
    withApiHandler:
      (handler: (input: { request: Request; ctx: typeof ctx }) => Promise<Response>) =>
      (request: Request) =>
        handler({ request, ctx }),
  };
});

describe("createDocumentHandler", () => {
  it("creates a document from normalized request input", async () => {
    const now = new Date("2026-06-12T00:00:00.000Z");
    service.createDocument.mockResolvedValue({
      document: {
        id: "01HZXJK8JHX7QY9N7K6X8Y2W0A",
        ownerUserId: "user_1",
        name: "Report",
        description: null,
        createdAt: now,
        updatedAt: now,
      },
      version: { versionNumber: 1 },
    });

    const { createDocumentHandler } = await import("./create-document");
    const response = await createDocumentHandler(
      jsonRequest({ name: " Report ", description: " ", html: "<h1>Report</h1>" }),
    );

    expect(response.status).toBe(201);
    expect(service.createDocument).toHaveBeenCalledWith(ctx, {
      name: "Report",
      description: null,
      html: "<h1>Report</h1>",
    });
  });
});

function jsonRequest(body: unknown) {
  return new Request("https://app.test/api/docs", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
