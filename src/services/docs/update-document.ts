import { createDocumentsRepository, type DocumentsRepository } from "@/repository/docs/documents";
import type { ApiContext } from "@/server/foundation/context";
import { forbiddenError, notFoundError } from "@/server/foundation/errors";
import type { DocumentRouteParams, UpdateDocumentRequest } from "@/types/docs";

export async function updateDocument(
  ctx: ApiContext,
  params: DocumentRouteParams,
  input: UpdateDocumentRequest,
  repository: DocumentsRepository = createDocumentsRepository(ctx.db),
) {
  const document = await repository.findDocumentById(params.id);
  if (!document) {
    throw notFoundError("Document not found");
  }

  if (document.ownerUserId !== ctx.user.id) {
    throw forbiddenError("Only the document owner can update it");
  }

  const updated = await repository.addVersion({
    documentId: document.id,
    html: input.html,
    createdByUserId: ctx.user.id,
  });

  if (!updated) {
    throw notFoundError("Document not found");
  }

  return updated;
}
