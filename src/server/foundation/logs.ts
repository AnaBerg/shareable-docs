type ApiLogOutcome = "success" | "error";

export type ApiLogEvent = {
  event: "api_request";
  timestamp: string;
  service: "shareable-docs";
  requestId: string;
  method: string;
  pathname: string;
  status: number;
  outcome: ApiLogOutcome;
  durationMs: number;
  userId?: string;
  error?: {
    code: string;
    type: string;
  };
};

export function logApiRequest(fields: Omit<ApiLogEvent, "event" | "timestamp" | "service">): void {
  console.info({
    event: "api_request",
    timestamp: new Date().toISOString(),
    service: "shareable-docs",
    ...fields,
  } satisfies ApiLogEvent);
}

export function getErrorType(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}
