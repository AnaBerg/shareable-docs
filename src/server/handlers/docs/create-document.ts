import { createDocument } from "@/services/docs/create-document";
import { createDocumentRequestSchema } from "@/types/docs";

import {
  jsonResponse,
  parseJsonBody,
  parseWithSchema,
  withApiHandler,
} from "../api";

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
