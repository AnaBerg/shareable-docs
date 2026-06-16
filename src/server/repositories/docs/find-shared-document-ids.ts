import { eq } from "drizzle-orm";

import { documentShares } from "@/db";
import type { DocumentsDatabase } from "@/types/docs-repository";

export async function findSharedDocumentIds(
  db: DocumentsDatabase,
  email: string,
) {
  const rows = await db
    .select({ documentId: documentShares.documentId })
    .from(documentShares)
    .where(eq(documentShares.sharedWithEmail, email));

  return rows.map((row) => row.documentId);
}
