import { describe, expect, it, vi } from "vitest";

const ctx = { db: {}, user: { id: "user_1" }, userEmail: "ada@example.com" };
const service = vi.hoisted(() => ({ listDocuments: vi.fn() }));

vi.mock("@/server/services/docs/list-documents", () => service);
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

describe("listDocumentsHandler", () => {
  it("lists documents with the access filter", async () => {
    const now = new Date("2026-06-12T00:00:00.000Z");
    service.listDocuments.mockResolvedValue({
      documents: [
        {
          id: "01HZXJK8JHX7QY9N7K6X8Y2W0A",
          ownerUserId: "user_1",
          name: "Report",
          description: null,
          access: "owned",
          latestVersion: { versionNumber: 1 },
          createdAt: now,
          updatedAt: now,
        },
      ],
    });

    const { listDocumentsHandler } = await import("./list-documents");
    const response = await listDocumentsHandler(
      new Request("https://app.test/api/docs?access=owned"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      documents: [
        {
          id: "01HZXJK8JHX7QY9N7K6X8Y2W0A",
          ownerUserId: "user_1",
          name: "Report",
          description: null,
          access: "owned",
          latestVersion: 1,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
      ],
    });
    expect(service.listDocuments).toHaveBeenCalledWith(ctx, { access: "owned" });
  });
});
