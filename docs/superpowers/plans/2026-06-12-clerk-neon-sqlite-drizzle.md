# Clerk Neon SQLite Drizzle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Clerk auth, Clerk user synchronization, Neon Postgres runtime support, and local SQLite fallback through Drizzle ORM.

**Architecture:** Clerk wraps the App Router shell and guards routes from `src/proxy.ts`. Database access lives under `src/db` with dialect-specific Drizzle schema/client modules selected by env. Clerk webhooks call a testable user-sync service that performs idempotent upserts and soft deletes.

**Tech Stack:** Next.js 16.2.9 App Router, React 19, Clerk, Drizzle ORM, Neon serverless Postgres, libSQL SQLite, Vitest, Bun.

---

## Acceptance Criteria

- `bun run lint` exits 0.
- `bun run typecheck` exits 0.
- `bun run test` exits 0.
- `bun run build` exits 0.
- `src/proxy.ts` uses Clerk's Next.js 16 Proxy-compatible middleware.
- `src/app/layout.tsx` wraps the app in `ClerkProvider`.
- `src/app/api/webhooks/clerk/route.ts` verifies Clerk webhook signatures and delegates supported events.
- `/api/webhooks/clerk` is not protected by Proxy.
- Database selection chooses Postgres when `DATABASE_URL` exists and SQLite otherwise.
- SQLite fallback defaults to `./data/local.db`.
- User sync handles `user.created`, `user.updated`, and `user.deleted` idempotently.
- `user.deleted` performs soft delete by setting `deletedAt`.
- Drizzle Postgres and SQLite migration configs exist.
- Generated migration files are committed.
- No `.env*`, local SQLite database, or `data/` runtime files are committed.

## File Map

- Modify `package.json`: add Clerk/Drizzle/driver dependencies and scripts.
- Modify `.gitignore`: ignore local SQLite runtime data.
- Create `vitest.config.ts`: unit test config.
- Create `src/db/env.ts`: pure environment selection helpers.
- Create `src/db/client.ts`: runtime database factory.
- Create `src/db/index.ts`: public database exports.
- Create `src/db/dialect/postgres.ts`: Neon Drizzle client.
- Create `src/db/dialect/sqlite.ts`: libSQL Drizzle client.
- Create `src/db/schema/postgres.ts`: Postgres `users` table.
- Create `src/db/schema/sqlite.ts`: SQLite `users` table.
- Create `drizzle.postgres.config.ts`: Drizzle Kit Postgres config.
- Create `drizzle.sqlite.config.ts`: Drizzle Kit SQLite config.
- Create `src/server/clerk/user-sync.ts`: testable Clerk user mapping and sync service.
- Create `src/server/clerk/user-sync.test.ts`: TDD tests for user sync.
- Create `src/db/env.test.ts`: TDD tests for database env selection.
- Create `src/app/api/webhooks/clerk/route.ts`: Clerk webhook Route Handler.
- Create `src/app/api/webhooks/clerk/route.test.ts`: webhook behavior tests.
- Create `src/proxy.ts`: Clerk route protection.
- Modify `src/app/layout.tsx`: wrap with `ClerkProvider`.
- Create `.env.example`: documented non-secret env shape.

## Task 1: Project Setup, Dependencies, And Test Harness

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`
- Create: `vitest.config.ts`
- Create: `.env.example`

- [ ] **Step 1: Install runtime dependencies**

Run:

```bash
bun add @clerk/nextjs @neondatabase/serverless @libsql/client drizzle
```

Expected: `package.json` and `bun.lock` update with the new runtime dependencies.

- [ ] **Step 2: Install development dependencies**

Run:

```bash
bun add -d drizzle-kit vitest
```

Expected: `package.json` and `bun.lock` update with the new dev dependencies.

- [ ] **Step 3: Add scripts**

Update `package.json` scripts to include:

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest",
  "db:generate:pg": "drizzle-kit generate --config=drizzle.postgres.config.ts",
  "db:migrate:pg": "drizzle-kit migrate --config=drizzle.postgres.config.ts",
  "db:generate:sqlite": "drizzle-kit generate --config=drizzle.sqlite.config.ts",
  "db:migrate:sqlite": "drizzle-kit migrate --config=drizzle.sqlite.config.ts",
  "db:studio": "drizzle-kit studio"
}
```

