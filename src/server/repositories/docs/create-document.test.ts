import { describe, expect, it, vi } from "vitest";

import type { DocumentsDatabase } from "@/types/docs-repository";

import { createDocumentRecord } from "./create-document";

describe("createDocumentRecord", () => {
  it("creates a document and its initial version in one transaction", async () => {
    const values = vi.fn((value) => ({ returning: vi.fn(async () => [value]) }));
    const tx = { insert: vi.fn(() => ({ values })) };
    const db = {
      transaction: vi.fn((callback) => callback(tx)),
    } as unknown as DocumentsDatabase;

    const result = await createDocumentRecord(db, {
      document: { ownerUserId: "owner", name: "Doc", description: null },
      version: { html: "<p>v1</p>", createdByUserId: "owner" },
    });

    expect(tx.insert).toHaveBeenCalledTimes(2);
    expect(result.version).toMatchObject({
      documentId: result.document.id,
      versionNumber: 1,
      html: "<p>v1</p>",
    });
  });
});
