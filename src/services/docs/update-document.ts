import { createDocumentsRepository, type DocumentsRepository } from "@/repository/docs/documents";
import type { ApiContext } from "@/server/foundation/context";
import {
  conflictError,
  forbiddenError,
  notFoundError,
} from "@/server/foundation/errors";
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

  const updated = await addVersionOrConflict(repository, {
    documentId: document.id,
    html: input.html,
    createdByUserId: ctx.user.id,
  });

  if (!updated) {
    throw notFoundError("Document not found");
  }

  return updated;
}

async function addVersionOrConflict(
  repository: DocumentsRepository,
  input: {
    documentId: string;
    html: string;
    createdByUserId: string;
  },
) {
  try {
    return await repository.addVersion(input);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflictError("Document version conflict");
    }

    throw error;
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}
