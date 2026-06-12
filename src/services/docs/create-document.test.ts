import { describe, expect, it, vi } from "vitest";

import { apiContext, document, version } from "./test-helpers";

const repository = vi.hoisted(() => ({
  createDocumentRecord: vi.fn(),
}));

vi.mock("@/repository/docs/create-document", () => repository);

describe("createDocument", () => {
  it("creates a document with an initial version owned by the current user", async () => {
    const created = { document: document(), version: version() };
    repository.createDocumentRecord.mockResolvedValue(created);

    const { createDocument } = await import("./create-document");
    const result = await createDocument(
      apiContext("owner"),
      { name: "Plan", description: null, html: "<h1>Plan</h1>" },
    );

    expect(repository.createDocumentRecord).toHaveBeenCalledWith(expect.anything(), {
      document: {
        ownerUserId: "owner",
        name: "Plan",
        description: null,
      },
      version: {
        html: "<h1>Plan</h1>",
        createdByUserId: "owner",
      },
    });
    expect(result).toBe(created);
  });
});
