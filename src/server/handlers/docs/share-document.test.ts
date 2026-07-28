import { describe, expect, it, vi } from "vitest";

const ctx = { db: {}, user: { id: "user_1" }, userEmail: "ada@example.com" };
const service = vi.hoisted(() => ({ shareDocument: vi.fn() }));

vi.mock("@/server/services/docs/share-document", () => service);
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

describe("shareDocumentHandler", () => {
  it("normalizes and dedupes share emails", async () => {
    service.shareDocument.mockResolvedValue({
      document: { id: "01HZXJK8JHX7QY9N7K6X8Y2W0A" },
      shares: [],
    });

    const { shareDocumentHandler } = await import("./share-document");
    const response = await shareDocumentHandler(
      jsonRequest({ emails: [" Reader@Example.com ", "reader@example.com"] }),
      { params: Promise.resolve({ id: "01HZXJK8JHX7QY9N7K6X8Y2W0A" }) },
    );

    expect(response.status).toBe(200);
    expect(service.shareDocument).toHaveBeenCalledWith(
      ctx,
      { id: "01HZXJK8JHX7QY9N7K6X8Y2W0A" },
      { emails: ["reader@example.com"] },
    );
  });
});

function jsonRequest(body: unknown) {
  return new Request("https://app.test/api/docs/share/01HZXJK8JHX7QY9N7K6X8Y2W0A", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
