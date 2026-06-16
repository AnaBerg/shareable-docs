import { describe, expect, it, vi } from "vitest";

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
});

function selectLimitChain(rows: unknown[]) {
  const chain = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(async () => rows),
  };
  return chain;
}
