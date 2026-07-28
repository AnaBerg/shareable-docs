import { findDocumentById } from "@/server/repositories/docs/find-document-by-id";
import { upsertShareLink } from "@/server/repositories/docs/upsert-share-link";
import type { ApiContext } from "@/server/foundation/context";
import {
  conflictError,
  forbiddenError,
  notFoundError,
} from "@/server/foundation/errors";
import { isUniqueViolation } from "@/server/foundation/helpers/db-errors";
import { resolveDocumentAccess } from "@/server/foundation/helpers/resolve-document-access";
import { createShareToken } from "@/server/foundation/helpers/share-token";
import type { DocumentRouteParams } from "@/types/docs";

export async function createShareLink(
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

  // Only the hash is persisted; the plaintext token exists solely in this
  // response. Creating a new link revokes any previous one (rotation).
  const { token, tokenHash } = createShareToken();
  const link = await upsertShareLinkOrConflict(ctx, {
    documentId: document.id,
    tokenHash,
    createdByUserId: ctx.user.id,
  });

  ctx.log.add({
    documentId: document.id,
    documentAccess: access,
    shareLinkId: link.id,
  });

  return { document, link, token, access };
}

async function upsertShareLinkOrConflict(
  ctx: ApiContext,
  input: {
    documentId: string;
    tokenHash: string;
    createdByUserId: string;
  },
) {
  try {
    // A partial unique index allows only one active link per document, so a
    // losing concurrent rotation fails with a unique violation.
    return await upsertShareLink(ctx.db, input);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflictError("Share link was rotated concurrently");
    }

    throw error;
  }
}
