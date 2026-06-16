import { updateDocument } from "@/server/services/docs/update-document";
import { parseJsonBody } from "@/server/foundation/helpers/parse-json-body";
import { parseWithSchema } from "@/server/foundation/helpers/validation";
import { jsonResponse } from "@/server/foundation/responses";
import { documentRouteParamsSchema, updateDocumentRequestSchema } from "@/types/docs";

import { withApiHandler } from "../api";

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
