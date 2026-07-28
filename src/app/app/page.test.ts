import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findActiveUserByClerkId: vi.fn(),
  listAccessibleDocuments: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/server/repositories/users/find-active-user-by-clerk-id", () => ({
  findActiveUserByClerkId: mocks.findActiveUserByClerkId,
}));
vi.mock("@/server/repositories/docs/list-documents", () => ({
  listAccessibleDocuments: mocks.listAccessibleDocuments,
}));

const now = new Date("2026-06-12T00:00:00.000Z");

function documentListItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "01HZXJK8JHX7QY9N7K6X8Y2W0A",
    ownerUserId: "owner",
    name: "Quarterly Report",
    description: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    access: "owned" as const,
    latestVersion: {
      id: "01HZXJK8JHX7QY9N7K6X8Y2W0B",
      documentId: "01HZXJK8JHX7QY9N7K6X8Y2W0A",
      versionNumber: 4,
      html: "<h1>report</h1>",
      createdByUserId: "owner",
      createdAt: now,
    },
    ...overrides,
  };
}

async function renderPage() {
  const { default: DocumentsPage } = await import("./page");
  const element = await DocumentsPage();

  return renderToStaticMarkup(element as ReactElement);
}

describe("documents page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ userId: "clerk_owner" });
    mocks.findActiveUserByClerkId.mockResolvedValue({
      id: "owner",
      clerkUserId: "clerk_owner",
      primaryEmail: "Owner@Example.com",
    });
    mocks.listAccessibleDocuments.mockResolvedValue([documentListItem()]);
  });

  it("lists only the owner's documents", async () => {
    await renderPage();

    expect(mocks.listAccessibleDocuments).toHaveBeenCalledWith(
      expect.anything(),
      { ownerUserId: "owner", sharedWithEmail: "owner@example.com", access: "owned" },
    );
  });

  it("renders each document with its viewer link", async () => {
    const markup = await renderPage();

    expect(markup).toContain("Quarterly Report");
    expect(markup).toContain('href="/d/01HZXJK8JHX7QY9N7K6X8Y2W0A"');
    expect(markup).toContain("v4");
  });

  it("never renders stored document HTML", async () => {
    const markup = await renderPage();

    expect(markup).not.toContain("<h1>report</h1>");
  });

  it("renders a syncing notice when the user row does not exist yet", async () => {
    mocks.findActiveUserByClerkId.mockResolvedValue(null);

    const markup = await renderPage();

    expect(markup).toContain("still being set up");
    expect(mocks.listAccessibleDocuments).not.toHaveBeenCalled();
  });
});
