import { eq } from "drizzle-orm";

import { documentShares, type NewDocumentShare } from "@/db";
import { createUlid } from "@/server/foundation/ulid";
import { newDocumentShareSchema } from "@/types/docs";
import type {
  DocumentsDatabase,
  ShareDocumentInput,
  ShareDocumentResult,
} from "@/types/docs-repository";

export async function upsertDocumentShares(
  db: DocumentsDatabase,
  input: ShareDocumentInput,
): Promise<ShareDocumentResult> {
  if (input.emails.length > 0) {
    await db
      .insert(documentShares)
      .values(
        input.emails.map(
          (email): NewDocumentShare =>
            newDocumentShareSchema.parse({
              id: createUlid(),
              documentId: input.documentId,
              sharedWithEmail: email,
              sharedByUserId: input.sharedByUserId,
              createdAt: new Date(),
            }),
        ),
      )
      .onConflictDoNothing({
        target: [documentShares.documentId, documentShares.sharedWithEmail],
      });
  }

  return db
    .select()
    .from(documentShares)
    .where(eq(documentShares.documentId, input.documentId));
}
