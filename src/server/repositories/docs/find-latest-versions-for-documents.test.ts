import { describe, expect, it, vi } from "vitest";

import type { DocumentsDatabase } from "@/types/docs-repository";

import { findLatestVersionsForDocuments } from "./find-latest-versions-for-documents";

describe("findLatestVersionsForDocuments", () => {
  it("returns an empty map without querying when no ids are provided", async () => {
    const db = { select: vi.fn() } as unknown as DocumentsDatabase;

    await expect(findLatestVersionsForDocuments(db, [])).resolves.toEqual(new Map());
    expect(db.select).not.toHaveBeenCalled();
  });

  it("keeps the first ordered version per document", async () => {
    const rows = [
      { id: "v2", documentId: "doc_1", versionNumber: 2 },
      { id: "v1", documentId: "doc_1", versionNumber: 1 },
      { id: "other", documentId: "doc_2", versionNumber: 1 },
    ];
    const chain = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      orderBy: vi.fn(async () => rows),
    };
    const db = { select: vi.fn(() => chain) } as unknown as DocumentsDatabase;

    const latest = await findLatestVersionsForDocuments(db, ["doc_1", "doc_2"]);

    expect(latest.get("doc_1")).toBe(rows[0]);
    expect(latest.get("doc_2")).toBe(rows[2]);
  });
});
