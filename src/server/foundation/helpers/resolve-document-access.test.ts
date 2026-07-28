import { beforeEach, describe, expect, it, vi } from "vitest";

import { hashShareToken } from "@/server/foundation/helpers/share-token";
import { document } from "@/server/services/docs/test-helpers";
import type { DocumentsDatabase } from "@/types/docs-repository";

const repository = vi.hoisted(() => ({
  findDocumentByShareToken: vi.fn(),
  isSharedWithEmail: vi.fn(),
}));

vi.mock("@/server/repositories/docs/find-document-by-share-token", () => ({
  findDocumentByShareToken: repository.findDocumentByShareToken,
}));
vi.mock("@/server/repositories/docs/is-shared-with-email", () => ({
  isSharedWithEmail: repository.isSharedWithEmail,
}));

const db = {} as DocumentsDatabase;

function userViewer(userId: string, email?: string | null) {
  return {
    db,
    viewer: {
      kind: "user" as const,
      userId,
      email: email === undefined ? `${userId}@example.com` : email,
    },
  };
}

function linkViewer(token: string) {
  return { db, viewer: { kind: "link" as const, token } };
}

describe("resolveDocumentAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves owner access without checking shares", async () => {
    const { resolveDocumentAccess } = await import("./resolve-document-access");

    await expect(resolveDocumentAccess(userViewer("owner"), document())).resolves.toBe("owned");
    expect(repository.isSharedWithEmail).not.toHaveBeenCalled();
  });

  it("resolves shared access by normalized viewer email", async () => {
    repository.isSharedWithEmail.mockResolvedValue(true);
    const { resolveDocumentAccess } = await import("./resolve-document-access");

    await expect(
      resolveDocumentAccess(
        userViewer("reader", "reader@example.com"),
        document({ ownerUserId: "owner" }),
      ),
    ).resolves.toBe("shared");
  });

  it("returns null when the user is neither owner nor shared", async () => {
    repository.isSharedWithEmail.mockResolvedValue(false);
    const { resolveDocumentAccess } = await import("./resolve-document-access");

    await expect(
      resolveDocumentAccess(
        userViewer("reader", "reader@example.com"),
        document({ ownerUserId: "owner" }),
      ),
    ).resolves.toBeNull();
  });

  it("grants link access when the token matches an active link", async () => {
    const foundDocument = document();
    repository.findDocumentByShareToken.mockResolvedValue(foundDocument);
    const { resolveDocumentAccess } = await import("./resolve-document-access");

    await expect(resolveDocumentAccess(linkViewer("secret-token"), foundDocument)).resolves.toBe(
      "link",
    );
    expect(repository.findDocumentByShareToken).toHaveBeenCalledWith(
      db,
      hashShareToken("secret-token"),
    );
    expect(repository.isSharedWithEmail).not.toHaveBeenCalled();
  });

  it("denies a token whose link points at another document", async () => {
    repository.findDocumentByShareToken.mockResolvedValue(document({ id: "other-document" }));
    const { resolveDocumentAccess } = await import("./resolve-document-access");

    await expect(
      resolveDocumentAccess(linkViewer("secret-token"), document()),
    ).resolves.toBeNull();
  });

  it("denies a revoked or unknown token", async () => {
    repository.findDocumentByShareToken.mockResolvedValue(null);
    const { resolveDocumentAccess } = await import("./resolve-document-access");

    await expect(
      resolveDocumentAccess(linkViewer("revoked-token"), document()),
    ).resolves.toBeNull();
  });
});
