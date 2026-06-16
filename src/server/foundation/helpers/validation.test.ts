import { describe, expect, it } from "vitest";
import { z } from "zod";

import { parseWithSchema, toSafeZodDetails } from "./validation";

describe("validation helpers", () => {
  it("returns parsed values or throws sanitized details", () => {
    expect(parseWithSchema(z.object({ name: z.string() }), { name: "Ada" })).toEqual({
      name: "Ada",
    });

    expect(() =>
      parseWithSchema(z.object({ name: z.string().min(1) }), { name: "" }),
    ).toThrow(expect.objectContaining({ code: "validation_error" }));
  });

  it("converts zod issues into path and message only", () => {
    const result = z.object({ name: z.string().min(1) }).safeParse({ name: "" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(toSafeZodDetails(result.error)).toEqual([
        { path: ["name"], message: expect.any(String) },
      ]);
    }
  });
});
