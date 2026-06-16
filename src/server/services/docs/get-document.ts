import { findDocumentById } from "@/server/repositories/docs/find-document-by-id";
import { findLatestVersion } from "@/server/repositories/docs/find-latest-version";
import { findVersion } from "@/server/repositories/docs/find-version";
import type { ApiContext } from "@/server/foundation/context";
import { forbiddenError, notFoundError } from "@/server/foundation/errors";
import type { DocumentRouteParams, GetDocumentQuery } from "@/types/docs";

import { resolveDocumentAccess } from "./resolve-access";

export async function getDocument(
  ctx: ApiContext,
  params: DocumentRouteParams,
  query: GetDocumentQuery,
) {
  const document = await findDocumentById(ctx.db, params.id);
  if (!document) {
    throw notFoundError("Document not found");
  }

  const access = await resolveDocumentAccess(ctx, document);
  if (!access) {
    throw forbiddenError("Document access denied");
  }

  const latestVersion = await findLatestVersion(ctx.db, document.id);
  const version =
    query.version === undefined
      ? latestVersion
      : await findVersion(ctx.db, document.id, query.version);

  if (!version || !latestVersion) {
    throw notFoundError("Document version not found");
  }

  return { document, version, latestVersion, access };
}
