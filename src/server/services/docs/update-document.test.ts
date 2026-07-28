import { describe, expect, it, vi } from "vitest";

import { apiContext, document, version } from "./test-helpers";

const repository = vi.hoisted(() => ({
  addDocumentVersion: vi.fn(),
  findDocumentById: vi.fn(),
  isSharedWithEmail: vi.fn(),
}));

vi.mock("@/server/repositories/docs/add-version", () => ({
  addDocumentVersion: repository.addDocumentVersion,
}));
vi.mock("@/server/repositories/docs/find-document-by-id", () => ({
  findDocumentById: repository.findDocumentById,
}));
vi.mock("@/server/repositories/docs/is-shared-with-email", () => ({
  isSharedWithEmail: repository.isSharedWithEmail,
}));

describe("updateDocument", () => {
  it("lets the owner update and increments the version number", async () => {
    const foundDocument = document();
    const updated = {
      document: foundDocument,
      version: version({ versionNumber: 2, html: "<p>v2</p>" }),
    };
    repository.findDocumentById.mockResolvedValue(foundDocument);
    repository.addDocumentVersion.mockResolvedValue(updated);

    const { updateDocument } = await import("./update-document");
    const result = await updateDocument(
      apiContext("owner"),
      { id: foundDocument.id },
      { html: "<p>v2</p>" },
    );

    expect(result).toBe(updated);
  });

  it("does not allow a shared user to update", async () => {
    repository.findDocumentById.mockResolvedValue(document({ ownerUserId: "owner" }));
    repository.isSharedWithEmail.mockResolvedValue(true);

    const { updateDocument } = await import("./update-document");
    await expect(
      updateDocument(
        apiContext("reader", "reader@example.com"),
        { id: "01HZXJK8JHX7QY9N7K6X8Y2W0A" },
        { html: "<p>edited</p>" },
      ),
    ).rejects.toMatchObject({ status: 403, code: "forbidden" });
  });

  it("maps duplicate version races to conflict errors", async () => {
    repository.findDocumentById.mockResolvedValue(document());
    repository.addDocumentVersion.mockRejectedValue(
      Object.assign(new Error("duplicate key"), { code: "23505" }),
    );

    const { updateDocument } = await import("./update-document");
    await expect(
      updateDocument(
        apiContext("owner"),
        { id: "01HZXJK8JHX7QY9N7K6X8Y2W0A" },
        { html: "<p>v2</p>" },
      ),
    ).rejects.toMatchObject({ status: 409, code: "conflict" });
  });

  it("treats link access as insufficient to update", async () => {
    vi.resetModules();
    vi.doMock("@/server/foundation/helpers/resolve-document-access", () => ({
      resolveDocumentAccess: vi.fn().mockResolvedValue("link"),
    }));
    repository.addDocumentVersion.mockClear();
    repository.findDocumentById.mockResolvedValue(document());

    const { updateDocument } = await import("./update-document");
    await expect(
      updateDocument(
        apiContext("owner"),
        { id: "01HZXJK8JHX7QY9N7K6X8Y2W0A" },
        { html: "<p>edited</p>" },
      ),
    ).rejects.toMatchObject({ status: 403, code: "forbidden" });
    expect(repository.addDocumentVersion).not.toHaveBeenCalled();

    vi.doUnmock("@/server/foundation/helpers/resolve-document-access");
    vi.resetModules();
  });
});
