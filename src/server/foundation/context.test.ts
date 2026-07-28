import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RequestLog } from "./logs";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

describe("createApiContext", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns an unauthorized error when Clerk has no authenticated user", async () => {
    const { auth } = await import("@clerk/nextjs/server");
    vi.mocked(auth).mockResolvedValue({
      tokenType: "session_token",
      userId: null,
    } as never);

    const { createApiContext } = await import("./context");
    const result = await createApiContext({ log: fakeLog(), database: fakeDb() });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatchObject({ status: 401, code: "unauthorized" });
    }
  });

  it("returns a conflict error when the Clerk user has no active local user row", async () => {
    const { auth } = await import("@clerk/nextjs/server");
    vi.mocked(auth).mockResolvedValue({
      tokenType: "session_token",
      userId: "clerk_123",
    } as never);

    const { createApiContext } = await import("./context");
    const result = await createApiContext({ log: fakeLog(), database: fakeDb(null) });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatchObject({ status: 409, code: "user_not_synced" });
    }
  });

  it("returns context with local user, normalized email, and db", async () => {
    const { auth } = await import("@clerk/nextjs/server");
    vi.mocked(auth).mockResolvedValue({
      tokenType: "session_token",
      userId: "clerk_123",
    } as never);
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
    const log = fakeLog();

    const { createApiContext } = await import("./context");
    const result = await createApiContext({ log, database });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.ctx.db).toBe(database);
      expect(result.ctx.user.id).toBe("user_1");
      expect(result.ctx.userEmail).toBe("ada@example.com");
      expect(result.ctx.log).toBe(log);
    }
    expect(log.add).toHaveBeenCalledWith({ userId: "user_1" });
  });

  it("resolves the user from an api_key subject", async () => {
    const { auth } = await import("@clerk/nextjs/server");
    vi.mocked(auth).mockResolvedValue({
      tokenType: "api_key",
      subject: "user_123",
      isAuthenticated: true,
    } as never);
    const database = fakeDb({
      id: "user_1",
      clerkUserId: "user_123",
      primaryEmail: "ada@example.com",
      firstName: null,
      lastName: null,
      imageUrl: null,
      createdAt: new Date("2026-06-12T00:00:00.000Z"),
      updatedAt: new Date("2026-06-12T00:00:00.000Z"),
      deletedAt: null,
    });

    const { createApiContext } = await import("./context");
    const result = await createApiContext({ log: fakeLog(), database });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.ctx.user.id).toBe("user_1");
    }
  });

  it("rejects an unauthenticated api_key even when it carries a user subject", async () => {
    const { auth } = await import("@clerk/nextjs/server");
    vi.mocked(auth).mockResolvedValue({
      tokenType: "api_key",
      subject: "user_123",
      isAuthenticated: false,
    } as never);

    const { createApiContext } = await import("./context");
    const result = await createApiContext({ log: fakeLog(), database: fakeDb() });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatchObject({ status: 401, code: "unauthorized" });
    }
  });

  it("rejects an api_key whose subject is not a user id", async () => {
    const { auth } = await import("@clerk/nextjs/server");
    vi.mocked(auth).mockResolvedValue({
      tokenType: "api_key",
      subject: "org_123",
      isAuthenticated: true,
    } as never);

    const { createApiContext } = await import("./context");
    const result = await createApiContext({ log: fakeLog(), database: fakeDb() });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatchObject({ status: 401, code: "unauthorized" });
    }
  });

  it("rejects a machine token whose subject is not a user id", async () => {
    const { auth } = await import("@clerk/nextjs/server");
    vi.mocked(auth).mockResolvedValue({
      tokenType: "m2m_token",
      subject: "mch_123",
      isAuthenticated: true,
    } as never);

    const { createApiContext } = await import("./context");
    const result = await createApiContext({ log: fakeLog(), database: fakeDb() });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatchObject({ status: 401, code: "unauthorized" });
    }
  });

  it("records the token type in the request log", async () => {
    const { auth } = await import("@clerk/nextjs/server");
    vi.mocked(auth).mockResolvedValue({
      tokenType: "session_token",
      userId: "clerk_123",
    } as never);
    const log = fakeLog();

    const { createApiContext } = await import("./context");
    await createApiContext({ log, database: fakeDb(null) });

    expect(log.add).toHaveBeenCalledWith({ tokenType: "session_token" });
  });
});

function fakeLog(): RequestLog {
  return { add: vi.fn(), emit: vi.fn() };
}

function fakeDb(user: unknown = null) {
  return {
    query: {
      users: {
        findFirst: vi.fn().mockResolvedValue(user),
      },
    },
  };
}
