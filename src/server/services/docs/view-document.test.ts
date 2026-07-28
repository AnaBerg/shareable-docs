import { describe, expect, it, vi } from "vitest";

import { createShareToken } from "@/server/foundation/helpers/share-token";

import { document, version } from "./test-helpers";

const repository = vi.hoisted(() => ({
  findDocumentById: vi.fn(),
  findDocumentByShareToken: vi.fn(),
  findLatestVersion: vi.fn(),
  findVersion: vi.fn(),
  isSharedWithEmail: vi.fn(),
}));

vi.mock("@/server/repositories/docs/find-document-by-id", () => ({
  findDocumentById: repository.findDocumentById,
}));
vi.mock("@/server/repositories/docs/find-document-by-share-token", () => ({
  findDocumentByShareToken: repository.findDocumentByShareToken,
}));
vi.mock("@/server/repositories/docs/find-latest-version", () => ({
  findLatestVersion: repository.findLatestVersion,
}));
vi.mock("@/server/repositories/docs/find-version", () => ({
  findVersion: repository.findVersion,
}));
vi.mock("@/server/repositories/docs/is-shared-with-email", () => ({
  isSharedWithEmail: repository.isSharedWithEmail,
}));

const db = {} as never;

describe("viewDocument", () => {
  it("resolves a document for a link viewer", async () => {
    const foundDocument = document();
    const latestVersion = version({ versionNumber: 2, html: "<p>v2</p>" });
    const { token } = createShareToken();
    repository.findDocumentById.mockResolvedValue(foundDocument);
    repository.findDocumentByShareToken.mockResolvedValue(foundDocument);
    repository.findLatestVersion.mockResolvedValue(latestVersion);

    const { viewDocument } = await import("./view-document");
    const result = await viewDocument({
      db,
      viewer: { kind: "link", token },
      documentId: foundDocument.id,
    });

    expect(result.access).toBe("link");
    expect(result.version).toBe(latestVersion);
    expect(result.latestVersion).toBe(latestVersion);
  });

  it("resolves a specific version for the owner", async () => {
    const foundDocument = document({ ownerUserId: "owner" });
    const requestedVersion = version({ versionNumber: 1, html: "<p>v1</p>" });
    const latestVersion = version({ versionNumber: 2, html: "<p>v2</p>" });
    repository.findDocumentById.mockResolvedValue(foundDocument);
    repository.findLatestVersion.mockResolvedValue(latestVersion);
    repository.findVersion.mockResolvedValue(requestedVersion);

    const { viewDocument } = await import("./view-document");
    const result = await viewDocument({
      db,
      viewer: { kind: "user", userId: "owner", email: "owner@example.com" },
      documentId: foundDocument.id,
      version: 1,
    });

    expect(result.access).toBe("owned");
    expect(result.version).toBe(requestedVersion);
    expect(result.latestVersion).toBe(latestVersion);
  });

  it("resolves shared access for a signed-in shared email", async () => {
    const foundDocument = document({ ownerUserId: "owner" });
    repository.findDocumentById.mockResolvedValue(foundDocument);
    repository.findLatestVersion.mockResolvedValue(version());
    repository.isSharedWithEmail.mockResolvedValue(true);

    const { viewDocument } = await import("./view-document");
    const result = await viewDocument({
      db,
      viewer: { kind: "user", userId: "reader", email: "reader@example.com" },
      documentId: foundDocument.id,
    });

    expect(result.access).toBe("shared");
  });

  it("hides existence from an anonymous viewer with a 404", async () => {
    const foundDocument = document();
    repository.findDocumentById.mockResolvedValue(foundDocument);

    const { viewDocument } = await import("./view-document");

    await expect(
      viewDocument({ db, viewer: null, documentId: foundDocument.id }),
    ).rejects.toMatchObject({ status: 404, code: "not_found" });
  });

  it("hides existence from an unauthorized user with a 404, not a 403", async () => {
    const foundDocument = document({ ownerUserId: "owner" });
    repository.findDocumentById.mockResolvedValue(foundDocument);
    repository.isSharedWithEmail.mockResolvedValue(false);

    const { viewDocument } = await import("./view-document");

    await expect(
      viewDocument({
        db,
        viewer: { kind: "user", userId: "intruder", email: "intruder@example.com" },
        documentId: foundDocument.id,
      }),
    ).rejects.toMatchObject({ status: 404, code: "not_found" });
  });

  it("rejects a token that does not point at this document with a 404", async () => {
    const foundDocument = document();
    const { token } = createShareToken();
    repository.findDocumentById.mockResolvedValue(foundDocument);
    repository.findDocumentByShareToken.mockResolvedValue(undefined);

    const { viewDocument } = await import("./view-document");

    await expect(
      viewDocument({ db, viewer: { kind: "link", token }, documentId: foundDocument.id }),
    ).rejects.toMatchObject({ status: 404, code: "not_found" });
  });

  it("returns a 404 for a missing document", async () => {
    repository.findDocumentById.mockResolvedValue(undefined);

    const { viewDocument } = await import("./view-document");

    await expect(
      viewDocument({ db, viewer: null, documentId: "01HZXJK8JHX7QY9N7K6X8Y2W0Z" }),
    ).rejects.toMatchObject({ status: 404, code: "not_found" });
  });

  it("returns a 404 for a missing version", async () => {
    const foundDocument = document({ ownerUserId: "owner" });
    repository.findDocumentById.mockResolvedValue(foundDocument);
    repository.findLatestVersion.mockResolvedValue(version());
    repository.findVersion.mockResolvedValue(undefined);

    const { viewDocument } = await import("./view-document");

    await expect(
      viewDocument({
        db,
        viewer: { kind: "user", userId: "owner", email: "owner@example.com" },
        documentId: foundDocument.id,
        version: 7,
      }),
    ).rejects.toMatchObject({ status: 404, code: "not_found" });
  });
});
