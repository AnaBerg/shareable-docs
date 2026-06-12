import { createDocumentsRepository, type DocumentsRepository } from "@/repository/docs/documents";
import type { ApiContext } from "@/server/foundation/context";
import type { CreateDocumentRequest } from "@/types/docs";

export async function createDocument(
  ctx: ApiContext,
  input: CreateDocumentRequest,
  repository: DocumentsRepository = createDocumentsRepository(ctx.db),
) {
  return repository.createDocument({
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
