type ApiLogOutcome = "success" | "error";

export type ApiLogEvent = {
  event: "api.request";
  schemaVersion: 1;
  timestamp: string;
  service: {
    name: "shareable-docs";
    environment: string;
  };
  request: {
    id: string;
    method: string;
    path: string;
  };
  http: {
    statusCode: number;
  };
  outcome: ApiLogOutcome;
  duration: {
    ms: number;
  };
  user?: {
    id: string;
  };
  error?: {
    code: string;
    type: string;
  };
};

export type ApiRequestLogFields = {
  requestId: string;
  method: string;
  pathname: string;
  status: number;
  outcome: ApiLogOutcome;
  durationMs: number;
  userId?: string;
  error?: ApiLogEvent["error"];
};

export function logApiRequest(fields: ApiRequestLogFields): void {
  console.info({
    event: "api.request",
    schemaVersion: 1,
    timestamp: new Date().toISOString(),
    service: {
      name: "shareable-docs",
      environment: process.env.NODE_ENV ?? "development",
    },
    request: {
      id: fields.requestId,
      method: fields.method,
      path: fields.pathname,
    },
    http: {
      statusCode: fields.status,
    },
    outcome: fields.outcome,
    duration: {
      ms: fields.durationMs,
    },
    ...(fields.userId === undefined ? {} : { user: { id: fields.userId } }),
    ...(fields.error === undefined ? {} : { error: fields.error }),
  } satisfies ApiLogEvent);
}

export function getErrorType(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}
