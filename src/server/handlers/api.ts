import { ZodError, type ZodType } from "zod";

import { createApiContext, type ApiContext } from "@/server/foundation/context";
import { ApiError, validationError } from "@/server/foundation/errors";
import { logApiError, logApiRequest } from "@/server/foundation/logs";

type JsonResponseOptions = {
  status?: number;
  headers?: HeadersInit;
};

export type ApiHandler<TParams = unknown> = (input: {
  request: Request;
  ctx: ApiContext;
  params: TParams;
}) => Promise<Response>;

export function jsonResponse(
  body: unknown,
  options: JsonResponseOptions = {},
): Response {
  return Response.json(body, {
    status: options.status ?? 200,
    headers: options.headers,
  });
}

export function jsonErrorResponse(
  code: string,
  message: string,
  status: number,
  details?: unknown,
): Response {
  return jsonResponse(
    {
      error: {
        code,
        message,
        ...(details === undefined ? {} : { details }),
      },
    },
    { status },
  );
}

export async function parseJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw validationError("Malformed JSON");
  }
}

export function parseWithSchema<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);

  if (result.success) {
    return result.data;
  }

  throw validationError("Invalid request", toSafeZodDetails(result.error));
}

export function searchParamsToObject(searchParams: URLSearchParams) {
  return Object.fromEntries(searchParams.entries());
}

export function withApiHandler<TParams = unknown>(
  handler: ApiHandler<TParams>,
): (request: Request, routeContext?: { params?: Promise<TParams> | TParams }) => Promise<Response> {
  return async (request, routeContext) => {
    const startedAt = performance.now();
    const requestId = getRequestId(request);
    const url = new URL(request.url);
    let userId: string | undefined;
    let errorCode: string | undefined;
    let response: Response;

    try {
      const contextResult = await createApiContext(undefined, requestId);

      if (!contextResult.ok) {
        response = contextResult.response;
        errorCode = await readErrorCode(response);
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
    } catch (error) {
      if (error instanceof ApiError) {
        errorCode = error.code;
        response = jsonErrorResponse(
          error.code,
          error.message,
          error.status,
          error.details,
        );
        return response;
      }

      errorCode = "internal_error";
      logApiError(error, {
        requestId,
        method: request.method,
        pathname: url.pathname,
        userId,
        errorCode,
      });
      response = jsonErrorResponse(
        "internal_error",
        "Internal server error",
        500,
      );
      return response;
    } finally {
      const status = response?.status ?? 500;
      logApiRequest({
        requestId,
        method: request.method,
        pathname: url.pathname,
        status,
        durationMs: Math.round(performance.now() - startedAt),
        userId,
        errorCode,
      });
    }
  };
}

function getRequestId(request: Request): string {
  return (
    request.headers.get("x-request-id") ??
    request.headers.get("x-vercel-id") ??
    crypto.randomUUID()
  );
}

function toSafeZodDetails(error: ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.map(String),
    message: issue.message,
  }));
}

async function readErrorCode(response: Response): Promise<string | undefined> {
  try {
    const clone = response.clone();
    const body = (await clone.json()) as { error?: { code?: string } };
    return body.error?.code;
  } catch {
    return undefined;
  }
}
