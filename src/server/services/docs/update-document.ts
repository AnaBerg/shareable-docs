import { addDocumentVersion } from "@/server/repositories/docs/add-version";
import { findDocumentById } from "@/server/repositories/docs/find-document-by-id";
import type { ApiContext } from "@/server/foundation/context";
import {
  conflictError,
  forbiddenError,
  notFoundError,
} from "@/server/foundation/errors";
import { isUniqueViolation } from "@/server/foundation/helpers/db-errors";
import type { DocumentRouteParams, UpdateDocumentRequest } from "@/types/docs";

export async function updateDocument(
  ctx: ApiContext,
  params: DocumentRouteParams,
  input: UpdateDocumentRequest,
) {
  const document = await findDocumentById(ctx.db, params.id);
  if (!document) {
    throw notFoundError("Document not found");
  }

  if (document.ownerUserId !== ctx.user.id) {
    throw forbiddenError("Only the document owner can update it");
  }

  const updated = await addVersionOrConflict(ctx, {
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
  ctx: ApiContext,
  input: {
    documentId: string;
    html: string;
    createdByUserId: string;
  },
) {
  try {
    return await addDocumentVersion(ctx.db, input);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflictError("Document version conflict");
    }

    throw error;
  }
}
