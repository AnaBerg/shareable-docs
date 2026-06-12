import {
  createDocumentsRepository,
  type DocumentAccess,
  type DocumentsRepository,
} from "@/repository/docs/documents";
import type { ApiContext } from "@/server/foundation/context";
import { forbiddenError, notFoundError } from "@/server/foundation/errors";
import type { DocumentRouteParams, ShareDocumentRequest } from "@/types/docs";

export async function shareDocument(
  ctx: ApiContext,
  params: DocumentRouteParams,
  input: ShareDocumentRequest,
  repository: DocumentsRepository = createDocumentsRepository(ctx.db),
) {
  const document = await repository.findDocumentById(params.id);
  if (!document) {
    throw notFoundError("Document not found");
  }

  const access = await resolveShareAccess(ctx, repository, document);
  if (!access) {
    throw forbiddenError("Document access denied");
  }

  const shares = await repository.upsertShares({
    documentId: document.id,
    emails: input.emails,
    sharedByUserId: ctx.user.id,
  });

  return { document, shares, access };
}

async function resolveShareAccess(
  ctx: ApiContext,
  repository: DocumentsRepository,
  document: { id: string; ownerUserId: string },
): Promise<DocumentAccess | null> {
  if (document.ownerUserId === ctx.user.id) {
    return "owned";
  }

  if (
    ctx.userEmail !== null &&
    (await repository.isSharedWithEmail(document.id, ctx.userEmail))
  ) {
    return "shared";
  }

  return null;
}
