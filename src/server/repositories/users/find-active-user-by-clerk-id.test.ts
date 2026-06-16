import { describe, expect, it, vi } from "vitest";

import { findActiveUserByClerkId, type UserLookupDb } from "./find-active-user-by-clerk-id";

describe("findActiveUserByClerkId", () => {
  it("returns the active user for a Clerk id", async () => {
    const user = { id: "user_1" };
    const db = {
      query: {
        users: {
          findFirst: vi.fn(async () => user),
        },
      },
    } as unknown as UserLookupDb;

    await expect(findActiveUserByClerkId(db, "clerk_1")).resolves.toBe(user);
    expect(db.query.users.findFirst).toHaveBeenCalledTimes(1);
  });
});
