import { findDocumentById } from "@/repository/docs/find-document-by-id";
import { upsertDocumentShares } from "@/repository/docs/upsert-shares";
import type { ApiContext } from "@/server/foundation/context";
import { forbiddenError, notFoundError } from "@/server/foundation/errors";
import type { DocumentRouteParams, ShareDocumentRequest } from "@/types/docs";

import { resolveDocumentAccess } from "./resolve-access";

export async function shareDocument(
  ctx: ApiContext,
  params: DocumentRouteParams,
  input: ShareDocumentRequest,
) {
  const document = await findDocumentById(ctx.db, params.id);
  if (!document) {
    throw notFoundError("Document not found");
  }

  const access = await resolveDocumentAccess(ctx, document);
  if (!access) {
    throw forbiddenError("Document access denied");
  }

  const shares = await upsertDocumentShares(ctx.db, {
    documentId: document.id,
    emails: input.emails,
    sharedByUserId: ctx.user.id,
  });

  return { document, shares, access };
}
