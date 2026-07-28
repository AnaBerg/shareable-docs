import { describe, expect, it, vi } from "vitest";

const ctx = { db: {}, user: { id: "user_1" }, userEmail: "ada@example.com" };
const service = vi.hoisted(() => ({
  createShareLink: vi.fn(),
  revokeShareLink: vi.fn(),
}));

vi.mock("@/server/services/docs/create-share-link", () => ({
  createShareLink: service.createShareLink,
}));
vi.mock("@/server/services/docs/revoke-share-link", () => ({
  revokeShareLink: service.revokeShareLink,
}));
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

const documentId = "01HZXJK8JHX7QY9N7K6X8Y2W0A";

describe("createShareLinkHandler", () => {
  it("returns the plaintext token and a viewer url built from the request origin", async () => {
    service.createShareLink.mockResolvedValue({
      document: { id: documentId },
      token: "token-abc",
    });

    const { createShareLinkHandler } = await import("./share-link");
    const response = await createShareLinkHandler(
      new Request(`https://app.test/api/docs/${documentId}/link`, { method: "POST" }),
      { params: Promise.resolve({ id: documentId }) },
    );

    expect(response.status).toBe(201);
    expect(service.createShareLink).toHaveBeenCalledWith(ctx, { id: documentId });
    await expect(response.json()).resolves.toEqual({
      id: documentId,
      url: `https://app.test/d/${documentId}?t=token-abc`,
      token: "token-abc",
    });
  });

});

describe("revokeShareLinkHandler", () => {
  it("revokes the link for the document", async () => {
    service.revokeShareLink.mockResolvedValue({
      document: { id: documentId },
      revoked: true,
    });

    const { revokeShareLinkHandler } = await import("./share-link");
    const response = await revokeShareLinkHandler(
      new Request(`https://app.test/api/docs/${documentId}/link`, { method: "DELETE" }),
      { params: Promise.resolve({ id: documentId }) },
    );

    expect(response.status).toBe(200);
    expect(service.revokeShareLink).toHaveBeenCalledWith(ctx, { id: documentId });
    await expect(response.json()).resolves.toEqual({
      id: documentId,
      revoked: true,
    });
  });
});
