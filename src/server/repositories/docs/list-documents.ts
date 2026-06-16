import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";

import { documents } from "@/db";
import type {
  DocumentListItem,
  DocumentsDatabase,
  ListDocumentsInput,
} from "@/types/docs-repository";

import { findLatestVersionsForDocuments } from "./find-latest-versions-for-documents";
import { findSharedDocumentIds } from "./find-shared-document-ids";

export async function listAccessibleDocuments(
  db: DocumentsDatabase,
  input: ListDocumentsInput,
): Promise<DocumentListItem[]> {
  const ownedCondition = eq(documents.ownerUserId, input.ownerUserId);
  const shouldResolveSharedIds = input.access !== "owned";
  const sharedDocumentIds =
    !shouldResolveSharedIds || input.sharedWithEmail === null
      ? []
      : await findSharedDocumentIds(db, input.sharedWithEmail);

  let accessCondition;

  if (input.access === "owned") {
    accessCondition = ownedCondition;
  } else if (input.access === "shared") {
    accessCondition =
      sharedDocumentIds.length === 0
        ? undefined
        : inArray(documents.id, sharedDocumentIds);
  } else if (sharedDocumentIds.length === 0) {
    accessCondition = ownedCondition;
  } else {
    accessCondition = or(ownedCondition, inArray(documents.id, sharedDocumentIds));
  }

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
