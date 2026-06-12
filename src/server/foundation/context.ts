import { auth } from "@clerk/nextjs/server";
import { and, eq, isNull } from "drizzle-orm";

import { db, type User, users } from "@/db";

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

type DbLike = Db & {
  query: {
    users: {
      findFirst(args: unknown): Promise<User | undefined | null>;
    };
  };
};

export async function createApiContext(
  database: DbLike = db as DbLike,
  requestId = crypto.randomUUID(),
): Promise<ApiContextResult> {
  const session = await auth();

  if (!session.userId) {
    return {
      ok: false,
      response: errorResponse("unauthorized", "Authentication required", 401),
    };
  }

  const user = await database.query.users.findFirst({
    where: and(eq(users.clerkUserId, session.userId), isNull(users.deletedAt)),
  });

  if (!user) {
    return {
      ok: false,
      response: errorResponse(
        "user_not_synced",
        "Authenticated user has not been synchronized yet",
        409,
      ),
    };
  }

  return {
    ok: true,
    ctx: {
      db: database,
      requestId,
      user,
      userEmail: normalizeEmail(user.primaryEmail),
    },
  };
}

function normalizeEmail(email: string | null): string | null {
  const normalized = email?.trim().toLowerCase();
  return normalized === "" ? null : normalized ?? null;
}

function errorResponse(code: string, message: string, status: number): Response {
  return Response.json({ error: { code, message } }, { status });
}
