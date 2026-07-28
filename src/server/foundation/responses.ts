import type { ApiError } from "./errors";

export function jsonResponse(
  body: unknown,
  init: ResponseInit = {},
): Response {
  return Response.json(body, init);
}

export function apiErrorResponse(error: ApiError): Response {
  return jsonResponse(
    {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
      },
    },
    { status: error.status },
  );
}
