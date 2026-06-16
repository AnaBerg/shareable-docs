import { describe, expect, it, vi } from "vitest";

import type { DocumentsDatabase } from "@/types/docs-repository";

import { findLatestVersion } from "./find-latest-version";

describe("findLatestVersion", () => {
  it("returns the highest ordered version row or null", async () => {
    const version = { id: "version_2", versionNumber: 2 };
    const chain = selectOrderedLimitChain([version]);
    const db = { select: vi.fn(() => chain) } as unknown as DocumentsDatabase;

    await expect(findLatestVersion(db, "doc_1")).resolves.toBe(version);
    expect(chain.orderBy).toHaveBeenCalledTimes(1);
    expect(chain.limit).toHaveBeenCalledWith(1);
  });
});

function selectOrderedLimitChain(rows: unknown[]) {
  const chain = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(async () => rows),
  };
  return chain;
}
