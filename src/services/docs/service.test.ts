import { beforeEach, describe, expect, it } from "vitest";

import type { User } from "@/db";
import type { ApiContext } from "@/server/foundation/context";
import type { NewDocument, NewDocumentShare, NewDocumentVersion } from "@/types/docs";

import { createDocument } from "./create-document";
import { getDocument } from "./get-document";
import { listDocuments } from "./list-documents";
import { shareDocument } from "./share-document";
import { updateDocument } from "./update-document";

describe("docs services", () => {
  let repo: MemoryDocumentsRepository;

  beforeEach(() => {
    repo = new MemoryDocumentsRepository();
  });

  it("creates a document with an initial version owned by the current user", async () => {
    const ctx = apiContext("owner");

    const result = await createDocument(
      ctx,
      { name: "Plan", description: null, html: "<h1>Plan</h1>" },
      repo,
    );

    expect(result.document).toMatchObject({
      id: expect.any(String),
      ownerUserId: "owner",
      name: "Plan",
      description: null,
      deletedAt: null,
    });
    expect(result.version).toMatchObject({
      id: expect.any(String),
      documentId: result.document.id,
      versionNumber: 1,
      html: "<h1>Plan</h1>",
      createdByUserId: "owner",
    });
  });

  it("gets the latest version when no version is requested", async () => {
    const ctx = apiContext("owner");
    const created = await seedDocument(ctx, "<p>v1</p>");
    await updateDocument(ctx, { id: created.document.id }, { html: "<p>v2</p>" }, repo);

    const result = await getDocument(ctx, { id: created.document.id }, {}, repo);

    expect(result.version.versionNumber).toBe(2);
    expect(result.version.html).toBe("<p>v2</p>");
  });

  it("gets a specific version when requested", async () => {
    const ctx = apiContext("owner");
    const created = await seedDocument(ctx, "<p>v1</p>");
    await updateDocument(ctx, { id: created.document.id }, { html: "<p>v2</p>" }, repo);

    const result = await getDocument(
      ctx,
      { id: created.document.id },
      { version: 1 },
      repo,
    );

    expect(result.version.versionNumber).toBe(1);
    expect(result.version.html).toBe("<p>v1</p>");
  });

  it("allows a user with a shared primary email to read", async () => {
    const ownerCtx = apiContext("owner");
    const created = await seedDocument(ownerCtx, "<p>shared</p>");
    await shareDocument(
      ownerCtx,
      { id: created.document.id },
      { emails: ["reader@example.com"] },
      repo,
    );

    const result = await getDocument(
      apiContext("reader", "reader@example.com"),
      { id: created.document.id },
      {},
      repo,
    );

    expect(result.document.id).toBe(created.document.id);
    expect(result.access).toBe("shared");
  });

  it("does not allow a shared user to update", async () => {
    const ownerCtx = apiContext("owner");
    const created = await seedDocument(ownerCtx, "<p>shared</p>");
    await shareDocument(
      ownerCtx,
      { id: created.document.id },
      { emails: ["reader@example.com"] },
      repo,
    );

    await expect(
      updateDocument(
        apiContext("reader", "reader@example.com"),
        { id: created.document.id },
        { html: "<p>edited</p>" },
        repo,
      ),
    ).rejects.toMatchObject({ status: 403, code: "forbidden" });
  });

  it("lets the owner update and increments the version number", async () => {
    const ctx = apiContext("owner");
    const created = await seedDocument(ctx, "<p>v1</p>");

    const updated = await updateDocument(
      ctx,
      { id: created.document.id },
      { html: "<p>v2</p>" },
      repo,
    );

    expect(updated.version.versionNumber).toBe(2);
    expect(updated.version.html).toBe("<p>v2</p>");
    expect(updated.document.updatedAt.getTime()).toBeGreaterThanOrEqual(
      created.document.updatedAt.getTime(),
    );
  });

  it("allows the owner or a shared user to share a document", async () => {
    const ownerCtx = apiContext("owner");
    const created = await seedDocument(ownerCtx, "<p>shared</p>");

    const ownerShare = await shareDocument(
      ownerCtx,
      { id: created.document.id },
      { emails: ["reader@example.com"] },
      repo,
    );
    const readerShare = await shareDocument(
      apiContext("reader", "reader@example.com"),
      { id: created.document.id },
      { emails: ["reviewer@example.com"] },
      repo,
    );

    expect(ownerShare.shares.map((share) => share.sharedWithEmail)).toContain(
      "reader@example.com",
    );
    expect(readerShare.shares.map((share) => share.sharedWithEmail)).toContain(
      "reviewer@example.com",
    );
  });

  it("lists all, owned, and shared documents for the current user", async () => {
    const ctx = apiContext("owner", "owner@example.com");
    const owned = await seedDocument(ctx, "<p>owned</p>", "Owned");
    const shared = await seedDocument(apiContext("other"), "<p>shared</p>", "Shared");
    await shareDocument(
      apiContext("other"),
      { id: shared.document.id },
      { emails: ["owner@example.com"] },
      repo,
    );

    await expect(listDocuments(ctx, { access: "owned" }, repo)).resolves.toMatchObject({
      documents: [{ id: owned.document.id, access: "owned" }],
    });
    await expect(listDocuments(ctx, { access: "shared" }, repo)).resolves.toMatchObject({
      documents: [{ id: shared.document.id, access: "shared" }],
    });

    const all = await listDocuments(ctx, { access: "all" }, repo);
    expect(all.documents.map((document) => document.id).sort()).toEqual(
      [owned.document.id, shared.document.id].sort(),
    );
  });

  it("does not include shared documents when the user has no primary email", async () => {
    const ownerlessEmailCtx = apiContext("owner", null);
    const owned = await seedDocument(ownerlessEmailCtx, "<p>owned</p>", "Owned");
    const shared = await seedDocument(apiContext("other"), "<p>shared</p>", "Shared");
    await shareDocument(
      apiContext("other"),
      { id: shared.document.id },
      { emails: ["owner@example.com"] },
      repo,
    );

    const all = await listDocuments(ownerlessEmailCtx, { access: "all" }, repo);

    expect(all.documents).toEqual([
      expect.objectContaining({ id: owned.document.id, access: "owned" }),
    ]);
  });

  async function seedDocument(
    ctx: ApiContext,
    html: string,
    name = "Seed",
  ) {
    return createDocument(ctx, { name, description: null, html }, repo);
  }
});

