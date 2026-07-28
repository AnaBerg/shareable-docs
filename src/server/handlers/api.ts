import { createApiContext } from "@/server/foundation/context";
import { internalError, isApiError } from "@/server/foundation/errors";
import { getRequestId } from "@/server/foundation/helpers/request-id";
import { apiErrorResponse } from "@/server/foundation/responses";
import { createRequestLog } from "@/server/foundation/logs";
import type { ApiHandler } from "@/types/api-handler";

export function withApiHandler<TParams = unknown>(
  handler: ApiHandler<TParams>,
): (request: Request, routeContext?: { params?: Promise<TParams> | TParams }) => Promise<Response> {
  return async (request, routeContext) => {
    const startedAt = performance.now();
    const requestId = getRequestId(request);
    const url = new URL(request.url);
    const log = createRequestLog({
      requestId,
      method: request.method,
      path: url.pathname,
    });

    try {
      const contextResult = await createApiContext({ log, requestId });

      if (!contextResult.ok) {
        throw contextResult.error;
      }

      const params = await routeContext?.params;
      const response = await handler({
        request,
        ctx: contextResult.ctx,
        params: params as TParams,
      });

      log.emit({ status: response.status, durationMs: elapsedMs(startedAt) });
      return response;
    } catch (caught) {
      const error = isApiError(caught) ? caught : internalError();

      log.emit({
        status: error.status,
        durationMs: elapsedMs(startedAt),
        error: caught,
      });

      return apiErrorResponse(error);
    }
  };
}

function elapsedMs(startedAt: number): number {
  return Math.round(performance.now() - startedAt);
}