- [ ] **Step 4: Create Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
});
```

- [ ] **Step 5: Ignore local database files**

Append to `.gitignore`:

```gitignore
# local database
/data/
*.db
*.db-shm
*.db-wal
```

- [ ] **Step 6: Add env example**

Create `.env.example`:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SIGNING_SECRET=
SQLITE_PATH=./data/local.db

# Vercel/Neon runtime
DATABASE_URL=
DATABASE_URL_UNPOOLED=
```

- [ ] **Step 7: Verify setup**

Run:

```bash
bun run lint
bun run typecheck
bun run test
```

Expected:

- `bun run lint` exits 0.
- `bun run typecheck` exits 0.
- `bun run test` exits 0 with no tests found or no failing tests.

## Task 2: Drizzle Database Layer And Migrations

**Files:**
- Create: `src/db/env.test.ts`
- Create: `src/db/env.ts`
- Create: `src/db/client.ts`
- Create: `src/db/index.ts`
- Create: `src/db/dialect/postgres.ts`
- Create: `src/db/dialect/sqlite.ts`
- Create: `src/db/schema/postgres.ts`
- Create: `src/db/schema/sqlite.ts`
- Create: `drizzle.postgres.config.ts`
- Create: `drizzle.sqlite.config.ts`
- Generate: `drizzle/postgres/*`
- Generate: `drizzle/sqlite/*`

- [ ] **Step 1: Write failing env selection tests**

Create `src/db/env.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  getDatabaseKind,
  getMigrationDatabaseUrl,
  getSqlitePath,
  toLibsqlFileUrl,
} from "./env";

describe("database environment helpers", () => {
  it("chooses postgres when DATABASE_URL exists", () => {
    expect(getDatabaseKind({ DATABASE_URL: "postgres://example" })).toBe(
      "postgres",
    );
  });

  it("chooses sqlite when DATABASE_URL is absent", () => {
    expect(getDatabaseKind({ SQLITE_PATH: "./data/local.db" })).toBe("sqlite");
  });

  it("defaults sqlite path to ./data/local.db", () => {
    expect(getSqlitePath({})).toBe("./data/local.db");
  });

  it("converts sqlite paths to libsql file URLs", () => {
    expect(toLibsqlFileUrl("./data/local.db")).toBe("file:./data/local.db");
    expect(toLibsqlFileUrl("file:./data/local.db")).toBe(
      "file:./data/local.db",
    );
  });

  it("prefers unpooled migration url when present", () => {
    expect(
      getMigrationDatabaseUrl({
        DATABASE_URL: "postgres://pooled",
        DATABASE_URL_UNPOOLED: "postgres://unpooled",
      }),
    ).toBe("postgres://unpooled");
  });

  it("falls back to runtime postgres url for migrations", () => {
    expect(
      getMigrationDatabaseUrl({ DATABASE_URL: "postgres://pooled" }),
    ).toBe("postgres://pooled");
  });
});
```

- [ ] **Step 2: Run env tests and verify RED**

Run:

```bash
bun run test src/db/env.test.ts
```

Expected: FAIL because `src/db/env.ts` does not exist.

- [ ] **Step 3: Implement env helpers**

Create `src/db/env.ts`:

```ts
export type DatabaseKind = "postgres" | "sqlite";

type DatabaseEnv = Partial<
  Pick<NodeJS.ProcessEnv, "DATABASE_URL" | "DATABASE_URL_UNPOOLED" | "SQLITE_PATH">
>;

export function getDatabaseKind(env: DatabaseEnv = process.env): DatabaseKind {
  return env.DATABASE_URL ? "postgres" : "sqlite";
}

export function getSqlitePath(env: DatabaseEnv = process.env): string {
  return env.SQLITE_PATH || "./data/local.db";
}

export function toLibsqlFileUrl(path: string): string {
  return path.startsWith("file:") ? path : `file:${path}`;
}

export function getMigrationDatabaseUrl(env: DatabaseEnv = process.env): string {
  const url = env.DATABASE_URL_UNPOOLED || env.DATABASE_URL;

  if (!url) {
    throw new Error("DATABASE_URL or DATABASE_URL_UNPOOLED is required for Postgres migrations.");
  }

  return url;
}
```

