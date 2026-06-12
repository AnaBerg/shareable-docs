import { eq } from "drizzle-orm";

import { getDatabaseKind } from "@/db/env";
import { createPostgresDb } from "@/db/postgres/client";
import * as postgresSchema from "@/db/postgres/schema";
import { createSqliteDb } from "@/db/sqlite/client";
import * as sqliteSchema from "@/db/sqlite/schema";

export type ClerkUserLike = {
  id: string;
  primaryEmailAddressId?: string | null;
  emailAddresses?: Array<{
    id: string;
    emailAddress: string;
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

type SqliteUserWrite = Omit<
  LocalUserWrite,
  "createdAt" | "updatedAt" | "deletedAt"
> & {
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

type UserUpsertSet = Pick<
  LocalUserWrite,
  "primaryEmail" | "firstName" | "lastName" | "imageUrl" | "updatedAt" | "deletedAt"
>;

type SqliteUserUpsertSet = Pick<
  SqliteUserWrite,
  "primaryEmail" | "firstName" | "lastName" | "imageUrl" | "updatedAt" | "deletedAt"
>;

type UserTable = typeof postgresSchema.users | typeof sqliteSchema.users;

type DrizzleMutationResult = Promise<unknown> | unknown;

type DrizzleLike = {
  insert(table: UserTable): {
    values(value: LocalUserWrite | SqliteUserWrite): {
      onConflictDoUpdate(config: {
        target: UserTable["clerkUserId"];
        set: UserUpsertSet | SqliteUserUpsertSet;
      }): DrizzleMutationResult;
    };
  };
  update(table: UserTable): {
    set(value: Pick<UserUpsertSet | SqliteUserUpsertSet, "updatedAt" | "deletedAt">): {
      where(condition: unknown): DrizzleMutationResult;
    };
  };
};

export function mapClerkUser(user: ClerkUserLike): LocalUserWrite {
  const now = new Date();
  const primaryEmail =
    user.emailAddresses?.find((email) => email.id === user.primaryEmailAddressId)
      ?.emailAddress ?? null;

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
  database: DrizzleLike = createDefaultDatabase(),
): UserSyncRepository {
  if (getDatabaseKind() === "postgres") {
    return createPostgresUserSyncRepository(database);
  }

  return createSqliteUserSyncRepository(database);
}

function createPostgresUserSyncRepository(
  database: DrizzleLike,
): UserSyncRepository {
  const users = postgresSchema.users;

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
        .where(eq(users.clerkUserId, clerkUserId));
    },
  };
}

function createDefaultDatabase(): DrizzleLike {
  if (getDatabaseKind() === "postgres") {
    return createPostgresDb() as DrizzleLike;
  }

  return createSqliteDb() as DrizzleLike;
}

function createSqliteUserSyncRepository(
  database: DrizzleLike,
): UserSyncRepository {
  const users = sqliteSchema.users;

  return {
    async upsertUser(user) {
      const sqliteUser = toSqliteUser(user);

      await database.insert(users).values(sqliteUser).onConflictDoUpdate({
        target: users.clerkUserId,
        set: toSqliteUserUpsertSet(sqliteUser),
      });
    },
    async softDeleteUser(clerkUserId, deletedAt) {
      const deletedAtIso = deletedAt.toISOString();

      await database
        .update(users)
        .set({ updatedAt: deletedAtIso, deletedAt: deletedAtIso })
        .where(eq(users.clerkUserId, clerkUserId));
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

function toSqliteUser(user: LocalUserWrite): SqliteUserWrite {
  return {
    ...user,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    deletedAt: user.deletedAt?.toISOString() ?? null,
  };
}

function toSqliteUserUpsertSet(user: SqliteUserWrite): SqliteUserUpsertSet {
  return {
    primaryEmail: user.primaryEmail,
    firstName: user.firstName,
    lastName: user.lastName,
    imageUrl: user.imageUrl,
    updatedAt: user.updatedAt,
    deletedAt: user.deletedAt,
  };
}
