import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiContext, document } from "./test-helpers";

const repository = vi.hoisted(() => ({
  findDocumentById: vi.fn(),
  isSharedWithEmail: vi.fn(),
  upsertDocumentShares: vi.fn(),
}));

vi.mock("@/server/repositories/docs/find-document-by-id", () => ({
  findDocumentById: repository.findDocumentById,
}));
vi.mock("@/server/repositories/docs/is-shared-with-email", () => ({
  isSharedWithEmail: repository.isSharedWithEmail,
}));
vi.mock("@/server/repositories/docs/upsert-shares", () => ({
  upsertDocumentShares: repository.upsertDocumentShares,
}));

describe("shareDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows the owner to share a document", async () => {
    const foundDocument = document();
    repository.findDocumentById.mockResolvedValue(foundDocument);
    repository.upsertDocumentShares.mockResolvedValue([
      { sharedWithEmail: "reader@example.com" },
    ]);

    const { shareDocument } = await import("./share-document");
    const result = await shareDocument(
      apiContext("owner"),
      { id: foundDocument.id },
      { emails: ["reader@example.com"] },
    );

    expect(repository.upsertDocumentShares).toHaveBeenCalledWith(expect.anything(), {
      documentId: foundDocument.id,
      emails: ["reader@example.com"],
      sharedByUserId: "owner",
    });
    expect(result.access).toBe("owned");
  });

  it("does not allow a shared user to share a document", async () => {
    const foundDocument = document({ ownerUserId: "owner" });
    repository.findDocumentById.mockResolvedValue(foundDocument);
    repository.isSharedWithEmail.mockResolvedValue(true);
    repository.upsertDocumentShares.mockResolvedValue([]);

    const { shareDocument } = await import("./share-document");
    await expect(
      shareDocument(
        apiContext("reader", "reader@example.com"),
        { id: foundDocument.id },
        { emails: ["reviewer@example.com"] },
      ),
    ).rejects.toMatchObject({ status: 403, code: "forbidden" });
    expect(repository.upsertDocumentShares).not.toHaveBeenCalled();
  });

  it("treats link access as insufficient to share", async () => {
    vi.resetModules();
    vi.doMock("@/server/foundation/helpers/resolve-document-access", () => ({
      resolveDocumentAccess: vi.fn().mockResolvedValue("link"),
    }));
    repository.findDocumentById.mockResolvedValue(document());

    try {
      const { shareDocument } = await import("./share-document");
      await expect(
        shareDocument(
          apiContext("owner"),
          { id: "01HZXJK8JHX7QY9N7K6X8Y2W0A" },
          { emails: ["reader@example.com"] },
        ),
      ).rejects.toMatchObject({ status: 403, code: "forbidden" });
      expect(repository.upsertDocumentShares).not.toHaveBeenCalled();
    } finally {
      // Without finally, a failing assertion above would leave the module
      // mocked and leak into every test that runs after it.
      vi.doUnmock("@/server/foundation/helpers/resolve-document-access");
      vi.resetModules();
    }
  });
});