- [ ] **Step 4: Verify env tests pass**

Run:

```bash
bun run test src/db/env.test.ts
```

Expected: PASS.

- [ ] **Step 5: Add dialect-specific schemas**

Create `src/db/schema/postgres.ts`:

```ts
import { index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    clerkUserId: text("clerk_user_id").notNull(),
    primaryEmail: text("primary_email"),
    firstName: text("first_name"),
    lastName: text("last_name"),
    imageUrl: text("image_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("users_clerk_user_id_unique").on(table.clerkUserId),
    index("users_primary_email_idx").on(table.primaryEmail),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
```

Create `src/db/schema/sqlite.ts`:

```ts
import { index, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    clerkUserId: text("clerk_user_id").notNull(),
    primaryEmail: text("primary_email"),
    firstName: text("first_name"),
    lastName: text("last_name"),
    imageUrl: text("image_url"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    deletedAt: text("deleted_at"),
  },
  (table) => [
    uniqueIndex("users_clerk_user_id_unique").on(table.clerkUserId),
    index("users_primary_email_idx").on(table.primaryEmail),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
```

- [ ] **Step 6: Add database clients**

Create `src/db/dialect/postgres.ts`:

```ts
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../schema/postgres";

export function createPostgresDb(databaseUrl: string) {
  return drizzle(neon(databaseUrl), { schema });
}
```

Create `src/db/dialect/sqlite.ts`:

```ts
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { toLibsqlFileUrl } from "../env";
import * as schema from "../schema/sqlite";

export function createSqliteDb(path: string) {
  const client = createClient({ url: toLibsqlFileUrl(path) });
  return drizzle(client, { schema });
}
```

Create `src/db/client.ts`:

```ts
import { getDatabaseKind, getSqlitePath } from "./env";
import { createPostgresDb } from "./dialect/postgres";
import { createSqliteDb } from "./dialect/sqlite";

export function createDb(env: NodeJS.ProcessEnv = process.env) {
  if (getDatabaseKind(env) === "postgres") {
    if (!env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required for Postgres runtime.");
    }

    return createPostgresDb(env.DATABASE_URL);
  }

  return createSqliteDb(getSqlitePath(env));
}

export const db = createDb();
```

Create `src/db/index.ts`:

```ts
export { createDb, db } from "./client";
export { getDatabaseKind, getMigrationDatabaseUrl, getSqlitePath } from "./env";
```

- [ ] **Step 7: Add Drizzle Kit configs**

Create `drizzle.postgres.config.ts`:

```ts
import { defineConfig } from "drizzle-kit";
import { getMigrationDatabaseUrl } from "./src/db/env";

export default defineConfig({
  schema: "./src/db/schema/postgres.ts",
  out: "./drizzle/postgres",
  dialect: "postgresql",
  dbCredentials: {
    url: getMigrationDatabaseUrl(),
  },
});
```

Create `drizzle.sqlite.config.ts`:

```ts
import { defineConfig } from "drizzle-kit";
import { getSqlitePath, toLibsqlFileUrl } from "./src/db/env";

export default defineConfig({
  schema: "./src/db/schema/sqlite.ts",
  out: "./drizzle/sqlite",
  dialect: "sqlite",
  dbCredentials: {
    url: toLibsqlFileUrl(getSqlitePath()),
  },
});
```

- [ ] **Step 8: Generate migrations**

Run:

```bash
bun run db:generate:sqlite
DATABASE_URL=postgres://user:pass@localhost:5432/shareable_docs bun run db:generate:pg
```

Expected:

