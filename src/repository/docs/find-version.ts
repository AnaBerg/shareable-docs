import { and, eq } from "drizzle-orm";

import { documentVersions } from "@/db";

import type { DocumentsDatabase } from "./types";

export async function findVersion(
  db: DocumentsDatabase,
  documentId: string,
  versionNumber: number,
) {
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
}
