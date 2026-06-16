import { isSharedWithEmail } from "@/server/repositories/docs/is-shared-with-email";
import type { ApiContext } from "@/server/foundation/context";
import type { DocumentAccess } from "@/types/docs-repository";

export async function resolveDocumentAccess(
  ctx: ApiContext,
  document: { id: string; ownerUserId: string },
): Promise<DocumentAccess | null> {
  if (document.ownerUserId === ctx.user.id) {
    return "owned";
  }

  const hasSharedAccess =
    ctx.userEmail !== null
      ? await isSharedWithEmail(ctx.db, document.id, ctx.userEmail)
      : false;

  if (hasSharedAccess) {
    return "shared";
  }

  return null;
}
