import { and, eq, inArray, max } from "drizzle-orm";

import { documentVersions, type DocumentVersion } from "@/db";
import type { DocumentsDatabase } from "@/types/docs-repository";

export async function findLatestVersionsForDocuments(
  db: DocumentsDatabase,
  documentIds: string[],
): Promise<Map<string, DocumentVersion>> {
  if (documentIds.length === 0) {
    return new Map<string, DocumentVersion>();
  }

  const latestVersionNumbers = db
    .select({
      documentId: documentVersions.documentId,
      versionNumber: max(documentVersions.versionNumber).as("version_number"),
    })
    .from(documentVersions)
    .where(inArray(documentVersions.documentId, documentIds))
    .groupBy(documentVersions.documentId)
    .as("latest_version_numbers");

  const rows = await db
    .select()
    .from(documentVersions)
    .innerJoin(
      latestVersionNumbers,
      and(
        eq(documentVersions.documentId, latestVersionNumbers.documentId),
        eq(documentVersions.versionNumber, latestVersionNumbers.versionNumber),
      ),
    )
    .where(inArray(documentVersions.documentId, documentIds));

  const latestVersions = new Map<string, DocumentVersion>();

  for (const row of rows) {
    latestVersions.set(row.document_versions.documentId, row.document_versions);
  }

  return latestVersions;
}