- `drizzle/sqlite` contains an initial users migration.
- `drizzle/postgres` contains an initial users migration.
- No command attempts to connect to the sample Postgres URL during generation.

- [ ] **Step 9: Verify database layer**

Run:

```bash
bun run test src/db/env.test.ts
bun run typecheck
```

Expected: both commands exit 0.

## Task 3: Clerk User Sync Service

**Files:**
- Create: `src/server/clerk/user-sync.test.ts`
- Create: `src/server/clerk/user-sync.ts`

- [ ] **Step 1: Write failing user sync tests**

Create `src/server/clerk/user-sync.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import {
  mapClerkUser,
  syncClerkUserDeleted,
  syncClerkUserUpserted,
  type ClerkUserLike,
  type UserSyncRepository,
} from "./user-sync";

function clerkUser(overrides: Partial<ClerkUserLike> = {}): ClerkUserLike {
  return {
    id: "user_123",
    primaryEmailAddressId: "email_1",
    emailAddresses: [{ id: "email_1", emailAddress: "ada@example.com" }],
    firstName: "Ada",
    lastName: "Lovelace",
    imageUrl: "https://example.com/ada.png",
    ...overrides,
  };
}

describe("mapClerkUser", () => {
  it("maps stable Clerk user fields", () => {
    expect(mapClerkUser(clerkUser())).toMatchObject({
      clerkUserId: "user_123",
      primaryEmail: "ada@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      imageUrl: "https://example.com/ada.png",
    });
  });

  it("stores null email when primary email is unavailable", () => {
    expect(
      mapClerkUser(
        clerkUser({ primaryEmailAddressId: "missing", emailAddresses: [] }),
      ).primaryEmail,
    ).toBeNull();
  });
});

describe("syncClerkUserUpserted", () => {
  it("upserts mapped users and clears deletedAt", async () => {
    const repo: UserSyncRepository = {
      upsertUser: vi.fn().mockResolvedValue(undefined),
      softDeleteUser: vi.fn().mockResolvedValue(undefined),
    };

    await syncClerkUserUpserted(repo, clerkUser());

    expect(repo.upsertUser).toHaveBeenCalledWith(
      expect.objectContaining({
        clerkUserId: "user_123",
        primaryEmail: "ada@example.com",
        deletedAt: null,
      }),
    );
  });
});

describe("syncClerkUserDeleted", () => {
  it("soft deletes when Clerk user id exists", async () => {
    const repo: UserSyncRepository = {
      upsertUser: vi.fn().mockResolvedValue(undefined),
      softDeleteUser: vi.fn().mockResolvedValue(undefined),
    };

    await syncClerkUserDeleted(repo, { id: "user_123" });

    expect(repo.softDeleteUser).toHaveBeenCalledWith("user_123", expect.any(Date));
  });

  it("ignores deletes without an id", async () => {
    const repo: UserSyncRepository = {
      upsertUser: vi.fn().mockResolvedValue(undefined),
      softDeleteUser: vi.fn().mockResolvedValue(undefined),
    };

    await syncClerkUserDeleted(repo, {});

    expect(repo.softDeleteUser).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run user sync tests and verify RED**

Run:

```bash
bun run test src/server/clerk/user-sync.test.ts
```

Expected: FAIL because `src/server/clerk/user-sync.ts` does not exist.

- [ ] **Step 3: Implement user sync service**

Create `src/server/clerk/user-sync.ts`:

```ts
import { randomUUID } from "node:crypto";

export type ClerkEmailAddressLike = {
  id: string;
  emailAddress: string;
};

