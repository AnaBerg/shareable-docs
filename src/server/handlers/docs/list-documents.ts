import { listDocuments } from "@/server/services/docs/list-documents";
import { listDocumentsQuerySchema } from "@/types/docs";

import {
  jsonResponse,
  parseWithSchema,
  searchParamsToObject,
  withApiHandler,
} from "../api";

export const listDocumentsHandler = withApiHandler(async ({ request, ctx }) => {
  const query = parseWithSchema(
    listDocumentsQuerySchema,
    searchParamsToObject(new URL(request.url).searchParams),
  );
  const result = await listDocuments(ctx, query);

  return jsonResponse({
    documents: result.documents.map((document) => ({
      id: document.id,
      name: document.name,
      description: document.description,
      access: document.access,
      latestVersion: document.latestVersion.versionNumber,
      ownerUserId: document.ownerUserId,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    })),
  });
});
