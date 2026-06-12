# Local Postgres Docker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the SQLite local fallback with a Dockerized local Postgres database while keeping Neon/Postgres for Vercel.

**Architecture:** Use a single Postgres dialect everywhere. `DATABASE_URL` is required for runtime database access, local development gets it from Docker Compose, and Drizzle has one Postgres schema/config/migration pipeline.

**Tech Stack:** Next.js 16.2.9, Clerk, Drizzle ORM, Neon serverless Postgres, Docker Compose Postgres, T3 Env, Vitest, Bun.

---

## Acceptance Criteria

- No runtime dependency on `@libsql/client`.
- No `src/db/sqlite` files.
- No `drizzle.sqlite.config.ts`.
- No `drizzle/sqlite` migration folder.
- One Postgres Drizzle config exists at `drizzle.config.ts`.
- One migration folder exists at `drizzle/`.
- `docker-compose.yml` provides a local Postgres service named `postgres`.
- `.env.example` documents the local Docker Postgres `DATABASE_URL`.
- `package.json` provides `db:local:up`, `db:local:down`, `db:local:logs`, `db:generate`, `db:migrate`, and `db:studio`.
- `src/db/env.ts` uses T3 Env and requires `DATABASE_URL` for runtime DB access.
- `src/server/clerk/user-sync.ts` is Postgres-only.
- `bun run lint`, `bun run typecheck`, `bun run test`, `bun run build`, and `DATABASE_URL=postgres://shareable_docs:shareable_docs@localhost:5432/shareable_docs bun run db:generate` pass.

## Task 1: Postgres-Only DB Layer

**Files:**
- Modify: `package.json`
- Modify: `bun.lock`
- Modify: `src/db/env.ts`
- Modify: `src/db/env.test.ts`
- Modify: `src/db/client.ts`
- Modify: `src/db/index.ts`
- Move: `src/db/postgres/schema.ts` to `src/db/schema.ts`
- Delete: `src/db/postgres/client.ts`
- Delete: `src/db/postgres/schema.ts`
- Delete: `src/db/sqlite/client.ts`
- Delete: `src/db/sqlite/schema.ts`
- Modify: `src/server/clerk/user-sync.ts`
- Modify: `src/server/clerk/user-sync.test.ts`

- [ ] **Step 1: Write failing env tests**

Update `src/db/env.test.ts` so missing runtime database URL throws:

```ts
it("requires DATABASE_URL for runtime database access", () => {
  expect(() => getDatabaseUrl({})).toThrow(
    "DATABASE_URL is required for database connections.",
  );
});
```

Run:

```bash
bun run test src/db/env.test.ts
```

Expected: FAIL because `getDatabaseUrl` does not exist.

- [ ] **Step 2: Implement Postgres-only env helpers**

`src/db/env.ts` must export:

```ts
export const env = createEnv({ ... });
export function getDatabaseUrl(runtimeEnv = env): string;
export function getMigrationDatabaseUrl(runtimeEnv = env): string;
```

`getDatabaseUrl` throws `DATABASE_URL is required for database connections.` when absent.

`getMigrationDatabaseUrl` uses `DATABASE_URL_UNPOOLED || DATABASE_URL` and throws `DATABASE_URL or DATABASE_URL_UNPOOLED is required for Postgres migrations.` when both are absent.

Remove `DatabaseKind`, `getDatabaseKind`, `getSqlitePath`, and `toLibsqlFileUrl`.

- [ ] **Step 3: Simplify DB client and schema**

Move the Postgres schema to `src/db/schema.ts`.

`src/db/client.ts` should create only the Neon/Postgres Drizzle client:

```ts
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { getDatabaseUrl } from "./env";
import * as schema from "./schema";

export function createDb(databaseUrl = getDatabaseUrl()) {
  return drizzle(neon(databaseUrl), { schema });
}

export const db = createDb();
```

`src/db/index.ts` should export `createDb`, `db`, env helpers, and schema.

- [ ] **Step 4: Remove SQLite from user sync**

Update `src/server/clerk/user-sync.ts` to import only `users` from `@/db/schema` and remove SQLite-specific types/conversions/branches.

`createDrizzleUserSyncRepository(database = createDb())` should always return the Postgres repository.

Keep tests for mapping, upsert, and soft delete passing.

- [ ] **Step 5: Remove libSQL dependency**

Run:

```bash
bun remove @libsql/client
```

Expected: `package.json` and `bun.lock` no longer contain `@libsql/client`.

- [ ] **Step 6: Verify Task 1**

Run:

```bash
bun run test src/db/env.test.ts src/server/clerk/user-sync.test.ts
bun run typecheck
bun run lint
```

Expected: all commands exit 0.

## Task 2: Docker Compose And Drizzle Migration Pipeline

**Files:**
- Create: `docker-compose.yml`
- Modify: `.env.example`
- Modify: `.gitignore`
- Modify: `package.json`
- Move: `drizzle.postgres.config.ts` to `drizzle.config.ts`
- Delete: `drizzle.postgres.config.ts`
- Delete: `drizzle.sqlite.config.ts`
- Move: `drizzle/postgres/*` to `drizzle/*`
- Delete: `drizzle/postgres`
- Delete: `drizzle/sqlite`

- [ ] **Step 1: Add Docker Compose**

Create `docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:17-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: shareable_docs
      POSTGRES_PASSWORD: shareable_docs
      POSTGRES_DB: shareable_docs
    volumes:
      - shareable_docs_postgres:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U shareable_docs -d shareable_docs"]
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  shareable_docs_postgres:
```

- [ ] **Step 2: Update env example**

Replace `SQLITE_PATH` with:

```bash
DATABASE_URL=postgres://shareable_docs:shareable_docs@localhost:5432/shareable_docs
DATABASE_URL_UNPOOLED=
```

- [ ] **Step 3: Update scripts**

Replace old DB scripts with:

```json
{
  "db:local:up": "docker compose up -d postgres",
  "db:local:down": "docker compose down",
  "db:local:logs": "docker compose logs -f postgres",
  "db:generate": "drizzle-kit generate --config=drizzle.config.ts",
  "db:migrate": "drizzle-kit migrate --config=drizzle.config.ts",
  "db:studio": "drizzle-kit studio --config=drizzle.config.ts"
}
```

- [ ] **Step 4: Collapse Drizzle config and migrations**

Move `drizzle.postgres.config.ts` to `drizzle.config.ts` and point it at `./src/db/schema.ts` and `./drizzle`.

Move Postgres migration files from `drizzle/postgres` to `drizzle`.

Delete SQLite migration/config files.

- [ ] **Step 5: Verify Task 2**

Run:

```bash
DATABASE_URL=postgres://shareable_docs:shareable_docs@localhost:5432/shareable_docs bun run db:generate
bun run typecheck
bun run lint
```

Expected: Drizzle reports no schema changes and both checks exit 0.

## Final Verification

- [ ] Run:

```bash
bun run lint
bun run typecheck
bun run test
bun run build
DATABASE_URL=postgres://shareable_docs:shareable_docs@localhost:5432/shareable_docs bun run db:generate
```

- [ ] Confirm:

```bash
! rg -n "sqlite|SQLite|libsql|@libsql|SQLITE_PATH|drizzle.sqlite|db:generate:sqlite|db:migrate:sqlite" src package.json .env.example drizzle.config.ts docker-compose.yml
```

Expected: no matches.
