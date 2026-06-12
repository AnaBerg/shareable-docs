import { describe, expect, it, vi } from "vitest";
import {
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
