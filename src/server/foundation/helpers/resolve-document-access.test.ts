import { describe, expect, it, vi } from "vitest";

import { apiContext, document } from "@/server/services/docs/test-helpers";

const repository = vi.hoisted(() => ({
  isSharedWithEmail: vi.fn(),
}));

vi.mock("@/server/repositories/docs/is-shared-with-email", () => repository);

describe("resolveDocumentAccess", () => {
  it("resolves owner access without checking shares", async () => {
    const { resolveDocumentAccess } = await import("./resolve-document-access");

    await expect(resolveDocumentAccess(apiContext("owner"), document())).resolves.toBe("owned");
    expect(repository.isSharedWithEmail).not.toHaveBeenCalled();
  });

  it("resolves shared access by normalized context email", async () => {
    repository.isSharedWithEmail.mockResolvedValue(true);
    const { resolveDocumentAccess } = await import("./resolve-document-access");

    await expect(
      resolveDocumentAccess(
        apiContext("reader", "reader@example.com"),
        document({ ownerUserId: "owner" }),
      ),
    ).resolves.toBe("shared");
  });

  it("returns null when caller is neither owner nor shared", async () => {
    repository.isSharedWithEmail.mockResolvedValue(false);
    const { resolveDocumentAccess } = await import("./resolve-document-access");

    await expect(
      resolveDocumentAccess(
        apiContext("reader", "reader@example.com"),
        document({ ownerUserId: "owner" }),
      ),
    ).resolves.toBeNull();
  });
});
