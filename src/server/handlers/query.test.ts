import { describe, expect, it } from "vitest";

import { searchParamsToObject } from "./query";

describe("searchParamsToObject", () => {
  it("preserves duplicate query parameters", () => {
    const params = new URLSearchParams("access=owned&access=shared&version=1");

    expect(searchParamsToObject(params)).toEqual({
      access: ["owned", "shared"],
      version: "1",
    });
  });
});
