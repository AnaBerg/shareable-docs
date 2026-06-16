import { createApiContext } from "@/server/foundation/context";
import { isApiError } from "@/server/foundation/errors";
import { readErrorCode } from "@/server/foundation/helpers/read-error-code";
import { getRequestId } from "@/server/foundation/helpers/request-id";
import { apiErrorResponse } from "@/server/foundation/responses";
import { getErrorType, logApiRequest } from "@/server/foundation/logs";
import type { ApiHandler } from "@/types/api-handler";

export function withApiHandler<TParams = unknown>(
  handler: ApiHandler<TParams>,
): (request: Request, routeContext?: { params?: Promise<TParams> | TParams }) => Promise<Response> {
  return async (request, routeContext) => {
    const startedAt = performance.now();
    const requestId = getRequestId(request);
    const url = new URL(request.url);
    let userId: string | undefined;
    let error:
      | {
          code: string;
          type: string;
        }
      | undefined;
    let response: Response | undefined;

    try {
      const contextResult = await createApiContext(undefined, requestId);

      if (!contextResult.ok) {
        response = contextResult.response;
        const code = await readErrorCode(response);
        error = code ? { code, type: "ApiError" } : undefined;
        return response;
      }

      userId = contextResult.ctx.user.id;
      const params = await routeContext?.params;
      response = await handler({
        request,
        ctx: contextResult.ctx,
        params: params as TParams,
      });
      return response;
    } catch (caught) {
      if (isApiError(caught)) {
        error = { code: caught.code, type: "ApiError" };
        response = apiErrorResponse(caught);
        return response;
      }

      error = { code: "internal_error", type: getErrorType(caught) };
      response = apiErrorResponse({
        kind: "api_error",
        code: "internal_error",
        message: "Internal server error",
        status: 500,
      });
      return response;
    } finally {
      const status = response?.status ?? 500;
      logApiRequest({
        requestId,
        method: request.method,
        pathname: url.pathname,
        status,
        outcome: status >= 400 ? "error" : "success",
        durationMs: Math.round(performance.now() - startedAt),
        userId,
        error,
      });
    }
  };
}
