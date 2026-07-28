import { describe, expect, it, vi } from "vitest";

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
