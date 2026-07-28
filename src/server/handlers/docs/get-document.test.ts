import { describe, expect, it, vi } from "vitest";

const ctx = { db: {}, user: { id: "user_1" }, userEmail: "ada@example.com" };
const service = vi.hoisted(() => ({ getDocument: vi.fn() }));

vi.mock("@/server/services/docs/get-document", () => service);
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

describe("getDocumentHandler", () => {
  it("passes route params and query to the service", async () => {
    const now = new Date("2026-06-12T00:00:00.000Z");
    service.getDocument.mockResolvedValue({
      document: {
        id: "01HZXJK8JHX7QY9N7K6X8Y2W0A",
        ownerUserId: "user_1",
        name: "Report",
        description: null,
        createdAt: now,
        updatedAt: now,
      },
      version: { versionNumber: 1, html: "<p>v1</p>", createdAt: now },
      latestVersion: { versionNumber: 2 },
    });

    const { getDocumentHandler } = await import("./get-document");
    const response = await getDocumentHandler(
      new Request("https://app.test/api/docs/01HZXJK8JHX7QY9N7K6X8Y2W0A?version=1"),
      { params: Promise.resolve({ id: "01HZXJK8JHX7QY9N7K6X8Y2W0A" }) },
    );

    expect(response.status).toBe(200);
    expect(service.getDocument).toHaveBeenCalledWith(
      ctx,
      { id: "01HZXJK8JHX7QY9N7K6X8Y2W0A" },
      { version: 1 },
    );
  });
});
