import { shareDocument } from "@/services/docs/share-document";
import { documentRouteParamsSchema, shareDocumentRequestSchema } from "@/types/docs";

import {
  jsonResponse,
  parseJsonBody,
  parseWithSchema,
  withApiHandler,
} from "../api";

export const shareDocumentHandler = withApiHandler<{ id: string }>(
  async ({ request, ctx, params }) => {
    const routeParams = parseWithSchema(documentRouteParamsSchema, params);
    const input = parseWithSchema(
      shareDocumentRequestSchema,
      await parseJsonBody(request),
    );
    const result = await shareDocument(ctx, routeParams, input);

    return jsonResponse({
      id: result.document.id,
      sharedWith: input.emails,
    });
  },
);
