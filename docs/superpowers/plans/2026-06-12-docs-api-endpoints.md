# Docs API Endpoints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build versioned HTML document APIs with shared endpoint foundation, authenticated API context, Drizzle persistence, Zod contracts, and tests.

**Architecture:** Next.js `src/app/api/**/route.ts` files stay thin and delegate to HTTP handlers in `src/server/handlers/docs/index.ts`. Generic API infrastructure lives in `src/server/foundation` and `src/server/handlers/api.ts`; business rules live in `src/server/services/docs`; Drizzle queries live in `src/server/repositories/docs`; Zod contracts and shared document types live in `src/types/docs.ts`.

**Tech Stack:** Next.js 16 Route Handlers, Clerk, Drizzle ORM, Postgres, Zod 4, Vitest, Bun.

---

## Task 1: Database Schema And Migration

**Files:**
- Modify: `src/db/schema.ts`
- Create: `drizzle/0001_*.sql` via `bun run db:generate`
- Modify: `drizzle/meta/_journal.json` via Drizzle Kit
- Create/modify: `drizzle/meta/0001_snapshot.json` via Drizzle Kit

- [ ] **Step 1: Add failing schema tests**

Create `src/db/schema.test.ts` with assertions that `documents`, `documentVersions`, and `documentShares` are exported and expose the required Drizzle column keys:

```ts
import { describe, expect, it } from "vitest";

import { documentShares, documentVersions, documents } from "./schema";

describe("documents schema", () => {
  it("exports document tables with required columns", () => {
    expect(documents.id).toBeDefined();
    expect(documents.ownerUserId).toBeDefined();
    expect(documentVersions.versionNumber).toBeDefined();
    expect(documentVersions.html).toBeDefined();
    expect(documentShares.sharedWithEmail).toBeDefined();
  });
});
```

- [ ] **Step 2: Verify the test fails**

Run: `bun run test src/db/schema.test.ts`

Expected: fail because the document table exports do not exist.

- [ ] **Step 3: Add Drizzle tables**

Update `src/db/schema.ts` to define `documents`, `documentVersions`, and `documentShares` with the columns and indexes from the spec. Use `integer` and `foreignKey`/`.references()` from `drizzle-orm/pg-core` as appropriate.

- [ ] **Step 4: Verify schema test passes**

Run: `bun run test src/db/schema.test.ts`

Expected: pass.

- [ ] **Step 5: Generate migration**

Run: `bun run db:generate`

Expected: a new migration creates the three tables and indexes.

## Task 2: Document Types And Zod Contracts

**Files:**
- Create: `src/types/docs.ts`

- [ ] **Step 1: Add failing contract tests**

Create tests for request contracts and DB write contracts:

```ts
import { describe, expect, it } from "vitest";

import {
  createDocumentRequestSchema,
  getDocumentQuerySchema,
  listDocumentsQuerySchema,
  newDocumentShareSchema,
  shareDocumentRequestSchema,
} from "./docs";

describe("docs contracts", () => {
  it("normalizes create document descriptions", () => {
    expect(
      createDocumentRequestSchema.parse({
        name: "Report",
        description: "  ",
        html: "<h1>Report</h1>",
      }),
    ).toEqual({ name: "Report", description: null, html: "<h1>Report</h1>" });
  });

  it("rejects empty HTML", () => {
    expect(() =>
      createDocumentRequestSchema.parse({ name: "Report", html: "" }),
    ).toThrow();
  });

  it("parses version and list filters", () => {
    expect(getDocumentQuerySchema.parse({ version: "2" })).toEqual({ version: 2 });
    expect(listDocumentsQuerySchema.parse({})).toEqual({ access: "all" });
  });

  it("normalizes and deduplicates share emails", () => {
    expect(
      shareDocumentRequestSchema.parse({
        emails: [" Reader@Example.com ", "reader@example.com"],
      }),
    ).toEqual({ emails: ["reader@example.com"] });
  });

  it("validates normalized DB share inserts", () => {
    expect(() =>
      newDocumentShareSchema.parse({
        id: "01HZXJK8JHX7QY9N7K6X8Y2W0B",
        documentId: "01HZXJK8JHX7QY9N7K6X8Y2W0A",
        sharedWithEmail: "Reader@Example.com",
        sharedByUserId: "user_1",
        createdAt: new Date(),
      }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Verify tests fail**

Run: `bun run typecheck`

Expected: fail because `src/types/docs.ts` does not exist.

- [ ] **Step 3: Implement contracts**

Create `src/types/docs.ts` with Zod schemas for request bodies, query strings, route params, DB inserts, and inferred TypeScript types. Normalize email with `trim().toLowerCase()`, deduplicate share email arrays, and normalize blank descriptions to `null`.

- [ ] **Step 4: Verify contracts pass**

Run: `bun run typecheck`

Expected: pass.

## Task 3: API Foundation And Context

**Files:**
- Create: `src/server/foundation/errors.ts`
- Create: `src/server/foundation/logs.ts`
- Create: `src/server/foundation/context.ts`
- Create: `src/server/handlers/api.ts`
- Create: `src/server/foundation/context.test.ts`
- Create: `src/server/handlers/api.test.ts`

- [ ] **Step 1: Add failing foundation tests**

Write tests that prove:

```ts
// context.test.ts
// - unauthenticated Clerk auth returns a 401 Response
// - authenticated Clerk user without local active row returns a 409 Response
// - active local user returns ctx.user, ctx.userEmail, and ctx.db

