import { and, eq, inArray, max } from "drizzle-orm";

import { documentVersions } from "@/db";
import type { DocumentsDatabase } from "@/types/docs-repository";

export async function findLatestVersionsForDocuments(
  db: DocumentsDatabase,
  documentIds: string[],
) {
  if (documentIds.length === 0) {
    return new Map();
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
    );

  const latestVersions = new Map<string, typeof documentVersions.$inferSelect>();

  for (const row of rows) {
    latestVersions.set(row.document_versions.documentId, row.document_versions);
  }

  return latestVersions;
}
