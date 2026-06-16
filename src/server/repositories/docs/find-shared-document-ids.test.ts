import { describe, expect, it, vi } from "vitest";

import type { DocumentsDatabase } from "@/types/docs-repository";

import { findSharedDocumentIds } from "./find-shared-document-ids";

describe("findSharedDocumentIds", () => {
  it("returns document ids shared with an email", async () => {
    const chain = {
      from: vi.fn(() => chain),
      where: vi.fn(async () => [{ documentId: "doc_1" }, { documentId: "doc_2" }]),
    };
    const db = { select: vi.fn(() => chain) } as unknown as DocumentsDatabase;

    await expect(findSharedDocumentIds(db, "reader@example.com")).resolves.toEqual([
      "doc_1",
      "doc_2",
    ]);
  });
});
