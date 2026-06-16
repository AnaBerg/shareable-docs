import { desc, inArray } from "drizzle-orm";

import { documentVersions } from "@/db";
import type { DocumentsDatabase } from "@/types/docs-repository";

export async function findLatestVersionsForDocuments(
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
