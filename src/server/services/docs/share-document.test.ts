import { describe, expect, it, vi } from "vitest";

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

  it("allows a shared user to share a document", async () => {
    const foundDocument = document({ ownerUserId: "owner" });
    repository.findDocumentById.mockResolvedValue(foundDocument);
    repository.isSharedWithEmail.mockResolvedValue(true);
    repository.upsertDocumentShares.mockResolvedValue([]);

    const { shareDocument } = await import("./share-document");
    const result = await shareDocument(
      apiContext("reader", "reader@example.com"),
      { id: foundDocument.id },
      { emails: ["reviewer@example.com"] },
    );

    expect(result.access).toBe("shared");
  });
});
