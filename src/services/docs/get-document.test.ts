import { describe, expect, it, vi } from "vitest";

import { apiContext, document, version } from "./test-helpers";

const repository = vi.hoisted(() => ({
  findDocumentById: vi.fn(),
  findLatestVersion: vi.fn(),
  findVersion: vi.fn(),
  isSharedWithEmail: vi.fn(),
}));

vi.mock("@/repository/docs/find-document-by-id", () => ({
  findDocumentById: repository.findDocumentById,
}));
vi.mock("@/repository/docs/find-latest-version", () => ({
  findLatestVersion: repository.findLatestVersion,
}));
vi.mock("@/repository/docs/find-version", () => ({
  findVersion: repository.findVersion,
}));
vi.mock("@/repository/docs/is-shared-with-email", () => ({
  isSharedWithEmail: repository.isSharedWithEmail,
}));

describe("getDocument", () => {
  it("gets the latest version when no version is requested", async () => {
    const foundDocument = document();
    const latestVersion = version({ versionNumber: 2, html: "<p>v2</p>" });
    repository.findDocumentById.mockResolvedValue(foundDocument);
    repository.findLatestVersion.mockResolvedValue(latestVersion);

    const { getDocument } = await import("./get-document");
    const result = await getDocument(apiContext("owner"), { id: foundDocument.id }, {});

    expect(result.version).toBe(latestVersion);
    expect(repository.findVersion).not.toHaveBeenCalled();
  });

  it("gets a specific version and still returns latest version metadata", async () => {
    const foundDocument = document();
    const requestedVersion = version({ versionNumber: 1, html: "<p>v1</p>" });
    const latestVersion = version({ versionNumber: 2, html: "<p>v2</p>" });
    repository.findDocumentById.mockResolvedValue(foundDocument);
    repository.findLatestVersion.mockResolvedValue(latestVersion);
    repository.findVersion.mockResolvedValue(requestedVersion);

    const { getDocument } = await import("./get-document");
    const result = await getDocument(
      apiContext("owner"),
      { id: foundDocument.id },
      { version: 1 },
    );

    expect(result.version).toBe(requestedVersion);
    expect(result.latestVersion).toBe(latestVersion);
  });

  it("allows a user with a shared primary email to read", async () => {
    const foundDocument = document({ ownerUserId: "owner" });
    repository.findDocumentById.mockResolvedValue(foundDocument);
    repository.findLatestVersion.mockResolvedValue(version());
    repository.isSharedWithEmail.mockResolvedValue(true);

    const { getDocument } = await import("./get-document");
    const result = await getDocument(
      apiContext("reader", "reader@example.com"),
      { id: foundDocument.id },
      {},
    );

    expect(result.access).toBe("shared");
  });
});
