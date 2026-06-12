import { and, eq, isNull } from "drizzle-orm";

import { createDb } from "@/db";
import { users } from "@/db/schema";

export type ClerkUserLike = {
  id: string;
  primaryEmailAddressId?: string | null;
  emailAddresses?: Array<{
    id: string;
    emailAddress?: string | null;
  }>;
  firstName?: string | null;
  lastName?: string | null;
  imageUrl?: string | null;
};

export type LocalUserWrite = {
  id: string;
  clerkUserId: string;
  primaryEmail: string | null;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

export type UserSyncRepository = {
  upsertUser(user: LocalUserWrite): Promise<void>;
  softDeleteUser(clerkUserId: string, deletedAt: Date): Promise<void>;
};

type UserUpsertSet = Pick<
  LocalUserWrite,
  "primaryEmail" | "firstName" | "lastName" | "imageUrl" | "updatedAt" | "deletedAt"
>;

type DrizzleMutationResult = Promise<unknown> | unknown;

type DrizzleLike = {
  insert(table: typeof users): {
    values(value: LocalUserWrite): {
      onConflictDoUpdate(config: {
        target: typeof users.clerkUserId;
        set: UserUpsertSet;
      }): DrizzleMutationResult;
    };
  };
  update(table: typeof users): {
    set(value: Pick<UserUpsertSet, "updatedAt" | "deletedAt">): {
      where(condition: unknown): DrizzleMutationResult;
    };
  };
};

export function mapClerkUser(user: ClerkUserLike): LocalUserWrite {
  const now = new Date();
  const primaryEmailAddress = user.emailAddresses?.find(
    (email) => email.id === user.primaryEmailAddressId,
  )?.emailAddress;
  const primaryEmail =
    primaryEmailAddress === "" ? null : primaryEmailAddress ?? null;

  return {
    id: crypto.randomUUID(),
    clerkUserId: user.id,
    primaryEmail,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    imageUrl: user.imageUrl ?? null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

export async function syncClerkUserUpserted(
  repo: UserSyncRepository,
  user: ClerkUserLike,
): Promise<void> {
  await repo.upsertUser({
    ...mapClerkUser(user),
    deletedAt: null,
  });
}

export async function syncClerkUserDeleted(
  repo: UserSyncRepository,
  user: { id?: string | null },
): Promise<void> {
  if (!user.id) {
    return;
  }

  await repo.softDeleteUser(user.id, new Date());
}

export function createDrizzleUserSyncRepository(
  database: DrizzleLike = createDb(),
): UserSyncRepository {
  return {
    async upsertUser(user) {
      await database.insert(users).values(user).onConflictDoUpdate({
        target: users.clerkUserId,
        set: toUserUpsertSet(user),
      });
    },
    async softDeleteUser(clerkUserId, deletedAt) {
      await database
        .update(users)
        .set({ updatedAt: deletedAt, deletedAt })
        .where(and(eq(users.clerkUserId, clerkUserId), isNull(users.deletedAt)));
    },
  };
}

function toUserUpsertSet(user: LocalUserWrite): UserUpsertSet {
  return {
    primaryEmail: user.primaryEmail,
    firstName: user.firstName,
    lastName: user.lastName,
    imageUrl: user.imageUrl,
    updatedAt: user.updatedAt,
    deletedAt: user.deletedAt,
  };
}
