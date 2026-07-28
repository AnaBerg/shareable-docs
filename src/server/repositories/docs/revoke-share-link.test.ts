import { describe, expect, it, vi } from "vitest";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

import type { DocumentsDatabase } from "@/types/docs-repository";

import { revokeShareLink } from "./revoke-share-link";

describe("revokeShareLink", () => {
  it("sets revokedAt on the active link and returns it", async () => {
    const link = { id: "link_1", revokedAt: new Date() };
    const chain = updateReturningChain([link]);
    const db = { update: vi.fn(() => chain) } as unknown as DocumentsDatabase;

    await expect(revokeShareLink(db, "doc_1")).resolves.toBe(link);
    expect(chain.set).toHaveBeenCalledWith({ revokedAt: expect.any(Date) });
  });

  it("updates only the given document's active link", async () => {
    const chain = updateReturningChain([]);
    const db = { update: vi.fn(() => chain) } as unknown as DocumentsDatabase;

    await revokeShareLink(db, "doc_1");

    const [condition] = chain.where.mock.calls[0] as unknown as [SQL];
    const { sql, params } = new PgDialect().sqlToQuery(condition);
    // Security invariant: without the documentId scoping, revoking one link
    // would revoke every active share link in the database.
    expect(sql).toContain('"document_share_links"."document_id" = ');
    expect(params).toContain("doc_1");
    expect(sql).toContain('"document_share_links"."revoked_at" is null');
  });

  it("returns null when there is no active link", async () => {
    const chain = updateReturningChain([]);
    const db = { update: vi.fn(() => chain) } as unknown as DocumentsDatabase;

    await expect(revokeShareLink(db, "doc_1")).resolves.toBeNull();
  });
});

function updateReturningChain(rows: unknown[]) {
  const chain = {
    set: vi.fn(() => chain),
    where: vi.fn(() => chain),
    returning: vi.fn(async () => rows),
  };
  return chain;
}
