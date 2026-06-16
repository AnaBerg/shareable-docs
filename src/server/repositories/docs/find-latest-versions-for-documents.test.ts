import { describe, expect, it, vi } from "vitest";

import type { DocumentsDatabase } from "@/types/docs-repository";

import { findLatestVersionsForDocuments } from "./find-latest-versions-for-documents";

describe("findLatestVersionsForDocuments", () => {
  it("returns an empty map without querying when no ids are provided", async () => {
    const db = { select: vi.fn() } as unknown as DocumentsDatabase;

    await expect(findLatestVersionsForDocuments(db, [])).resolves.toEqual(new Map());
    expect(db.select).not.toHaveBeenCalled();
  });

  it("maps latest version rows selected by the database", async () => {
    const versions = [
      { id: "v2", documentId: "doc_1", versionNumber: 2 },
      { id: "other", documentId: "doc_2", versionNumber: 1 },
    ];
    const latestSubquery = {
      from: vi.fn(() => latestSubquery),
      where: vi.fn(() => latestSubquery),
      groupBy: vi.fn(() => latestSubquery),
      as: vi.fn(() => ({ documentId: "document_id", versionNumber: "version_number" })),
    };
    const rows = versions.map((version) => ({ document_versions: version }));
    const latestRowsQuery = {
      from: vi.fn(() => latestRowsQuery),
      innerJoin: vi.fn(async () => rows),
    };
    const db = {
      select: vi
        .fn()
        .mockReturnValueOnce(latestSubquery)
        .mockReturnValueOnce(latestRowsQuery),
    } as unknown as DocumentsDatabase;

    const latest = await findLatestVersionsForDocuments(db, ["doc_1", "doc_2"]);

    expect(latestSubquery.groupBy).toHaveBeenCalledTimes(1);
    expect(latestRowsQuery.innerJoin).toHaveBeenCalledTimes(1);
    expect(latest.get("doc_1")).toBe(versions[0]);
    expect(latest.get("doc_2")).toBe(versions[1]);
  });
});
