import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

describe("createApiContext", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 401 when Clerk has no authenticated user", async () => {
    const { auth } = await import("@clerk/nextjs/server");
    vi.mocked(auth).mockResolvedValue({ userId: null } as never);

    const { createApiContext } = await import("./context");
    const result = await createApiContext(fakeDb());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
      await expect(result.response.json()).resolves.toMatchObject({
        error: { code: "unauthorized" },
      });
    }
  });

  it("returns 409 when the Clerk user has no active local user row", async () => {
    const { auth } = await import("@clerk/nextjs/server");
    vi.mocked(auth).mockResolvedValue({ userId: "clerk_123" } as never);

    const { createApiContext } = await import("./context");
    const result = await createApiContext(fakeDb(null));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(409);
      await expect(result.response.json()).resolves.toMatchObject({
        error: { code: "user_not_synced" },
      });
    }
  });

  it("returns context with local user, normalized email, and db", async () => {
    const { auth } = await import("@clerk/nextjs/server");
    vi.mocked(auth).mockResolvedValue({ userId: "clerk_123" } as never);
    const database = fakeDb({
      id: "user_1",
      clerkUserId: "clerk_123",
      primaryEmail: " Ada@Example.com ",
      firstName: null,
      lastName: null,
      imageUrl: null,
      createdAt: new Date("2026-06-12T00:00:00.000Z"),
      updatedAt: new Date("2026-06-12T00:00:00.000Z"),
      deletedAt: null,
    });

    const { createApiContext } = await import("./context");
    const result = await createApiContext(database);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.ctx.db).toBe(database);
      expect(result.ctx.user.id).toBe("user_1");
      expect(result.ctx.userEmail).toBe("ada@example.com");
    }
  });
});

function fakeDb(user: unknown = null) {
  return {
    query: {
      users: {
        findFirst: vi.fn().mockResolvedValue(user),
      },
    },
  };
}
