import { isSharedWithEmail } from "@/repository/docs/is-shared-with-email";
import type { DocumentAccess } from "@/repository/docs/types";
import type { ApiContext } from "@/server/foundation/context";

export async function resolveDocumentAccess(
  ctx: ApiContext,
  document: { id: string; ownerUserId: string },
): Promise<DocumentAccess | null> {
  if (document.ownerUserId === ctx.user.id) {
    return "owned";
  }

  if (
    ctx.userEmail !== null &&
    (await isSharedWithEmail(ctx.db, document.id, ctx.userEmail))
  ) {
    return "shared";
  }

  return null;
}
