import { and, eq, isNull } from "drizzle-orm";

import { documentShareLinks } from "@/db";
import type { DocumentsDatabase } from "@/types/docs-repository";

export async function revokeShareLink(
  db: DocumentsDatabase,
  documentId: string,
) {
  const [link] = await db
    .update(documentShareLinks)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(documentShareLinks.documentId, documentId),
        isNull(documentShareLinks.revokedAt),
      ),
    )
    .returning();

  return link ?? null;
}
