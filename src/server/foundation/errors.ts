export type ApiErrorCode =
  | "validation_error"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "user_not_synced"
  | "internal_error";

export type ApiError = {
  kind: "api_error";
  status: number;
  code: ApiErrorCode;
  message: string;
  details?: unknown;
};

export function apiError(
  status: number,
  code: ApiErrorCode,
  message: string,
  details?: unknown,
): ApiError {
  return {
    kind: "api_error",
    status,
    code,
    message,
    ...(details === undefined ? {} : { details }),
  };
}

export function isApiError(error: unknown): error is ApiError {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const candidate = error as Record<string, unknown>;

  return (
    candidate.kind === "api_error" &&
    typeof candidate.status === "number" &&
    typeof candidate.code === "string" &&
    typeof candidate.message === "string"
  );
}

export function validationError(message = "Invalid request", details?: unknown) {
  return apiError(422, "validation_error", message, details);
}

export function unauthorizedError(message = "Authentication required") {
  return apiError(401, "unauthorized", message);
}

export function forbiddenError(message = "Forbidden", code: ApiErrorCode = "forbidden") {
  return apiError(403, code, message);
}

export function notFoundError(message = "Not found") {
  return apiError(404, "not_found", message);
}

export function conflictError(message = "Conflict", code: ApiErrorCode = "conflict") {
  return apiError(409, code, message);
}

export function internalError(message = "Internal server error") {
  return apiError(500, "internal_error", message);
}
