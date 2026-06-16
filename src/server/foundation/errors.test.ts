import { describe, expect, it } from "vitest";

import {
  apiError,
  conflictError,
  forbiddenError,
  internalError,
  isApiError,
  notFoundError,
  unauthorizedError,
  validationError,
} from "./errors";

describe("API errors", () => {
  it("creates functional API error objects", () => {
    expect(validationError()).toMatchObject({ status: 422, code: "validation_error" });
    expect(unauthorizedError()).toMatchObject({ status: 401, code: "unauthorized" });
    expect(forbiddenError()).toMatchObject({ status: 403, code: "forbidden" });
    expect(notFoundError()).toMatchObject({ status: 404, code: "not_found" });
    expect(conflictError()).toMatchObject({ status: 409, code: "conflict" });
    expect(internalError()).toMatchObject({ status: 500, code: "internal_error" });
  });

  it("only accepts complete API error shapes", () => {
    expect(isApiError(apiError(403, "forbidden", "Nope"))).toBe(true);
    expect(isApiError({ kind: "api_error" })).toBe(false);
    expect(isApiError(new Error("boom"))).toBe(false);
  });
});
