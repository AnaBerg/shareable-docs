import { describe, expect, it, vi } from "vitest";
import { and, eq, isNull } from "drizzle-orm";
import { users } from "@/db/schema";
import {
  createDrizzleUserSyncRepository,
  mapClerkUser,
  syncClerkUserDeleted,
  syncClerkUserUpserted,
  type ClerkUserLike,
  type UserSyncRepository,
} from "./user-sync";

function clerkUser(overrides: Partial<ClerkUserLike> = {}): ClerkUserLike {
  return {
    id: "user_123",
    primaryEmailAddressId: "email_1",
    emailAddresses: [{ id: "email_1", emailAddress: "ada@example.com" }],
    firstName: "Ada",
    lastName: "Lovelace",
    imageUrl: "https://example.com/ada.png",
    ...overrides,
  };
}

describe("mapClerkUser", () => {
  it("maps stable Clerk user fields", () => {
    expect(mapClerkUser(clerkUser())).toMatchObject({
      clerkUserId: "user_123",
      primaryEmail: "ada@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      imageUrl: "https://example.com/ada.png",
    });
  });

  it("stores null email when primary email is unavailable", () => {
    expect(
      mapClerkUser(
        clerkUser({ primaryEmailAddressId: "missing", emailAddresses: [] }),
      ).primaryEmail,
    ).toBeNull();
  });

  it("stores null email when primary email value is absent or blank", () => {
    for (const emailAddress of [null, undefined, ""]) {
      expect(
        mapClerkUser(
          clerkUser({
            emailAddresses: [{ id: "email_1", emailAddress }],
          }),
        ).primaryEmail,
      ).toBeNull();
    }
  });
});

describe("syncClerkUserUpserted", () => {
  it("upserts mapped users and clears deletedAt", async () => {
    const repo: UserSyncRepository = {
      upsertUser: vi.fn().mockResolvedValue(undefined),
      softDeleteUser: vi.fn().mockResolvedValue(undefined),
    };

    await syncClerkUserUpserted(repo, clerkUser());

    expect(repo.upsertUser).toHaveBeenCalledWith(
      expect.objectContaining({
        clerkUserId: "user_123",
        primaryEmail: "ada@example.com",
        deletedAt: null,
      }),
    );
  });
});

describe("syncClerkUserDeleted", () => {
  it("soft deletes when Clerk user id exists", async () => {
    const repo: UserSyncRepository = {
      upsertUser: vi.fn().mockResolvedValue(undefined),
      softDeleteUser: vi.fn().mockResolvedValue(undefined),
    };

    await syncClerkUserDeleted(repo, { id: "user_123" });

    expect(repo.softDeleteUser).toHaveBeenCalledWith("user_123", expect.any(Date));
  });

  it("ignores deletes without an id", async () => {
    const repo: UserSyncRepository = {
      upsertUser: vi.fn().mockResolvedValue(undefined),
      softDeleteUser: vi.fn().mockResolvedValue(undefined),
    };

    await syncClerkUserDeleted(repo, {});

    expect(repo.softDeleteUser).not.toHaveBeenCalled();
  });
});

describe("createDrizzleUserSyncRepository", () => {
  it("soft deletes only active users", async () => {
    let whereCondition: unknown;
    const database = {
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn((condition) => {
            whereCondition = condition;
            return Promise.resolve();
          }),
        })),
      })),
    } as unknown as Parameters<typeof createDrizzleUserSyncRepository>[0];
    const repo = createDrizzleUserSyncRepository(database);

    await repo.softDeleteUser("user_123", new Date("2026-06-12T00:00:00.000Z"));

    expect(whereCondition).toEqual(
      and(eq(users.clerkUserId, "user_123"), isNull(users.deletedAt)),
    );
  });
});
