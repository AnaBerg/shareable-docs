import { beforeEach, describe, expect, it, vi } from "vitest";

import { forbiddenError } from "@/server/foundation/errors";

const serviceMocks = vi.hoisted(() => ({
  createDocument: vi.fn(),
  getDocument: vi.fn(),
  listDocuments: vi.fn(),
  shareDocument: vi.fn(),
  updateDocument: vi.fn(),
}));

vi.mock("@/server/foundation/context", () => ({
  createApiContext: vi.fn().mockResolvedValue({
    ok: true,
    ctx: {
      db: {},
      requestId: "req_test",
      user: { id: "user_1" },
      userEmail: "ada@example.com",
      log: { add: vi.fn(), emit: vi.fn() },
    },
  }),
}));

vi.mock("@/server/foundation/logs", () => ({
  createRequestLog: vi.fn(() => ({ add: vi.fn(), emit: vi.fn() })),
}));

vi.mock("@/server/services/docs/create-document", () => ({
  createDocument: serviceMocks.createDocument,
}));

vi.mock("@/server/services/docs/get-document", () => ({
  getDocument: serviceMocks.getDocument,
}));

vi.mock("@/server/services/docs/list-documents", () => ({
  listDocuments: serviceMocks.listDocuments,
}));

vi.mock("@/server/services/docs/share-document", () => ({
  shareDocument: serviceMocks.shareDocument,
}));

vi.mock("@/server/services/docs/update-document", () => ({
  updateDocument: serviceMocks.updateDocument,
}));

describe("docs HTTP handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a document with normalized request input", async () => {
    const now = new Date("2026-06-12T00:00:00.000Z");
    serviceMocks.createDocument.mockResolvedValue({
      document: {
        id: "01HZXJK8JHX7QY9N7K6X8Y2W0A",
        ownerUserId: "user_1",
        name: "Report",
        description: null,
        createdAt: now,
        updatedAt: now,
      },
      version: { versionNumber: 1 },
    });

    const { createDocumentHandler } = await import(".");
    const response = await createDocumentHandler(
      jsonRequest("https://app.test/api/docs", {
        name: " Report ",
        description: " ",
        html: "<h1>Report</h1>",
      }),
    );

    expect(response.status).toBe(201);
    expect(serviceMocks.createDocument).toHaveBeenCalledWith(
      expect.objectContaining({ user: expect.objectContaining({ id: "user_1" }) }),
      { name: "Report", description: null, html: "<h1>Report</h1>" },
    );
    await expect(response.json()).resolves.toMatchObject({
      id: "01HZXJK8JHX7QY9N7K6X8Y2W0A",
      latestVersion: 1,
    });
  });

  it("rejects a document larger than the html limit", async () => {
    const { createDocumentHandler } = await import(".");
    const response = await createDocumentHandler(
      jsonRequest("https://app.test/api/docs", {
        name: "Report",
        description: null,
        html: "a".repeat(1_000_001),
      }),
    );

    expect(response.status).toBe(422);
    expect(serviceMocks.createDocument).not.toHaveBeenCalled();
  });

  it("rejects a share request above the email limit", async () => {
    const { shareDocumentHandler } = await import(".");
    const response = await shareDocumentHandler(
      jsonRequest("https://app.test/api/docs/share/01HZXJK8JHX7QY9N7K6X8Y2W0A", {
        emails: Array.from({ length: 51 }, (_, index) => `user${index}@example.com`),
      }),
      { params: Promise.resolve({ id: "01HZXJK8JHX7QY9N7K6X8Y2W0A" }) },
    );

    expect(response.status).toBe(422);
    expect(serviceMocks.shareDocument).not.toHaveBeenCalled();
  });

  it("lists documents and rejects invalid access filters", async () => {
    serviceMocks.listDocuments.mockResolvedValue({ documents: [] });

    const { listDocumentsHandler } = await import(".");
    const validResponse = await listDocumentsHandler(
      new Request("https://app.test/api/docs?access=shared"),
    );
    const invalidResponse = await listDocumentsHandler(
      new Request("https://app.test/api/docs?access=unknown"),
    );

    expect(validResponse.status).toBe(200);
    expect(serviceMocks.listDocuments).toHaveBeenCalledWith(
      expect.anything(),
      { access: "shared" },
    );
    expect(invalidResponse.status).toBe(422);
  });

  it("gets a document by awaiting route params and defaulting to latest version", async () => {
    const now = new Date("2026-06-12T00:00:00.000Z");
    serviceMocks.getDocument.mockResolvedValue({
      document: {
        id: "01HZXJK8JHX7QY9N7K6X8Y2W0A",
        ownerUserId: "user_1",
        name: "Report",
        description: "A report",
        createdAt: now,
        updatedAt: now,
      },
      version: {
        versionNumber: 2,
        html: "<p>v2</p>",
        createdAt: now,
      },
      latestVersion: { versionNumber: 2 },
    });

    const { getDocumentHandler } = await import(".");
    const response = await getDocumentHandler(
      new Request("https://app.test/api/docs/01HZXJK8JHX7QY9N7K6X8Y2W0A"),
      { params: Promise.resolve({ id: "01HZXJK8JHX7QY9N7K6X8Y2W0A" }) },
    );

    expect(response.status).toBe(200);
    expect(serviceMocks.getDocument).toHaveBeenCalledWith(
      expect.anything(),
      { id: "01HZXJK8JHX7QY9N7K6X8Y2W0A" },
      {},
    );
    await expect(response.json()).resolves.toMatchObject({
      id: "01HZXJK8JHX7QY9N7K6X8Y2W0A",
      version: 2,
      latestVersion: 2,
      html: "<p>v2</p>",
    });
  });

  it("maps update forbidden errors to 403", async () => {
    serviceMocks.updateDocument.mockRejectedValue(
      forbiddenError("Only the document owner can update it"),
    );

    const { updateDocumentHandler } = await import(".");
    const response = await updateDocumentHandler(
      jsonRequest("https://app.test/api/docs/01HZXJK8JHX7QY9N7K6X8Y2W0A", { html: "<p>v2</p>" }, "PUT"),
      { params: Promise.resolve({ id: "01HZXJK8JHX7QY9N7K6X8Y2W0A" }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "forbidden" },
    });
  });

  it("shares a document with normalized email input", async () => {
    serviceMocks.shareDocument.mockResolvedValue({
      document: { id: "01HZXJK8JHX7QY9N7K6X8Y2W0A" },
      shares: [
        { sharedWithEmail: "existing@example.com" },
        { sharedWithEmail: "reader@example.com" },
        { sharedWithEmail: "reviewer@example.com" },
      ],
    });

    const { shareDocumentHandler } = await import(".");
    const response = await shareDocumentHandler(
      jsonRequest("https://app.test/api/docs/share/01HZXJK8JHX7QY9N7K6X8Y2W0A", {
        emails: [" Reader@Example.com ", "reader@example.com", "reviewer@example.com"],
      }),
      { params: Promise.resolve({ id: "01HZXJK8JHX7QY9N7K6X8Y2W0A" }) },
    );

    expect(response.status).toBe(200);
    expect(serviceMocks.shareDocument).toHaveBeenCalledWith(
      expect.anything(),
      { id: "01HZXJK8JHX7QY9N7K6X8Y2W0A" },
      { emails: ["reader@example.com", "reviewer@example.com"] },
    );
    await expect(response.json()).resolves.toEqual({
      id: "01HZXJK8JHX7QY9N7K6X8Y2W0A",
      sharedWith: ["reader@example.com", "reviewer@example.com"],
    });
  });
});

function jsonRequest(url: string, body: unknown, method = "POST") {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
