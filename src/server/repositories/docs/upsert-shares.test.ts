import { describe, expect, it, vi } from "vitest";

import type { DocumentsDatabase } from "@/types/docs-repository";

import { upsertDocumentShares } from "./upsert-shares";

describe("upsertDocumentShares", () => {
  it("returns current shares without inserting when there are no new emails", async () => {
    const shares = [{ sharedWithEmail: "reader@example.com" }];
    const chain = {
      from: vi.fn(() => chain),
      where: vi.fn(async () => shares),
    };
    const db = {
      insert: vi.fn(),
      select: vi.fn(() => chain),
    } as unknown as DocumentsDatabase;

    await expect(
      upsertDocumentShares(db, {
        documentId: "doc_1",
        emails: [],
        sharedByUserId: "owner",
      }),
    ).resolves.toBe(shares);
    expect(db.insert).not.toHaveBeenCalled();
  });
});
