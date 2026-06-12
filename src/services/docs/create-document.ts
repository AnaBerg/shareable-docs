import { createDocumentRecord } from "@/repository/docs/create-document";
import type { ApiContext } from "@/server/foundation/context";
import type { CreateDocumentRequest } from "@/types/docs";

export async function createDocument(
  ctx: ApiContext,
  input: CreateDocumentRequest,
) {
  return createDocumentRecord(ctx.db, {
    document: {
      ownerUserId: ctx.user.id,
      name: input.name,
      description: input.description,
    },
    version: {
      html: input.html,
      createdByUserId: ctx.user.id,
    },
  });
}
