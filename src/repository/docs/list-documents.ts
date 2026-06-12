import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";

import { documentShares, documents, documentVersions } from "@/db";

import type {
  DocumentListItem,
  DocumentsDatabase,
  ListDocumentsInput,
} from "./types";

export async function listAccessibleDocuments(
  db: DocumentsDatabase,
  input: ListDocumentsInput,
): Promise<DocumentListItem[]> {
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

  const latestVersions = await findLatestVersionsForDocuments(
    db,
    rows.map((document) => document.id),
  );

  return rows.flatMap((document) => {
    const latestVersion = latestVersions.get(document.id);

    if (!latestVersion) {
      return [];
    }

    return {
      ...document,
      access: document.ownerUserId === input.ownerUserId ? "owned" : "shared",
      latestVersion,
    };
  });
}

async function findSharedDocumentIds(db: DocumentsDatabase, email: string) {
  const rows = await db
    .select({ documentId: documentShares.documentId })
    .from(documentShares)
    .where(eq(documentShares.sharedWithEmail, email));

  return rows.map((row) => row.documentId);
}

async function findLatestVersionsForDocuments(
  db: DocumentsDatabase,
  documentIds: string[],
) {
  if (documentIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .select()
    .from(documentVersions)
    .where(inArray(documentVersions.documentId, documentIds))
    .orderBy(desc(documentVersions.versionNumber));

  const latestVersions = new Map<string, (typeof rows)[number]>();

  for (const version of rows) {
    if (!latestVersions.has(version.documentId)) {
      latestVersions.set(version.documentId, version);
    }
  }

  return latestVersions;
}
