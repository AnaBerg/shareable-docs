import { and, eq, isNull } from "drizzle-orm";

import { documents } from "@/db";

import type { DocumentsDatabase } from "./types";

export async function findDocumentById(db: DocumentsDatabase, id: string) {
  const [document] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, id), isNull(documents.deletedAt)))
    .limit(1);

  return document ?? null;
}
