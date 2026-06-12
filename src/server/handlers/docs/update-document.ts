import { updateDocument } from "@/services/docs/update-document";
import { documentRouteParamsSchema, updateDocumentRequestSchema } from "@/types/docs";

import {
  jsonResponse,
  parseJsonBody,
  parseWithSchema,
  withApiHandler,
} from "../api";

export const updateDocumentHandler = withApiHandler<{ id: string }>(
  async ({ request, ctx, params }) => {
    const routeParams = parseWithSchema(documentRouteParamsSchema, params);
    const input = parseWithSchema(
      updateDocumentRequestSchema,
      await parseJsonBody(request),
    );
    const result = await updateDocument(ctx, routeParams, input);

    return jsonResponse({
      id: result.document.id,
      version: result.version.versionNumber,
      latestVersion: result.version.versionNumber,
      updatedAt: result.document.updatedAt,
    });
  },
);
