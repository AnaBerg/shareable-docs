import { describe, expect, it, vi } from "vitest";

const ctx = { db: {}, user: { id: "user_1" }, userEmail: "ada@example.com" };
const service = vi.hoisted(() => ({ updateDocument: vi.fn() }));

vi.mock("@/server/services/docs/update-document", () => service);
vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return {
    ...actual,
    withApiHandler:
      (
        handler: (input: {
          request: Request;
          ctx: typeof ctx;
          params: { id: string };
        }) => Promise<Response>,
      ) =>
      async (request: Request, routeContext: { params: Promise<{ id: string }> }) =>
        handler({ request, ctx, params: await routeContext.params }),
  };
});

describe("updateDocumentHandler", () => {
  it("creates a new document version", async () => {
    const updatedAt = new Date("2026-06-12T00:00:00.000Z");
    service.updateDocument.mockResolvedValue({
      document: { id: "01HZXJK8JHX7QY9N7K6X8Y2W0A", updatedAt },
      version: { versionNumber: 2 },
    });

    const { updateDocumentHandler } = await import("./update-document");
    const response = await updateDocumentHandler(
      jsonRequest({ html: "<p>v2</p>" }),
      { params: Promise.resolve({ id: "01HZXJK8JHX7QY9N7K6X8Y2W0A" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      id: "01HZXJK8JHX7QY9N7K6X8Y2W0A",
      version: 2,
      latestVersion: 2,
      updatedAt: updatedAt.toISOString(),
    });
    expect(service.updateDocument).toHaveBeenCalledWith(
      ctx,
      { id: "01HZXJK8JHX7QY9N7K6X8Y2W0A" },
      { html: "<p>v2</p>" },
    );
  });
});

function jsonRequest(body: unknown) {
  return new Request("https://app.test/api/docs/01HZXJK8JHX7QY9N7K6X8Y2W0A", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}
