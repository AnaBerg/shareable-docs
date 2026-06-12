import { auth } from "@clerk/nextjs/server";
import { and, eq, isNull } from "drizzle-orm";

import { db, type User, users } from "@/db";
import { normalizeEmail } from "@/server/foundation/email";
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

type UserLookupDb = {
  query: {
    users: {
      findFirst(args: unknown): Promise<User | undefined | null>;
    };
  };
};

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

  const user = await database.query.users.findFirst({
    where: and(eq(users.clerkUserId, session.userId), isNull(users.deletedAt)),
  });

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