export type ClerkUserLike = {
  id: string;
  primaryEmailAddressId?: string | null;
  emailAddresses?: ClerkEmailAddressLike[];
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

export function mapClerkUser(user: ClerkUserLike, now = new Date()): LocalUserWrite {
  const primaryEmail =
    user.emailAddresses?.find((email) => email.id === user.primaryEmailAddressId)
      ?.emailAddress ?? null;

  return {
    id: randomUUID(),
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
  repository: UserSyncRepository,
  user: ClerkUserLike,
): Promise<void> {
  await repository.upsertUser(mapClerkUser(user));
}

export async function syncClerkUserDeleted(
  repository: UserSyncRepository,
  user: { id?: string | null },
  now = new Date(),
): Promise<void> {
  if (!user.id) {
    return;
  }

  await repository.softDeleteUser(user.id, now);
}
```

- [ ] **Step 4: Verify user sync tests pass**

Run:

```bash
bun run test src/server/clerk/user-sync.test.ts
```

Expected: PASS.

- [ ] **Step 5: Wire Drizzle repository**

Extend `src/server/clerk/user-sync.ts` with the following Drizzle-backed repository factory:

```ts
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { getDatabaseKind } from "@/db/env";
import { users as postgresUsers } from "@/db/schema/postgres";
import { users as sqliteUsers } from "@/db/schema/sqlite";
```

Add these helpers and export:

```ts
type DrizzleLike = {
  insert: (table: unknown) => {
    values: (value: unknown) => {
      onConflictDoUpdate: (config: unknown) => Promise<unknown>;
    };
  };
  update: (table: unknown) => {
    set: (value: unknown) => {
      where: (condition: unknown) => Promise<unknown>;
    };
  };
};

function toPostgresUser(user: LocalUserWrite) {
  return user;
}

function toSqliteUser(user: LocalUserWrite) {
  return {
    ...user,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    deletedAt: user.deletedAt?.toISOString() ?? null,
  };
}

export function createDrizzleUserSyncRepository(
  database = db as DrizzleLike,
): UserSyncRepository {
  if (getDatabaseKind() === "postgres") {
    return {
      async upsertUser(user) {
        await database
          .insert(postgresUsers)
          .values(toPostgresUser(user))
          .onConflictDoUpdate({
            target: postgresUsers.clerkUserId,
            set: {
              primaryEmail: user.primaryEmail,
              firstName: user.firstName,
              lastName: user.lastName,
              imageUrl: user.imageUrl,
              updatedAt: user.updatedAt,
              deletedAt: null,
            },
          });
      },
      async softDeleteUser(clerkUserId, deletedAt) {
        await database
          .update(postgresUsers)
          .set({ deletedAt })
          .where(eq(postgresUsers.clerkUserId, clerkUserId));
      },
    };
  }

  return {
    async upsertUser(user) {
      const sqliteUser = toSqliteUser(user);

      await database
        .insert(sqliteUsers)
        .values(sqliteUser)
        .onConflictDoUpdate({
          target: sqliteUsers.clerkUserId,
          set: {
            primaryEmail: sqliteUser.primaryEmail,
            firstName: sqliteUser.firstName,
            lastName: sqliteUser.lastName,
            imageUrl: sqliteUser.imageUrl,
            updatedAt: sqliteUser.updatedAt,
            deletedAt: null,
          },
        });
    },
    async softDeleteUser(clerkUserId, deletedAt) {
      await database
        .update(sqliteUsers)
        .set({ deletedAt: deletedAt.toISOString() })
        .where(eq(sqliteUsers.clerkUserId, clerkUserId));
    },
  };
}
```

The repository must:

- Upsert by `clerkUserId`.
- Preserve existing `id` and `createdAt` on conflict by excluding both from the conflict update `set`.
- Update `primaryEmail`, `firstName`, `lastName`, `imageUrl`, `updatedAt`, and `deletedAt`.
- Soft delete by setting `deletedAt`.

- [ ] **Step 6: Verify sync service**

Run:

```bash
bun run test src/server/clerk/user-sync.test.ts
bun run typecheck
```

Expected: both commands exit 0.

## Task 4: Clerk Next.js Integration And Webhook Route

**Files:**
- Modify: `src/app/layout.tsx`
- Create: `src/proxy.ts`
- Create: `src/app/api/webhooks/clerk/route.test.ts`
- Create: `src/app/api/webhooks/clerk/route.ts`

- [ ] **Step 1: Write failing webhook route tests**

Create `src/app/api/webhooks/clerk/route.test.ts`:

```ts
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

  it("syncs user.deleted events", async () => {
    const { verifyWebhook } = await import("@clerk/nextjs/webhooks");
    vi.mocked(verifyWebhook).mockResolvedValue({
      id: "evt_2",
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
      id: "evt_3",
      type: "session.created",
      data: {},
    } as never);

    const { POST } = await import("./route");
    const response = await POST(new Request("https://app.test/api/webhooks/clerk"));

    expect(response.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run route tests and verify RED**

Run:

```bash
bun run test src/app/api/webhooks/clerk/route.test.ts
```

Expected: FAIL because `route.ts` does not exist.

- [ ] **Step 3: Implement webhook route**

Create `src/app/api/webhooks/clerk/route.ts`:

```ts
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import {
  createDrizzleUserSyncRepository,
  syncClerkUserDeleted,
  syncClerkUserUpserted,
  type ClerkUserLike,
} from "@/server/clerk/user-sync";

export const runtime = "nodejs";

const SUPPORTED_EVENTS = new Set(["user.created", "user.updated", "user.deleted"]);

export async function POST(req: Request): Promise<Response> {
  let event: { id?: string; type: string; data: unknown };

  try {
    event = await verifyWebhook(req);
  } catch (error) {
    console.error("Invalid Clerk webhook signature", error);
    return new Response("Invalid webhook signature", { status: 400 });
  }

  if (!SUPPORTED_EVENTS.has(event.type)) {
    console.info("Ignoring unsupported Clerk webhook event", {
      id: event.id,
      type: event.type,
    });
    return new Response("Ignored", { status: 200 });
  }

  const repository = createDrizzleUserSyncRepository();

  if (event.type === "user.deleted") {
    await syncClerkUserDeleted(repository, event.data as { id?: string | null });
    return new Response("OK", { status: 200 });
  }

  await syncClerkUserUpserted(repository, event.data as ClerkUserLike);
  return new Response("OK", { status: 200 });
}
```

- [ ] **Step 4: Add Clerk provider to layout**

Wrap `src/app/layout.tsx` body with Clerk:

```tsx
import { ClerkProvider } from "@clerk/nextjs";
```

Return shape:

```tsx
return (
  <ClerkProvider>
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  </ClerkProvider>
);
```

- [ ] **Step 5: Add Clerk Proxy**

Create `src/proxy.ts`:

```ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher([
  "/app(.*)",
  "/dashboard(.*)",
  "/api/(?!webhooks/clerk).*",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
```

- [ ] **Step 6: Verify Clerk integration**

Run:

```bash
bun run test src/app/api/webhooks/clerk/route.test.ts
bun run lint
bun run typecheck
```

Expected: all commands exit 0.

## Task 5: Final Integration Validation

**Files:**
- Review and modify only files already touched by Tasks 1-4 when a verification command exposes a concrete failure.

- [ ] **Step 1: Run full automated verification**

Run:

```bash
bun run lint
bun run typecheck
bun run test
bun run build
```

Expected: all commands exit 0.

- [ ] **Step 2: Verify generated files and ignored files**

Run:

```bash
git status --short
git check-ignore data/local.db
git ls-files '.env*' 'data/*' '*.db'
```

Expected:

- `git status --short` shows only intended source/config/migration files.
- `git check-ignore data/local.db` exits 0.
- `git ls-files '.env*' 'data/*' '*.db'` prints nothing except `.env.example` if explicitly tracked through a negated pattern.

- [ ] **Step 3: Review acceptance criteria**

Compare final code against every item in the Acceptance Criteria section. Record any gap before claiming completion.

- [ ] **Step 4: Commit final implementation**

Run:

```bash
git add package.json bun.lock .gitignore .env.example vitest.config.ts drizzle.postgres.config.ts drizzle.sqlite.config.ts drizzle src db src/proxy.ts src/app/layout.tsx src/app/api/webhooks/clerk
git commit -m "feat: add clerk neon sqlite drizzle foundation"
```

Expected: one implementation commit after all checks pass.
