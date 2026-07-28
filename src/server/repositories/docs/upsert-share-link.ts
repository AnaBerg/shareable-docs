import { and, eq, isNull } from "drizzle-orm";

import { documentShareLinks } from "@/db";
import { createUlid } from "@/server/foundation/ulid";
import { newDocumentShareLinkSchema } from "@/types/docs";
import type {
  DocumentsDatabase,
  UpsertShareLinkInput,
} from "@/types/docs-repository";

export async function upsertShareLink(
  db: DocumentsDatabase,
  input: UpsertShareLinkInput,
) {
  return db.transaction(async (tx) => {
    const now = new Date();

    await tx
      .update(documentShareLinks)
      .set({ revokedAt: now })
      .where(
        and(
          eq(documentShareLinks.documentId, input.documentId),
          isNull(documentShareLinks.revokedAt),
        ),
      );

    const newLink = newDocumentShareLinkSchema.parse({
      id: createUlid(),
      documentId: input.documentId,
      tokenHash: input.tokenHash,
      createdByUserId: input.createdByUserId,
      createdAt: now,
    });
    const [link] = await tx
      .insert(documentShareLinks)
      .values(newLink)
      .returning();

    return link;
  });
}
