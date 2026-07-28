import { describe, expect, it, vi } from "vitest";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

import type { DocumentsDatabase } from "@/types/docs-repository";

import { findDocumentByShareToken } from "./find-document-by-share-token";

describe("findDocumentByShareToken", () => {
  it("returns the document behind an active link", async () => {
    const document = { id: "doc_1" };
    const chain = joinLimitChain([{ document }]);
    const db = { select: vi.fn(() => chain) } as unknown as DocumentsDatabase;

    await expect(findDocumentByShareToken(db, "a".repeat(64))).resolves.toBe(
      document,
    );
    expect(chain.limit).toHaveBeenCalledWith(1);
  });

  it("returns null when no active link matches the hash", async () => {
    const chain = joinLimitChain([]);
    const db = { select: vi.fn(() => chain) } as unknown as DocumentsDatabase;

    await expect(
      findDocumentByShareToken(db, "a".repeat(64)),
    ).resolves.toBeNull();
  });

  it("filters out revoked links and soft-deleted documents", async () => {
    const chain = joinLimitChain([]);
    const db = { select: vi.fn(() => chain) } as unknown as DocumentsDatabase;

    await findDocumentByShareToken(db, "a".repeat(64));

    const [condition] = chain.where.mock.calls[0] as unknown as [SQL];
    const { sql } = new PgDialect().sqlToQuery(condition);
    expect(sql).toContain('"document_share_links"."revoked_at" is null');
    expect(sql).toContain('"documents"."deleted_at" is null');
  });
});

function joinLimitChain(rows: unknown[]) {
  const chain = {
    from: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(async () => rows),
  };
  return chain;
}
