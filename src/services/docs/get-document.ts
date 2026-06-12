import {
  createDocumentsRepository,
  type DocumentAccess,
  type DocumentsRepository,
} from "@/repository/docs/documents";
import type { ApiContext } from "@/server/foundation/context";
import { forbiddenError, notFoundError } from "@/server/foundation/errors";
import type { DocumentRouteParams, GetDocumentQuery } from "@/types/docs";

export async function getDocument(
  ctx: ApiContext,
  params: DocumentRouteParams,
  query: GetDocumentQuery,
  repository: DocumentsRepository = createDocumentsRepository(ctx.db),
) {
  const document = await repository.findDocumentById(params.id);
  if (!document) {
    throw notFoundError("Document not found");
  }

  const access = await resolveReadAccess(ctx, repository, document);
  if (!access) {
    throw forbiddenError("Document access denied");
  }

  const latestVersion = await repository.findLatestVersion(document.id);
  const version =
    query.version === undefined
      ? latestVersion
      : await repository.findVersion(document.id, query.version);

  if (!version || !latestVersion) {
    throw notFoundError("Document version not found");
  }

  return { document, version, latestVersion, access };
}

async function resolveReadAccess(
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
