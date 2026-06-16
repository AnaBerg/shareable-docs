import { describe, expect, it, vi } from "vitest";

import type { DocumentsDatabase } from "@/types/docs-repository";

import { addDocumentVersion } from "./add-version";

describe("addDocumentVersion", () => {
  it("returns null when the document does not exist", async () => {
    const chain = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      for: vi.fn(() => chain),
      limit: vi.fn(async () => []),
    };
    const tx = { select: vi.fn(() => chain) };
    const db = {
      transaction: vi.fn((callback) => callback(tx)),
    } as unknown as DocumentsDatabase;

    await expect(
      addDocumentVersion(db, {
        documentId: "doc_1",
        html: "<p>v2</p>",
        createdByUserId: "owner",
      }),
    ).resolves.toBeNull();
  });
});