// api.test.ts
// - withApiHandler converts API error objects into the expected JSON error response
// - withApiHandler converts unexpected errors into generic 500 JSON
// - parseJsonBody returns 422 validation_error for malformed JSON
// - parseWithSchema does not include submitted HTML in validation details
```

Mock `@clerk/nextjs/server` and use a small Drizzle-like fake DB for context tests.

- [ ] **Step 2: Verify foundation tests fail**

Run: `bun run test src/server/foundation/context.test.ts src/server/handlers/api.test.ts`

Expected: fail because foundation files do not exist.

- [ ] **Step 3: Implement foundation**

Implement:

```ts
// errors.ts
export type ApiError = {
  kind: "api_error";
  status: number;
  code: string;
  message: string;
  details?: unknown;
};
```

Add helper constructors for validation, unauthorized, forbidden, not found, conflict, and internal errors. Implement `logs.ts` as a canonical structured request event wrapper around `console.info`. Implement `context.ts` with `createApiContext(database = db)` and `auth()` from Clerk. Implement foundation helpers for JSON responses, request id extraction, safe JSON parsing, and Zod parsing. Implement `api.ts` with `withApiHandler`.

- [ ] **Step 4: Verify foundation passes**

Run: `bun run test src/server/foundation/context.test.ts src/server/handlers/api.test.ts`

Expected: pass.

## Task 4: Repository And Services

**Files:**
- Create: focused files under `src/server/repositories/docs/*.ts`
- Create: `src/server/services/docs/create-document.ts`
- Create: `src/server/services/docs/get-document.ts`
- Create: `src/server/services/docs/list-documents.ts`
- Create: `src/server/services/docs/share-document.ts`
- Create: `src/server/services/docs/update-document.ts`
- Create: one test file per service under `src/server/services/docs/*.test.ts`

- [ ] **Step 1: Add failing service tests**

Create service tests using an in-memory repository fake. Cover:

```ts
// createDocument creates metadata and version 1
// getDocument defaults to latest version
// getDocument returns a requested version
// shared email can read
// shared email cannot update
// owner can update and gets latestVersion + 1
// only owner can share
// listDocuments filters all, owned, and shared
// user without primary email gets no shared documents
```

- [ ] **Step 2: Verify service tests fail**

Run: `bun run test src/server/services/docs`

Expected: fail because services do not exist.

- [ ] **Step 3: Implement services**

Services should accept `{ db, user, userEmail }` from `ApiContext`, call focused repository functions, enforce authorization, and throw API error objects for expected failures. `updateDocument` should call a repository transaction that computes the next version and inserts the new immutable version.

- [ ] **Step 4: Implement repository**

Implement focused Drizzle query files under `src/server/repositories/docs`. Include:

```ts
createDocumentWithInitialVersion(input)
findDocumentAccess(documentId, userId, userEmail)
findDocumentVersion(documentId, version?)
listAccessibleDocuments(userId, userEmail, access)
createDocumentVersion(documentId, userId, html)
shareDocument(documentId, sharedByUserId, emails)
```

Use `onConflictDoNothing` for idempotent share inserts.

- [ ] **Step 5: Verify services pass**

Run: `bun run test src/server/services/docs`

Expected: pass.

## Task 5: HTTP Handlers And Next Route Adapters

**Files:**
- Create: `src/server/handlers/docs/index.ts`
- Create: `src/server/handlers/docs/index.test.ts`
- Create: `src/app/api/docs/route.ts`
- Create: `src/app/api/docs/[id]/route.ts`
- Create: `src/app/api/docs/share/[id]/route.ts`

- [ ] **Step 1: Add failing handler tests**

Write handler tests with mocked document services. Cover:

```ts
// POST /api/docs returns 201 and parses body
// GET /api/docs returns list response and validates access filter
// GET /api/docs/{id} awaits params and defaults latest version
// PUT /api/docs/{id} returns 403 when service throws forbidden ApiError
// POST /api/docs/share/{id} normalizes email input
```

- [ ] **Step 2: Verify handler tests fail**

Run: `bun run test src/server/handlers/docs`

Expected: fail because handlers do not exist.

- [ ] **Step 3: Implement HTTP handlers**

Implement named exports in `src/server/handlers/docs/index.ts`, for example:

```ts
export const POST = withApiHandler(async ({ request, ctx }) => {
  const body = await parseJsonBody(request);
  const input = parseWithSchema(createDocumentRequestSchema, body);
  return jsonResponse(await createDocument(ctx, input), { status: 201 });
});
```

Use Next.js 16 async route params by awaiting `routeContext.params` inside the handler wrapper or handler.

- [ ] **Step 4: Implement route adapters**

Each `src/app/api/docs/**/route.ts` should export `runtime = "nodejs"` and delegate to the matching function from `src/server/handlers/docs/index.ts`.

- [ ] **Step 5: Verify handlers pass**

Run: `bun run test src/server/handlers/docs`

Expected: pass.

## Task 6: Final Verification

**Files:**
- All touched implementation and test files.

- [ ] **Step 1: Run unit tests**

Run: `bun run test`

Expected: all tests pass.

- [ ] **Step 2: Run typecheck**

Run: `bun run typecheck`

Expected: exit code 0.

- [ ] **Step 3: Run lint**

Run: `bun run lint`

Expected: exit code 0.

- [ ] **Step 4: Review git diff**

Run: `git diff --stat` and `git diff --check`

Expected: no whitespace errors; diff only contains docs API implementation, migration, tests, and plan.
