import { shareDocument } from "@/server/services/docs/share-document";
import { parseJsonBody } from "@/server/foundation/helpers/parse-json-body";
import { parseWithSchema } from "@/server/foundation/helpers/validation";
import { jsonResponse } from "@/server/foundation/responses";
import { documentRouteParamsSchema, shareDocumentRequestSchema } from "@/types/docs";

import { withApiHandler } from "../api";

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
