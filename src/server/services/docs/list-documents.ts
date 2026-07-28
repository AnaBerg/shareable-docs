import { listAccessibleDocuments } from "@/server/repositories/docs/list-documents";
import type { ApiContext } from "@/server/foundation/context";
import type { ListDocumentsQuery } from "@/types/docs";

export async function listDocuments(
  ctx: ApiContext,
  query: ListDocumentsQuery,
) {
  const documents = await listAccessibleDocuments(ctx.db, {
    ownerUserId: ctx.user.id,
    sharedWithEmail: ctx.userEmail,
    access: query.access,
  });

  ctx.log.add({
    listAccess: query.access,
    documentCount: documents.length,
  });

  return { documents };
}
