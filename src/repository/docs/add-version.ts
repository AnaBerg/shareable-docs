import { and, desc, eq, isNull } from "drizzle-orm";

import { documentVersions, documents } from "@/db";
import { newDocumentVersionSchema } from "@/types/docs";

import { createUlid } from "./ids";
import type { AddVersionInput, DocumentsDatabase } from "./types";

export async function addDocumentVersion(
  db: DocumentsDatabase,
  input: AddVersionInput,
) {
  return db.transaction(async (tx) => {
    const [document] = await tx
      .select()
      .from(documents)
      .where(and(eq(documents.id, input.documentId), isNull(documents.deletedAt)))
      .for("update")
      .limit(1);

    if (!document) {
      return null;
    }

    const [latestVersion] = await tx
      .select()
      .from(documentVersions)
      .where(eq(documentVersions.documentId, input.documentId))
      .orderBy(desc(documentVersions.versionNumber))
      .limit(1);

    const now = new Date();
    const newVersion = newDocumentVersionSchema.parse({
      id: createUlid(),
      documentId: input.documentId,
      versionNumber: (latestVersion?.versionNumber ?? 0) + 1,
      html: input.html,
      createdByUserId: input.createdByUserId,
      createdAt: now,
    });
    const [version] = await tx
      .insert(documentVersions)
      .values(newVersion)
      .returning();

    const [updatedDocument] = await tx
      .update(documents)
      .set({ updatedAt: now })
      .where(eq(documents.id, input.documentId))
      .returning();

    return { document: updatedDocument, version };
  });
}
