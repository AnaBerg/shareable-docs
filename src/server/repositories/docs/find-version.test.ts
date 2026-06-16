import { describe, expect, it, vi } from "vitest";

import type { DocumentsDatabase } from "@/types/docs-repository";

import { findVersion } from "./find-version";

describe("findVersion", () => {
  it("returns a specific version or null", async () => {
    const version = { id: "version_1", versionNumber: 1 };
    const chain = selectLimitChain([version]);
    const db = { select: vi.fn(() => chain) } as unknown as DocumentsDatabase;

    await expect(findVersion(db, "doc_1", 1)).resolves.toBe(version);
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
