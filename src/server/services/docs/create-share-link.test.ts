import { beforeEach, describe, expect, it, vi } from "vitest";

import { hashShareToken } from "@/server/foundation/helpers/share-token";

import { apiContext, document } from "./test-helpers";

const repository = vi.hoisted(() => ({
  findDocumentById: vi.fn(),
  isSharedWithEmail: vi.fn(),
  upsertShareLink: vi.fn(),
}));

vi.mock("@/server/repositories/docs/find-document-by-id", () => ({
  findDocumentById: repository.findDocumentById,
}));
vi.mock("@/server/repositories/docs/is-shared-with-email", () => ({
  isSharedWithEmail: repository.isSharedWithEmail,
}));
vi.mock("@/server/repositories/docs/upsert-share-link", () => ({
  upsertShareLink: repository.upsertShareLink,
}));

describe("createShareLink", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the plaintext token only on creation and stores only its hash", async () => {
    const foundDocument = document();
    repository.findDocumentById.mockResolvedValue(foundDocument);
    repository.upsertShareLink.mockResolvedValue({ id: "01HZXJK8JHX7QY9N7K6X8Y2W0C" });

    const { createShareLink } = await import("./create-share-link");
    const result = await createShareLink(apiContext("owner"), { id: foundDocument.id });

    expect(result.token).toEqual(expect.any(String));
    expect(result.access).toBe("owned");
    expect(repository.upsertShareLink).toHaveBeenCalledWith(expect.anything(), {
      documentId: foundDocument.id,
      tokenHash: hashShareToken(result.token),
      createdByUserId: "owner",
    });
    expect(JSON.stringify(repository.upsertShareLink.mock.calls)).not.toContain(
      result.token,
    );
  });

  it("rotates the link: each creation upserts a fresh token hash", async () => {
    const foundDocument = document();
    repository.findDocumentById.mockResolvedValue(foundDocument);
    repository.upsertShareLink.mockResolvedValue({ id: "01HZXJK8JHX7QY9N7K6X8Y2W0C" });

    const { createShareLink } = await import("./create-share-link");
    const first = await createShareLink(apiContext("owner"), { id: foundDocument.id });
    const second = await createShareLink(apiContext("owner"), { id: foundDocument.id });

    expect(first.token).not.toBe(second.token);
    const [firstCall, secondCall] = repository.upsertShareLink.mock.calls;
    expect(firstCall[1].tokenHash).toBe(hashShareToken(first.token));
    expect(secondCall[1].tokenHash).toBe(hashShareToken(second.token));
  });

  it("rejects a shared-email user", async () => {
    const foundDocument = document({ ownerUserId: "owner" });
    repository.findDocumentById.mockResolvedValue(foundDocument);
    repository.isSharedWithEmail.mockResolvedValue(true);

    const { createShareLink } = await import("./create-share-link");
    await expect(
      createShareLink(apiContext("reader", "reader@example.com"), {
        id: foundDocument.id,
      }),
    ).rejects.toMatchObject({ status: 403, code: "forbidden" });
    expect(repository.upsertShareLink).not.toHaveBeenCalled();
  });

  it("maps a losing concurrent rotation to a conflict error", async () => {
    const foundDocument = document();
    repository.findDocumentById.mockResolvedValue(foundDocument);
    repository.upsertShareLink.mockRejectedValue({ code: "23505" });

    const { createShareLink } = await import("./create-share-link");
    await expect(
      createShareLink(apiContext("owner"), { id: foundDocument.id }),
    ).rejects.toMatchObject({ status: 409, code: "conflict" });
  });

  it("rethrows non-unique-violation upsert failures", async () => {
    const foundDocument = document();
    repository.findDocumentById.mockResolvedValue(foundDocument);
    const failure = new Error("connection reset");
    repository.upsertShareLink.mockRejectedValue(failure);

    const { createShareLink } = await import("./create-share-link");
    await expect(
      createShareLink(apiContext("owner"), { id: foundDocument.id }),
    ).rejects.toBe(failure);
  });

  it("throws not found for a missing document", async () => {
    repository.findDocumentById.mockResolvedValue(null);

    const { createShareLink } = await import("./create-share-link");
    await expect(
      createShareLink(apiContext("owner"), { id: "01HZXJK8JHX7QY9N7K6X8Y2W0A" }),
    ).rejects.toMatchObject({ status: 404, code: "not_found" });
    expect(repository.upsertShareLink).not.toHaveBeenCalled();
  });
});
