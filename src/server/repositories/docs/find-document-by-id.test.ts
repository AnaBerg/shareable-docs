import { describe, expect, it, vi } from "vitest";

import type { DocumentsDatabase } from "@/types/docs-repository";

import { findDocumentById } from "./find-document-by-id";

describe("findDocumentById", () => {
  it("returns the first active document or null", async () => {
    const document = { id: "doc_1" };
    const chain = selectLimitChain([document]);
    const db = { select: vi.fn(() => chain) } as unknown as DocumentsDatabase;

    await expect(findDocumentById(db, "doc_1")).resolves.toBe(document);
    expect(chain.limit).toHaveBeenCalledWith(1);
  });
});

function selectLimitChain(rows: unknown[]) {
  const chain = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(async () => rows),
  };
  return chain;
}
