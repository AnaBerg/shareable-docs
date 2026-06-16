import { and, eq, isNull } from "drizzle-orm";

import { users, type User } from "@/db";

export type UserLookupDb = {
  query: {
    users: {
      findFirst(args: unknown): Promise<User | undefined | null>;
    };
  };
};

export async function findActiveUserByClerkId(
  db: UserLookupDb,
  clerkUserId: string,
) {
  return db.query.users.findFirst({
    where: and(eq(users.clerkUserId, clerkUserId), isNull(users.deletedAt)),
  });
}
