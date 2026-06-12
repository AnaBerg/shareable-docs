import { createDocument } from "@/services/docs/create-document";
import { getDocument } from "@/services/docs/get-document";
import { listDocuments } from "@/services/docs/list-documents";
import { shareDocument } from "@/services/docs/share-document";
import { updateDocument } from "@/services/docs/update-document";
import {
  createDocumentRequestSchema,
  documentRouteParamsSchema,
  getDocumentQuerySchema,
  listDocumentsQuerySchema,
  shareDocumentRequestSchema,
  updateDocumentRequestSchema,
} from "@/types/docs";

import {
  jsonResponse,
  parseJsonBody,
  parseWithSchema,
  searchParamsToObject,
  withApiHandler,
} from "./api";

export const createDocumentHandler = withApiHandler(async ({ request, ctx }) => {
  const input = parseWithSchema(
    createDocumentRequestSchema,
    await parseJsonBody(request),
  );
  const result = await createDocument(ctx, input);

  return jsonResponse(toDocumentCreatedResponse(result), { status: 201 });
});

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
      sharedWith: result.shares.map((share) => share.sharedWithEmail),
    });
  },
);

type CreateDocumentResult = Awaited<ReturnType<typeof createDocument>>;

function toDocumentCreatedResponse(result: CreateDocumentResult) {
  return {
    id: result.document.id,
    name: result.document.name,
    description: result.document.description,
    latestVersion: result.version.versionNumber,
    ownerUserId: result.document.ownerUserId,
    createdAt: result.document.createdAt,
    updatedAt: result.document.updatedAt,
  };
}