function apiContext(userId: string, email?: string | null): ApiContext {
  const now = new Date("2026-06-12T00:00:00.000Z");
  const primaryEmail = email === undefined ? `${userId}@example.com` : email;

  return {
    db: {} as ApiContext["db"],
    requestId: `req_${userId}`,
    user: {
      id: userId,
      clerkUserId: `clerk_${userId}`,
      primaryEmail: primaryEmail,
      firstName: null,
      lastName: null,
      imageUrl: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    } satisfies User,
    userEmail: primaryEmail,
  };
}

type StoredDocument = NewDocument & { deletedAt: Date | null };
type Access = "owned" | "shared";
type DocumentListItem = StoredDocument & { access: Access; latestVersion: NewDocumentVersion };

class MemoryDocumentsRepository {
  private documents = new Map<string, StoredDocument>();
  private versions = new Map<string, NewDocumentVersion[]>();
  private shares = new Map<string, NewDocumentShare[]>();
  private id = 0;

  async createDocument(input: {
    document: Omit<NewDocument, "id" | "createdAt" | "updatedAt" | "deletedAt">;
    version: Pick<NewDocumentVersion, "html" | "createdByUserId">;
  }) {
    const now = new Date(Date.now() + this.id);
    const document: StoredDocument = {
      id: this.nextId("doc"),
      ownerUserId: input.document.ownerUserId,
      name: input.document.name,
      description: input.document.description,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    const version: NewDocumentVersion = {
      id: this.nextId("ver"),
      documentId: document.id,
      versionNumber: 1,
      html: input.version.html,
      createdByUserId: input.version.createdByUserId,
      createdAt: now,
    };

    this.documents.set(document.id, document);
    this.versions.set(document.id, [version]);

    return { document, version };
  }

  async findDocumentById(id: string) {
    const document = this.documents.get(id);
    return document?.deletedAt ? null : document ?? null;
  }

  async findLatestVersion(documentId: string) {
    const versions = this.versions.get(documentId) ?? [];
    return versions.at(-1) ?? null;
  }

  async findVersion(documentId: string, versionNumber: number) {
    return (
      this.versions
        .get(documentId)
        ?.find((version) => version.versionNumber === versionNumber) ?? null
    );
  }

  async isSharedWithEmail(documentId: string, email: string) {
    return (
      this.shares
        .get(documentId)
        ?.some((share) => share.sharedWithEmail === email) ?? false
    );
  }

  async addVersion(input: {
    documentId: string;
    html: string;
    createdByUserId: string;
  }) {
    const document = this.documents.get(input.documentId);
    if (!document || document.deletedAt) {
      return null;
    }

    const now = new Date(Date.now() + this.id);
    const versions = this.versions.get(input.documentId) ?? [];
    const version: NewDocumentVersion = {
      id: this.nextId("ver"),
      documentId: input.documentId,
      versionNumber: versions.length + 1,
      html: input.html,
      createdByUserId: input.createdByUserId,
      createdAt: now,
    };
    const updatedDocument = { ...document, updatedAt: now };

    versions.push(version);
    this.versions.set(input.documentId, versions);
    this.documents.set(input.documentId, updatedDocument);

    return { document: updatedDocument, version };
  }

  async upsertShares(input: {
    documentId: string;
    emails: string[];
    sharedByUserId: string;
  }) {
    const existing = this.shares.get(input.documentId) ?? [];
    const now = new Date(Date.now() + this.id);
    const added = input.emails
      .filter(
        (email) => !existing.some((share) => share.sharedWithEmail === email),
      )
      .map((email): NewDocumentShare => ({
        id: this.nextId("share"),
        documentId: input.documentId,
        sharedWithEmail: email,
        sharedByUserId: input.sharedByUserId,
        createdAt: now,
      }));

    this.shares.set(input.documentId, [...existing, ...added]);
    return this.shares.get(input.documentId) ?? [];
  }

  async listDocuments(input: {
    ownerUserId: string;
    sharedWithEmail: string | null;
    access: "all" | "owned" | "shared";
  }) {
    const items: DocumentListItem[] = [];

    for (const document of this.documents.values()) {
      if (document.deletedAt) {
        continue;
      }

      const isOwned = document.ownerUserId === input.ownerUserId;
      const isShared =
        input.sharedWithEmail === null
          ? false
          : await this.isSharedWithEmail(document.id, input.sharedWithEmail);

      if (
        (input.access === "owned" && !isOwned) ||
        (input.access === "shared" && !isShared) ||
        (input.access === "all" && !isOwned && !isShared)
      ) {
        continue;
      }

      const latestVersion = await this.findLatestVersion(document.id);
      if (!latestVersion) {
        continue;
      }

      items.push({
        ...document,
        access: isOwned ? "owned" : "shared",
        latestVersion,
      });
    }

    return items;
  }

  private nextId(prefix: string) {
    this.id += 1;
    return `${prefix}_${this.id}`;
  }
}
