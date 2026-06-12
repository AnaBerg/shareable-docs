import { desc, eq } from "drizzle-orm";

import { documentVersions } from "@/db";

import type { DocumentsDatabase } from "./types";

export async function findLatestVersion(
  db: DocumentsDatabase,
  documentId: string,
) {
  const [version] = await db
    .select()
    .from(documentVersions)
    .where(eq(documentVersions.documentId, documentId))
    .orderBy(desc(documentVersions.versionNumber))
    .limit(1);

  return version ?? null;
}
