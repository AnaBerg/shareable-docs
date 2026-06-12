type ApiLogFields = {
  requestId: string;
  method: string;
  pathname: string;
  status: number;
  durationMs: number;
  userId?: string;
  errorCode?: string;
};

export function logApiRequest(fields: ApiLogFields): void {
  console.info("api_request", fields);
}

export function logApiError(
  error: unknown,
  fields: Omit<ApiLogFields, "status" | "durationMs"> & {
    status?: number;
    durationMs?: number;
  },
): void {
  console.error("api_error", {
    ...fields,
    errorName: error instanceof Error ? error.name : "UnknownError",
  });
}
