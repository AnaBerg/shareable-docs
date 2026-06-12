import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";

import {
  documentShares,
  documents,
  documentVersions,
  type Document,
  type DocumentShare,
  type DocumentVersion,
  type NewDocument,
  type NewDocumentShare,
  type NewDocumentVersion,
} from "@/db";
import type { ApiContext } from "@/server/foundation/context";
import {
  newDocumentSchema,
  newDocumentShareSchema,
  newDocumentVersionSchema,
} from "@/types/docs";

export type DocumentAccess = "owned" | "shared";

export type DocumentListItem = Document & {
  access: DocumentAccess;
  latestVersion: DocumentVersion;
};

export type DocumentsRepository = {
  createDocument(input: {
    document: Omit<NewDocument, "id" | "createdAt" | "updatedAt" | "deletedAt">;
    version: Pick<NewDocumentVersion, "html" | "createdByUserId">;
  }): Promise<{ document: Document; version: DocumentVersion }>;
  findDocumentById(id: string): Promise<Document | null>;
  findLatestVersion(documentId: string): Promise<DocumentVersion | null>;
  findVersion(
    documentId: string,
    versionNumber: number,
  ): Promise<DocumentVersion | null>;
  isSharedWithEmail(documentId: string, email: string): Promise<boolean>;
  addVersion(input: {
    documentId: string;
    html: string;
    createdByUserId: string;
  }): Promise<{ document: Document; version: DocumentVersion } | null>;
  upsertShares(input: {
    documentId: string;
    emails: string[];
    sharedByUserId: string;
  }): Promise<DocumentShare[]>;
  listDocuments(input: {
    ownerUserId: string;
    sharedWithEmail: string | null;
    access: "all" | "owned" | "shared";
  }): Promise<DocumentListItem[]>;
};

type DocumentsDatabase = ApiContext["db"];

export function createDocumentsRepository(db: DocumentsDatabase): DocumentsRepository {
  return {
    async createDocument(input) {
      return db.transaction(async (tx) => {
        const now = new Date();
        const newDocument = newDocumentSchema.parse({
          id: crypto.randomUUID(),
          ...input.document,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        });
        const [document] = await tx
          .insert(documents)
          .values(newDocument)
          .returning();

        const newVersion = newDocumentVersionSchema.parse({
          id: crypto.randomUUID(),
          documentId: document.id,
          versionNumber: 1,
          html: input.version.html,
          createdByUserId: input.version.createdByUserId,
          createdAt: now,
        });
        const [version] = await tx
          .insert(documentVersions)
          .values(newVersion)
          .returning();

        return { document, version };
      });
    },

    async findDocumentById(id) {
      const [document] = await db
        .select()
        .from(documents)
        .where(and(eq(documents.id, id), isNull(documents.deletedAt)))
        .limit(1);

      return document ?? null;
    },

    async findLatestVersion(documentId) {
      const [version] = await db
        .select()
        .from(documentVersions)
        .where(eq(documentVersions.documentId, documentId))
        .orderBy(desc(documentVersions.versionNumber))
        .limit(1);

      return version ?? null;
    },

    async findVersion(documentId, versionNumber) {
      const [version] = await db
        .select()
        .from(documentVersions)
        .where(
          and(
            eq(documentVersions.documentId, documentId),
            eq(documentVersions.versionNumber, versionNumber),
          ),
        )
        .limit(1);

      return version ?? null;
    },

    async isSharedWithEmail(documentId, email) {
      const [share] = await db
        .select({ id: documentShares.id })
        .from(documentShares)
        .where(
          and(
            eq(documentShares.documentId, documentId),
            eq(documentShares.sharedWithEmail, email),
          ),
        )
        .limit(1);

      return share !== undefined;
    },

    async addVersion(input) {
      return db.transaction(async (tx) => {
        const [document] = await tx
          .select()
          .from(documents)
          .where(
            and(eq(documents.id, input.documentId), isNull(documents.deletedAt)),
          )
          .limit(1);

        if (!document) {
          return null;
        }

        const [latestVersion] = await tx
          .select()
          .from(documentVersions)
          .where(eq(documentVersions.documentId, input.documentId))
          .orderBy(desc(documentVersions.versionNumber))
          .limit(1);

        const now = new Date();
        const newVersion = newDocumentVersionSchema.parse({
          id: crypto.randomUUID(),
          documentId: input.documentId,
          versionNumber: (latestVersion?.versionNumber ?? 0) + 1,
          html: input.html,
          createdByUserId: input.createdByUserId,
          createdAt: now,
        });
        const [version] = await tx
          .insert(documentVersions)
          .values(newVersion)
          .returning();

        const [updatedDocument] = await tx
          .update(documents)
          .set({ updatedAt: now })
          .where(eq(documents.id, input.documentId))
          .returning();

        return { document: updatedDocument, version };
      });
    },

    async upsertShares(input) {
      if (input.emails.length > 0) {
        await db
          .insert(documentShares)
          .values(
            input.emails.map(
              (email): NewDocumentShare =>
                newDocumentShareSchema.parse({
                  id: crypto.randomUUID(),
                  documentId: input.documentId,
                  sharedWithEmail: email,
                  sharedByUserId: input.sharedByUserId,
                  createdAt: new Date(),
                }),
            ),
          )
          .onConflictDoNothing({
            target: [documentShares.documentId, documentShares.sharedWithEmail],
          });
      }

      return db
        .select()
        .from(documentShares)
        .where(eq(documentShares.documentId, input.documentId));
    },

    async listDocuments(input) {
      const ownedCondition = eq(documents.ownerUserId, input.ownerUserId);
      const sharedDocumentIds =
        input.sharedWithEmail === null
          ? []
          : await findSharedDocumentIds(db, input.sharedWithEmail);

      const accessCondition =
        input.access === "owned"
          ? ownedCondition
          : input.access === "shared"
            ? sharedDocumentIds.length === 0
              ? undefined
              : inArray(documents.id, sharedDocumentIds)
            : sharedDocumentIds.length === 0
              ? ownedCondition
              : or(ownedCondition, inArray(documents.id, sharedDocumentIds));

      if (!accessCondition) {
        return [];
      }

      const rows = await db
        .select()
        .from(documents)
        .where(and(isNull(documents.deletedAt), accessCondition))
        .orderBy(desc(documents.updatedAt));

      const items: DocumentListItem[] = [];
      for (const document of rows) {
        const latestVersion = await this.findLatestVersion(document.id);
        if (!latestVersion) {
          continue;
        }

        items.push({
          ...document,
          access:
            document.ownerUserId === input.ownerUserId ? "owned" : "shared",
          latestVersion,
        });
      }

      return items;
    },
  };
}

async function findSharedDocumentIds(db: DocumentsDatabase, email: string) {
  const rows = await db
    .select({ documentId: documentShares.documentId })
    .from(documentShares)
    .where(eq(documentShares.sharedWithEmail, email));

  return rows.map((row) => row.documentId);
}
