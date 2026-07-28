import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiContext, document } from "./test-helpers";

const repository = vi.hoisted(() => ({
  findDocumentById: vi.fn(),
  isSharedWithEmail: vi.fn(),
  revokeShareLink: vi.fn(),
}));

vi.mock("@/server/repositories/docs/find-document-by-id", () => ({
  findDocumentById: repository.findDocumentById,
}));
vi.mock("@/server/repositories/docs/is-shared-with-email", () => ({
  isSharedWithEmail: repository.isSharedWithEmail,
}));
vi.mock("@/server/repositories/docs/revoke-share-link", () => ({
  revokeShareLink: repository.revokeShareLink,
}));

describe("revokeShareLink", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows the owner to revoke the active link", async () => {
    const foundDocument = document();
    repository.revokeShareLink.mockResolvedValue({
      id: "01HZXJK8JHX7QY9N7K6X8Y2W0C",
      revokedAt: new Date(),
    });
    repository.findDocumentById.mockResolvedValue(foundDocument);

    const { revokeShareLink } = await import("./revoke-share-link");
    const result = await revokeShareLink(apiContext("owner"), {
      id: foundDocument.id,
    });

    expect(repository.revokeShareLink).toHaveBeenCalledWith(
      expect.anything(),
      foundDocument.id,
    );
    expect(result.revoked).toBe(true);
  });

  it("reports revoked=false when there is no active link", async () => {
    const foundDocument = document();
    repository.findDocumentById.mockResolvedValue(foundDocument);
    repository.revokeShareLink.mockResolvedValue(null);

    const { revokeShareLink } = await import("./revoke-share-link");
    const result = await revokeShareLink(apiContext("owner"), {
      id: foundDocument.id,
    });

    expect(result.revoked).toBe(false);
  });

  it("rejects a shared-email user", async () => {
    const foundDocument = document({ ownerUserId: "owner" });
    repository.findDocumentById.mockResolvedValue(foundDocument);
    repository.isSharedWithEmail.mockResolvedValue(true);

    const { revokeShareLink } = await import("./revoke-share-link");
    await expect(
      revokeShareLink(apiContext("reader", "reader@example.com"), {
        id: foundDocument.id,
      }),
    ).rejects.toMatchObject({ status: 403, code: "forbidden" });
    expect(repository.revokeShareLink).not.toHaveBeenCalled();
  });

  it("throws not found for a missing document", async () => {
    repository.findDocumentById.mockResolvedValue(null);

    const { revokeShareLink } = await import("./revoke-share-link");
    await expect(
      revokeShareLink(apiContext("owner"), { id: "01HZXJK8JHX7QY9N7K6X8Y2W0A" }),
    ).rejects.toMatchObject({ status: 404, code: "not_found" });
    expect(repository.revokeShareLink).not.toHaveBeenCalled();
  });
});
