import { describe, expect, it, vi } from "vitest";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

import type { DocumentsDatabase } from "@/types/docs-repository";

import { upsertShareLink } from "./upsert-share-link";

describe("upsertShareLink", () => {
  it("revokes the previous link and inserts the new one", async () => {
    const link = { id: "link_2" };
    const updateChain = {
      set: vi.fn(() => updateChain),
      where: vi.fn(async () => []),
    };
    const insertChain = {
      values: vi.fn(() => insertChain),
      returning: vi.fn(async () => [link]),
    };
    const tx = {
      update: vi.fn(() => updateChain),
      insert: vi.fn(() => insertChain),
    };
    const db = {
      transaction: vi.fn((callback) => callback(tx)),
    } as unknown as DocumentsDatabase;

    await expect(
      upsertShareLink(db, {
        documentId: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
        tokenHash: "a".repeat(64),
        createdByUserId: "owner",
      }),
    ).resolves.toBe(link);

    expect(updateChain.set).toHaveBeenCalledWith({
      revokedAt: expect.any(Date),
    });

    const [condition] = updateChain.where.mock.calls[0] as unknown as [SQL];
    const { sql, params } = new PgDialect().sqlToQuery(condition);
    // Security invariant: without the documentId scoping, rotating one link
    // would revoke every active share link in the database.
    expect(sql).toContain('"document_share_links"."document_id" = ');
    expect(params).toContain("01ARZ3NDEKTSV4RRFFQ69G5FAV");
    expect(sql).toContain('"document_share_links"."revoked_at" is null');

    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({ tokenHash: "a".repeat(64) }),
    );
  });
});
