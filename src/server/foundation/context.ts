import { auth } from "@clerk/nextjs/server";

import { db, type User } from "@/db";
import { normalizeEmail } from "@/server/foundation/email";
import {
  findActiveUserByClerkId,
  type UserLookupDb,
} from "@/server/repositories/users/find-active-user-by-clerk-id";
import { apiErrorResponse } from "@/server/foundation/responses";

import { forbiddenError, unauthorizedError } from "./errors";

type Db = typeof db;

export type ApiContext = {
  db: Db;
  requestId: string;
  user: User;
  userEmail: string | null;
};

export type ApiContextResult =
  | { ok: true; ctx: ApiContext }
  | { ok: false; response: Response };

export async function createApiContext(
  database: UserLookupDb = db as UserLookupDb,
  requestId = crypto.randomUUID(),
): Promise<ApiContextResult> {
  const session = await auth();

  if (!session.userId) {
    return {
      ok: false,
      response: apiErrorResponse(unauthorizedError()),
    };
  }

  const user = await findActiveUserByClerkId(database, session.userId);

  if (!user) {
    return {
      ok: false,
      response: apiErrorResponse(
        forbiddenError(
          "Authenticated user has not been synchronized yet",
          "user_not_synced",
        ),
      ),
    };
  }

  return {
    ok: true,
    ctx: {
      db: database as Db,
      requestId,
      user,
      userEmail: normalizeEmail(user.primaryEmail),
    },
  };
}
