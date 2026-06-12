import { describe, expect, it, vi } from "vitest";

import { apiContext, document, version } from "./test-helpers";

const repository = vi.hoisted(() => ({
  listAccessibleDocuments: vi.fn(),
}));

vi.mock("@/repository/docs/list-documents", () => repository);

describe("listDocuments", () => {
  it("lists documents with the requested access filter", async () => {
    const documents = [
      { ...document(), access: "owned", latestVersion: version() },
    ];
    repository.listAccessibleDocuments.mockResolvedValue(documents);

    const { listDocuments } = await import("./list-documents");
    const result = await listDocuments(apiContext("owner", "owner@example.com"), {
      access: "owned",
    });

    expect(repository.listAccessibleDocuments).toHaveBeenCalledWith(
      expect.anything(),
      {
        ownerUserId: "owner",
        sharedWithEmail: "owner@example.com",
        access: "owned",
      },
    );
    expect(result).toEqual({ documents });
  });

  it("passes null email through so shared rows are excluded by repository", async () => {
    repository.listAccessibleDocuments.mockResolvedValue([]);

    const { listDocuments } = await import("./list-documents");
    await listDocuments(apiContext("owner", null), { access: "all" });

    expect(repository.listAccessibleDocuments).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ sharedWithEmail: null }),
    );
  });
});
