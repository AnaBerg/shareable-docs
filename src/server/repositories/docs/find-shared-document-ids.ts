import { eq } from "drizzle-orm";

import { documentShares } from "@/db";
import { normalizeEmail } from "@/server/foundation/helpers/email";
import type { DocumentsDatabase } from "@/types/docs-repository";

export async function findSharedDocumentIds(
  db: DocumentsDatabase,
  email: string,
) {
  const normalizedEmail = normalizeEmail(email);
  if (normalizedEmail === null) {
    return [];
  }

  const rows = await db
    .select({ documentId: documentShares.documentId })
    .from(documentShares)
    .where(eq(documentShares.sharedWithEmail, normalizedEmail));

  return rows.map((row) => row.documentId);
}
