import { and, eq, isNull } from "drizzle-orm";

import { documentShareLinks, documents } from "@/db";
import type { DocumentsDatabase } from "@/types/docs-repository";

export async function findDocumentByShareToken(
  db: DocumentsDatabase,
  tokenHash: string,
) {
  const [row] = await db
    .select({ document: documents })
    .from(documentShareLinks)
    .innerJoin(documents, eq(documents.id, documentShareLinks.documentId))
    .where(
      and(
        eq(documentShareLinks.tokenHash, tokenHash),
        isNull(documentShareLinks.revokedAt),
        isNull(documents.deletedAt),
      ),
    )
    .limit(1);

  return row?.document ?? null;
}
