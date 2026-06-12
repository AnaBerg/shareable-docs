import { documentVersions, documents } from "@/db";
import {
  newDocumentSchema,
  newDocumentVersionSchema,
} from "@/types/docs";

import { createUlid } from "./ids";
import type { CreateDocumentInput, DocumentsDatabase } from "./types";

export async function createDocumentRecord(
  db: DocumentsDatabase,
  input: CreateDocumentInput,
) {
  return db.transaction(async (tx) => {
    const now = new Date();
    const newDocument = newDocumentSchema.parse({
      id: createUlid(),
      ...input.document,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
    const [document] = await tx
      .insert(documents)
      .values(newDocument)
      .returning();

    const newVersion = newDocumentVersionSchema.parse({
      id: createUlid(),
      documentId: document.id,
      versionNumber: 1,
      html: input.version.html,
      createdByUserId: input.version.createdByUserId,
      createdAt: now,
    });
    const [version] = await tx
      .insert(documentVersions)
      .values(newVersion)
      .returning();

    return { document, version };
  });
}
