import { and, eq } from "drizzle-orm";

import { documentShares } from "@/db";
import type { DocumentsDatabase } from "@/types/docs-repository";

export async function isSharedWithEmail(
  db: DocumentsDatabase,
  documentId: string,
  email: string,
) {
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
}
