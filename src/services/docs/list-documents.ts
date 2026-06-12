import { createDocumentsRepository, type DocumentsRepository } from "@/repository/docs/documents";
import type { ApiContext } from "@/server/foundation/context";
import type { ListDocumentsQuery } from "@/types/docs";

export async function listDocuments(
  ctx: ApiContext,
  query: ListDocumentsQuery,
  repository: DocumentsRepository = createDocumentsRepository(ctx.db),
) {
  const documents = await repository.listDocuments({
    ownerUserId: ctx.user.id,
    sharedWithEmail: ctx.userEmail,
    access: query.access,
  });

  return { documents };
}
