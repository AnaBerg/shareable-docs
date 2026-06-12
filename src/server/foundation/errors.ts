export type ApiErrorCode =
  | "validation_error"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "user_not_synced"
  | "internal_error";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ApiErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function validationError(message = "Invalid request", details?: unknown) {
  return new ApiError(400, "validation_error", message, details);
}

export function unauthorizedError(message = "Authentication required") {
  return new ApiError(401, "unauthorized", message);
}

export function forbiddenError(message = "Forbidden") {
  return new ApiError(403, "forbidden", message);
}

export function notFoundError(message = "Not found") {
  return new ApiError(404, "not_found", message);
}

export function conflictError(message = "Conflict", code: ApiErrorCode = "conflict") {
  return new ApiError(409, code, message);
}

export function internalError(message = "Internal server error") {
  return new ApiError(500, "internal_error", message);
}
