import { findDocumentById } from "@/server/repositories/docs/find-document-by-id";
import { revokeShareLink as revokeShareLinkRow } from "@/server/repositories/docs/revoke-share-link";
import type { ApiContext } from "@/server/foundation/context";
import { forbiddenError, notFoundError } from "@/server/foundation/errors";
import { resolveDocumentAccess } from "@/server/foundation/helpers/resolve-document-access";
import type { DocumentRouteParams } from "@/types/docs";

export async function revokeShareLink(
  ctx: ApiContext,
  params: DocumentRouteParams,
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
    throw forbiddenError("Only document owners can manage share links");
  }

  const link = await revokeShareLinkRow(ctx.db, document.id);

  ctx.log.add({
    documentId: document.id,
    documentAccess: access,
    shareLinkRevoked: link !== null,
  });

  return { document, access, revoked: link !== null };
}
