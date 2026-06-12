import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@clerk/nextjs/webhooks", () => ({
  verifyWebhook: vi.fn(),
}));

vi.mock("@/server/clerk/user-sync", () => ({
  createDrizzleUserSyncRepository: vi.fn(() => ({
    upsertUser: vi.fn().mockResolvedValue(undefined),
    softDeleteUser: vi.fn().mockResolvedValue(undefined),
  })),
  syncClerkUserDeleted: vi.fn().mockResolvedValue(undefined),
  syncClerkUserUpserted: vi.fn().mockResolvedValue(undefined),
}));

describe("Clerk webhook route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("syncs user.created events", async () => {
    const { verifyWebhook } = await import("@clerk/nextjs/webhooks");
    vi.mocked(verifyWebhook).mockResolvedValue({
      id: "evt_1",
      type: "user.created",
      data: { id: "user_123" },
    } as never);

    const { POST } = await import("./route");
    const response = await POST(new Request("https://app.test/api/webhooks/clerk"));

    const { syncClerkUserUpserted } = await import("@/server/clerk/user-sync");
    expect(response.status).toBe(200);
    expect(syncClerkUserUpserted).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: "user_123" }),
    );
  });

  it("syncs user.updated events", async () => {
    const { verifyWebhook } = await import("@clerk/nextjs/webhooks");
    vi.mocked(verifyWebhook).mockResolvedValue({
      id: "evt_2",
      type: "user.updated",
      data: { id: "user_123" },
    } as never);

    const { POST } = await import("./route");
    const response = await POST(new Request("https://app.test/api/webhooks/clerk"));

    const { syncClerkUserUpserted } = await import("@/server/clerk/user-sync");
    expect(response.status).toBe(200);
    expect(syncClerkUserUpserted).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: "user_123" }),
    );
  });

  it("syncs user.deleted events", async () => {
    const { verifyWebhook } = await import("@clerk/nextjs/webhooks");
    vi.mocked(verifyWebhook).mockResolvedValue({
      id: "evt_3",
      type: "user.deleted",
      data: { id: "user_123" },
    } as never);

    const { POST } = await import("./route");
    const response = await POST(new Request("https://app.test/api/webhooks/clerk"));

    const { syncClerkUserDeleted } = await import("@/server/clerk/user-sync");
    expect(response.status).toBe(200);
    expect(syncClerkUserDeleted).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: "user_123" }),
    );
  });

  it("returns 400 for invalid signatures", async () => {
    const { verifyWebhook } = await import("@clerk/nextjs/webhooks");
    vi.mocked(verifyWebhook).mockRejectedValue(new Error("bad signature"));

    const { POST } = await import("./route");
    const response = await POST(new Request("https://app.test/api/webhooks/clerk"));

    expect(response.status).toBe(400);
  });

  it("returns 200 for unsupported events", async () => {
    const { verifyWebhook } = await import("@clerk/nextjs/webhooks");
    vi.mocked(verifyWebhook).mockResolvedValue({
      id: "evt_4",
      type: "session.created",
      data: {},
    } as never);

    const { POST } = await import("./route");
    const response = await POST(new Request("https://app.test/api/webhooks/clerk"));

    const { syncClerkUserDeleted, syncClerkUserUpserted } = await import(
      "@/server/clerk/user-sync"
    );
    expect(response.status).toBe(200);
    expect(syncClerkUserDeleted).not.toHaveBeenCalled();
    expect(syncClerkUserUpserted).not.toHaveBeenCalled();
  });
});
