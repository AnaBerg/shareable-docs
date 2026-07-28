import { vi } from "vitest";

import type { User } from "@/db";
import type { ApiContext } from "@/server/foundation/context";
import type { RequestLog } from "@/server/foundation/logs";

export function requestLog(): RequestLog {
  return { add: vi.fn(), emit: vi.fn() };
}

export function apiContext(userId: string, email?: string | null): ApiContext {
  const now = new Date("2026-06-12T00:00:00.000Z");
  const primaryEmail = email === undefined ? `${userId}@example.com` : email;

  return {
    db: {} as ApiContext["db"],
    requestId: `req_${userId}`,
    user: {
      id: userId,
      clerkUserId: `clerk_${userId}`,
      primaryEmail,
      firstName: null,
      lastName: null,
      imageUrl: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    } satisfies User,
    userEmail: primaryEmail,
    log: requestLog(),
  };
}

export function document(overrides: Partial<{
  id: string;
  ownerUserId: string;
  name: string;
  description: string | null;
}> = {}) {
  const now = new Date("2026-06-12T00:00:00.000Z");

  return {
    id: "01HZXJK8JHX7QY9N7K6X8Y2W0A",
    ownerUserId: "owner",
    name: "Report",
    description: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

export function version(overrides: Partial<{
  documentId: string;
  versionNumber: number;
  html: string;
}> = {}) {
  return {
    id: "01HZXJK8JHX7QY9N7K6X8Y2W0B",
    documentId: "01HZXJK8JHX7QY9N7K6X8Y2W0A",
    versionNumber: 1,
    html: "<p>v1</p>",
    createdByUserId: "owner",
    createdAt: new Date("2026-06-12T00:00:00.000Z"),
    ...overrides,
  };
}
