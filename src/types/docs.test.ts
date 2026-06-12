import { describe, expect, it } from "vitest";

import {
  createDocumentRequestSchema,
  documentRouteParamsSchema,
  getDocumentQuerySchema,
  listDocumentsQuerySchema,
  newDocumentSchema,
  newDocumentShareSchema,
  newDocumentVersionSchema,
  shareDocumentRequestSchema,
  updateDocumentRequestSchema,
} from "./docs";

describe("docs contracts", () => {
  it("normalizes create document input", () => {
    expect(
      createDocumentRequestSchema.parse({
        name: "  Report  ",
        description: "  ",
        html: "<h1>Report</h1>",
      }),
    ).toEqual({
      name: "Report",
      description: null,
      html: "<h1>Report</h1>",
    });

    expect(
      createDocumentRequestSchema.parse({
        name: "Report",
        description: null,
        html: "<p>Body</p>",
      }),
    ).toEqual({ name: "Report", description: null, html: "<p>Body</p>" });
  });

  it("rejects empty create and update content", () => {
    expect(() =>
      createDocumentRequestSchema.parse({ name: "   ", html: "<p>Body</p>" }),
    ).toThrow();

    expect(() =>
      createDocumentRequestSchema.parse({ name: "Report", html: "" }),
    ).toThrow();

    expect(() => updateDocumentRequestSchema.parse({ html: "" })).toThrow();
  });

  it("parses route params, versions, and list filters", () => {
    expect(documentRouteParamsSchema.parse({ id: "doc_1" })).toEqual({
      id: "doc_1",
    });
    expect(() => documentRouteParamsSchema.parse({ id: "" })).toThrow();

    expect(getDocumentQuerySchema.parse({ version: "2" })).toEqual({
      version: 2,
    });
    expect(getDocumentQuerySchema.parse({})).toEqual({});
    expect(() => getDocumentQuerySchema.parse({ version: "0" })).toThrow();
    expect(() => getDocumentQuerySchema.parse({ version: "1.5" })).toThrow();

    expect(listDocumentsQuerySchema.parse({})).toEqual({ access: "all" });
    expect(listDocumentsQuerySchema.parse({ access: "shared" })).toEqual({
      access: "shared",
    });
    expect(() =>
      listDocumentsQuerySchema.parse({ access: "unknown" }),
    ).toThrow();
  });

  it("normalizes and deduplicates share emails", () => {
    expect(
      shareDocumentRequestSchema.parse({
        emails: [
          " Reader@Example.com ",
          "reader@example.com",
          "reviewer@example.com",
        ],
      }),
    ).toEqual({
      emails: ["reader@example.com", "reviewer@example.com"],
    });

    expect(() => shareDocumentRequestSchema.parse({ emails: [] })).toThrow();
    expect(() =>
      shareDocumentRequestSchema.parse({ emails: ["not-an-email"] }),
    ).toThrow();
  });

  it("validates DB insert objects", () => {
    const createdAt = new Date("2026-06-12T00:00:00.000Z");

    expect(
      newDocumentSchema.parse({
        id: "doc_1",
        ownerUserId: "user_1",
        name: "Report",
        description: null,
        createdAt,
        updatedAt: createdAt,
      }),
    ).toEqual({
      id: "doc_1",
      ownerUserId: "user_1",
      name: "Report",
      description: null,
      createdAt,
      updatedAt: createdAt,
    });

    expect(
      newDocumentVersionSchema.parse({
        id: "version_1",
        documentId: "doc_1",
        versionNumber: 1,
        html: "<p>Body</p>",
        createdByUserId: "user_1",
        createdAt,
      }),
    ).toEqual({
      id: "version_1",
      documentId: "doc_1",
      versionNumber: 1,
      html: "<p>Body</p>",
      createdByUserId: "user_1",
      createdAt,
    });

    expect(
      newDocumentShareSchema.parse({
        id: "share_1",
        documentId: "doc_1",
        sharedWithEmail: "reader@example.com",
        sharedByUserId: "user_1",
        createdAt,
      }),
    ).toEqual({
      id: "share_1",
      documentId: "doc_1",
      sharedWithEmail: "reader@example.com",
      sharedByUserId: "user_1",
      createdAt,
    });
  });

  it("rejects non-normalized DB share emails", () => {
    const createdAt = new Date("2026-06-12T00:00:00.000Z");

    expect(() =>
      newDocumentShareSchema.parse({
        id: "share_1",
        documentId: "doc_1",
        sharedWithEmail: "Reader@Example.com",
        sharedByUserId: "user_1",
        createdAt,
      }),
    ).toThrow();

    expect(() =>
      newDocumentShareSchema.parse({
        id: "share_1",
        documentId: "doc_1",
        sharedWithEmail: " reader@example.com ",
        sharedByUserId: "user_1",
        createdAt,
      }),
    ).toThrow();
  });
});
