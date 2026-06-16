import { ZodError, type ZodType } from "zod";

import { validationError } from "@/server/foundation/errors";

export function parseWithSchema<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);

  if (result.success) {
    return result.data;
  }

  throw validationError("Invalid request", toSafeZodDetails(result.error));
}

export function toSafeZodDetails(error: ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.map(String),
    message: issue.message,
  }));
}
