import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DocumentsDatabase } from "@/types/docs-repository";

const helpers = vi.hoisted(() => ({
  findLatestVersionsForDocuments: vi.fn(),
  findSharedDocumentIds: vi.fn(),
}));

vi.mock("./find-latest-versions-for-documents", () => ({
  findLatestVersionsForDocuments: helpers.findLatestVersionsForDocuments,
}));
vi.mock("./find-shared-document-ids", () => ({
  findSharedDocumentIds: helpers.findSharedDocumentIds,
}));

describe("listAccessibleDocuments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists accessible documents with latest versions", async () => {
    const document = {
      id: "doc_1",
      ownerUserId: "owner",
      updatedAt: new Date("2026-06-12T00:00:00.000Z"),
    };
    const version = { documentId: "doc_1", versionNumber: 1 };
    const chain = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      orderBy: vi.fn(async () => [document]),
    };
    const db = { select: vi.fn(() => chain) } as unknown as DocumentsDatabase;
    helpers.findSharedDocumentIds.mockResolvedValue(["doc_2"]);
    helpers.findLatestVersionsForDocuments.mockResolvedValue(
      new Map([["doc_1", version]]),
    );

    const { listAccessibleDocuments } = await import("./list-documents");
    const result = await listAccessibleDocuments(db, {
      ownerUserId: "owner",
      sharedWithEmail: "owner@example.com",
      access: "all",
    });

    expect(result).toEqual([{ ...document, access: "owned", latestVersion: version }]);
  });

  it("skips shared lookup for owned-only listings", async () => {
    const document = {
      id: "doc_1",
      ownerUserId: "owner",
      updatedAt: new Date("2026-06-12T00:00:00.000Z"),
    };
    const version = { documentId: "doc_1", versionNumber: 1 };
    const chain = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      orderBy: vi.fn(async () => [document]),
    };
    const db = { select: vi.fn(() => chain) } as unknown as DocumentsDatabase;
    helpers.findLatestVersionsForDocuments.mockResolvedValue(
      new Map([["doc_1", version]]),
    );

    const { listAccessibleDocuments } = await import("./list-documents");
    await listAccessibleDocuments(db, {
      ownerUserId: "owner",
      sharedWithEmail: "owner@example.com",
      access: "owned",
    });

    expect(helpers.findSharedDocumentIds).not.toHaveBeenCalled();
  });

  it("returns an empty list for shared access when no shared document ids exist", async () => {
    const db = { select: vi.fn() } as unknown as DocumentsDatabase;
    helpers.findSharedDocumentIds.mockResolvedValue([]);

    const { listAccessibleDocuments } = await import("./list-documents");
    const result = await listAccessibleDocuments(db, {
      ownerUserId: "owner",
      sharedWithEmail: "owner@example.com",
      access: "shared",
    });

    expect(result).toEqual([]);
    expect(db.select).not.toHaveBeenCalled();
  });

  it("omits rows that have no latest version entry", async () => {
    const document = {
      id: "doc_missing_version",
      ownerUserId: "owner",
      updatedAt: new Date("2026-06-12T00:00:00.000Z"),
    };
    const chain = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      orderBy: vi.fn(async () => [document]),
    };
    const db = { select: vi.fn(() => chain) } as unknown as DocumentsDatabase;
    helpers.findSharedDocumentIds.mockResolvedValue([]);
    helpers.findLatestVersionsForDocuments.mockResolvedValue(new Map());

    const { listAccessibleDocuments } = await import("./list-documents");
    const result = await listAccessibleDocuments(db, {
      ownerUserId: "owner",
      sharedWithEmail: null,
      access: "all",
    });

    expect(result).toEqual([]);
  });
});
