import { createShareLink } from "@/server/services/docs/create-share-link";
import { revokeShareLink } from "@/server/services/docs/revoke-share-link";
import { parseWithSchema } from "@/server/foundation/helpers/validation";
import { jsonResponse } from "@/server/foundation/responses";
import { documentRouteParamsSchema } from "@/types/docs";
import type {
  CreateShareLinkResponse,
  RevokeShareLinkResponse,
} from "@/types/docs";

import { withApiHandler } from "../api";

export const createShareLinkHandler = withApiHandler<{ id: string }>(
  async ({ request, ctx, params }) => {
    const routeParams = parseWithSchema(documentRouteParamsSchema, params);
    const result = await createShareLink(ctx, routeParams);

    const url = new URL(
      `/d/${result.document.id}?t=${result.token}`,
      request.url,
    ).toString();

    return jsonResponse(
      {
        id: result.document.id,
        url,
        token: result.token,
      } satisfies CreateShareLinkResponse,
      { status: 201 },
    );
  },
);

export const revokeShareLinkHandler = withApiHandler<{ id: string }>(
  async ({ ctx, params }) => {
    const routeParams = parseWithSchema(documentRouteParamsSchema, params);
    const result = await revokeShareLink(ctx, routeParams);

    return jsonResponse({
      id: result.document.id,
      revoked: result.revoked,
    } satisfies RevokeShareLinkResponse);
  },
);
