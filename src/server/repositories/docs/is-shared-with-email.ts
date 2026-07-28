import { and, eq } from "drizzle-orm";

import { documentShares } from "@/db";
import { normalizeEmail } from "@/server/foundation/helpers/email";
import type { DocumentsDatabase } from "@/types/docs-repository";

export async function isSharedWithEmail(
  db: DocumentsDatabase,
  documentId: string,
  email: string,
) {
  const normalizedEmail = normalizeEmail(email);
  if (normalizedEmail === null) {
    return false;
  }

  const [share] = await db
    .select({ id: documentShares.id })
    .from(documentShares)
    .where(
      and(
        eq(documentShares.documentId, documentId),
        eq(documentShares.sharedWithEmail, normalizedEmail),
      ),
    )
    .limit(1);

  return share !== undefined;
}
