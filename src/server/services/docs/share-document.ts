import { findDocumentById } from "@/server/repositories/docs/find-document-by-id";
import { upsertDocumentShares } from "@/server/repositories/docs/upsert-shares";
import type { ApiContext } from "@/server/foundation/context";
import { forbiddenError, notFoundError } from "@/server/foundation/errors";
import { resolveDocumentAccess } from "@/server/foundation/helpers/resolve-document-access";
import type { DocumentRouteParams, ShareDocumentRequest } from "@/types/docs";

export async function shareDocument(
  ctx: ApiContext,
  params: DocumentRouteParams,
  input: ShareDocumentRequest,
) {
  const document = await findDocumentById(ctx.db, params.id);
  if (!document) {
    throw notFoundError("Document not found");
  }

  const access = await resolveDocumentAccess(
    { db: ctx.db, viewer: { kind: "user", userId: ctx.user.id, email: ctx.userEmail } },
    document,
  );
  if (access !== "owned") {
    throw forbiddenError("Only document owners can share");
  }

  const shares = await upsertDocumentShares(ctx.db, {
    documentId: document.id,
    emails: input.emails,
    sharedByUserId: ctx.user.id,
  });

  ctx.log.add({
    documentId: document.id,
    documentAccess: access,
    shareCount: shares.length,
  });

  return { document, shares, access };
}
