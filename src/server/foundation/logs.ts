import { isApiError } from "./errors";

type ApiLogOutcome = "success" | "error";

/**
 * One wide event per request, enriched while the request runs and emitted once
 * at the end. Handlers and services add business context through `add`, so the
 * event carries the facts needed to answer questions about a request instead of
 * a trail of statements about the code that served it.
 */
export type RequestLog = {
  add: (fields: Record<string, unknown>) => void;
  emit: (result: { status: number; durationMs: number; error?: unknown }) => void;
};

export type RequestLogSource = {
  requestId: string;
  method: string;
  path: string;
};

export function createRequestLog(source: RequestLogSource): RequestLog {
  const context: Record<string, unknown> = {};

  return {
    add(fields) {
      Object.assign(context, fields);
    },
    emit({ status, durationMs, error }) {
      console.info({
        ...context,
        event: "api.request",
        schemaVersion: 2,
        timestamp: new Date().toISOString(),
        service: "shareable-docs",
        environment: process.env.NODE_ENV ?? "development",
        ...deploymentFields(),
        requestId: source.requestId,
        method: source.method,
        path: source.path,
        statusCode: status,
        outcome: (status >= 400 ? "error" : "success") satisfies ApiLogOutcome,
        durationMs,
        ...(error === undefined ? {} : describeError(error)),
      });
    },
  };
}

function deploymentFields() {
  const deploymentId = process.env.VERCEL_DEPLOYMENT_ID;
  const region = process.env.VERCEL_REGION;

  return {
    ...(deploymentId === undefined ? {} : { deploymentId }),
    ...(region === undefined ? {} : { region }),
  };
}

/**
 * Errors are described with the dimensions an on-call reader filters by: which
 * failure it was, where it came from, and whether retrying could help.
 */
export function describeError(error: unknown) {
  if (isApiError(error)) {
    return {
      errorCode: error.code,
      errorType: "ApiError",
      errorMessage: error.message,
      errorRetriable: error.status >= 500,
    };
  }

  return {
    errorCode: "internal_error",
    errorType: getErrorType(error),
    errorMessage: error instanceof Error ? error.message : String(error),
    errorRetriable: true,
  };
}

export function getErrorType(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}
