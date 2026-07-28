import { createDocument } from "@/server/services/docs/create-document";
import { parseJsonBody } from "@/server/foundation/helpers/parse-json-body";
import { parseWithSchema } from "@/server/foundation/helpers/validation";
import { jsonResponse } from "@/server/foundation/responses";
import { createDocumentRequestSchema } from "@/types/docs";

import { withApiHandler } from "../api";

export const createDocumentHandler = withApiHandler(async ({ request, ctx }) => {
  const input = parseWithSchema(
    createDocumentRequestSchema,
    await parseJsonBody(request),
  );
  const result = await createDocument(ctx, input);

  return jsonResponse(
    {
      id: result.document.id,
      name: result.document.name,
      description: result.document.description,
      latestVersion: result.version.versionNumber,
      ownerUserId: result.document.ownerUserId,
      createdAt: result.document.createdAt,
      updatedAt: result.document.updatedAt,
    },
    { status: 201 },
  );
});
