import { auth } from "@clerk/nextjs/server";

import { db, type User } from "@/db";
import { normalizeEmail } from "@/server/foundation/helpers/email";
import type { RequestLog } from "@/server/foundation/logs";
import {
  findActiveUserByClerkId,
  type UserLookupDb,
} from "@/server/repositories/users/find-active-user-by-clerk-id";

import { conflictError, unauthorizedError, type ApiError } from "./errors";

type Db = typeof db;

export type ApiContext = {
  db: Db;
  requestId: string;
  user: User;
  userEmail: string | null;
  log: RequestLog;
};

export type ApiContextResult =
  | { ok: true; ctx: ApiContext }
  | { ok: false; error: ApiError };

export type CreateApiContextOptions = {
  log: RequestLog;
  requestId?: string;
  database?: UserLookupDb;
};

export async function createApiContext({
  log,
  requestId = crypto.randomUUID(),
  database = db as UserLookupDb,
}: CreateApiContextOptions): Promise<ApiContextResult> {
  const session = await auth({ acceptsToken: ["session_token", "api_key"] });

  log.add({ tokenType: session.tokenType });

  const clerkUserId =
    session.tokenType === "session_token"
      ? session.userId
      : session.tokenType === "api_key" &&
          session.isAuthenticated &&
          session.subject.startsWith("user_")
        ? session.subject
        : null;

  if (!clerkUserId) {
    return { ok: false, error: unauthorizedError() };
  }

  log.add({ clerkUserId });

  const user = await findActiveUserByClerkId(database, clerkUserId);

  if (!user) {
    return {
      ok: false,
      error: conflictError(
        "Authenticated user has not been synchronized yet",
        "user_not_synced",
      ),
    };
  }

  log.add({ userId: user.id });

  return {
    ok: true,
    ctx: {
      db: database as Db,
      requestId,
      user,
      userEmail: normalizeEmail(user.primaryEmail),
      log,
    },
  };
}
