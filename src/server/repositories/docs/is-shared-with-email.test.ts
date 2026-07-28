import { and, eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

import { documentShares } from "@/db";
import type { DocumentsDatabase } from "@/types/docs-repository";

import { isSharedWithEmail } from "./is-shared-with-email";

describe("isSharedWithEmail", () => {
  it("returns whether a share row exists", async () => {
    const chain = selectLimitChain([{ id: "share_1" }]);
    const db = { select: vi.fn(() => chain) } as unknown as DocumentsDatabase;

    await expect(isSharedWithEmail(db, "doc_1", "reader@example.com")).resolves.toBe(true);
  });

  it("returns false when no share exists", async () => {
    const chain = selectLimitChain([]);
    const db = { select: vi.fn(() => chain) } as unknown as DocumentsDatabase;

    await expect(isSharedWithEmail(db, "doc_1", "reader@example.com")).resolves.toBe(false);
  });

  it("queries with the normalized email", async () => {
    const chain = selectLimitChain([{ id: "share_1" }]);
    const db = { select: vi.fn(() => chain) } as unknown as DocumentsDatabase;

    await expect(isSharedWithEmail(db, "doc_1", " Reader@Example.com ")).resolves.toBe(true);

    expect(chain.where).toHaveBeenCalledWith(
      and(
        eq(documentShares.documentId, "doc_1"),
        eq(documentShares.sharedWithEmail, "reader@example.com"),
      ),
    );
  });

  it("returns false without querying when the email is blank", async () => {
    const chain = selectLimitChain([{ id: "share_1" }]);
    const db = { select: vi.fn(() => chain) } as unknown as DocumentsDatabase;

    await expect(isSharedWithEmail(db, "doc_1", "   ")).resolves.toBe(false);

    expect(db.select).not.toHaveBeenCalled();
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
