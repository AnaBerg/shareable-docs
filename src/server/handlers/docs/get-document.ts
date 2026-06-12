import { getDocument } from "@/services/docs/get-document";
import { documentRouteParamsSchema, getDocumentQuerySchema } from "@/types/docs";

import {
  jsonResponse,
  parseWithSchema,
  searchParamsToObject,
  withApiHandler,
} from "../api";

export const getDocumentHandler = withApiHandler<{ id: string }>(
  async ({ request, ctx, params }) => {
    const routeParams = parseWithSchema(documentRouteParamsSchema, params);
    const query = parseWithSchema(
      getDocumentQuerySchema,
      searchParamsToObject(new URL(request.url).searchParams),
    );
    const result = await getDocument(ctx, routeParams, query);

    return jsonResponse({
      id: result.document.id,
      name: result.document.name,
      description: result.document.description,
      version: result.version.versionNumber,
      latestVersion: result.latestVersion.versionNumber,
      html: result.version.html,
      ownerUserId: result.document.ownerUserId,
      createdAt: result.document.createdAt,
      updatedAt: result.document.updatedAt,
      versionCreatedAt: result.version.createdAt,
    });
  },
);
