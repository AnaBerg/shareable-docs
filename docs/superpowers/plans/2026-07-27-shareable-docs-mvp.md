# Shareable Docs MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the gap between the existing docs API and a usable product: agents can upload an HTML doc from the CLI, and the team can open it through a link — either as a signed-in shared recipient or through a secret link.

**Architecture:** Existing layering is preserved. Route handlers in `src/app/api/**/route.ts` stay thin and delegate to `src/server/handlers/docs`; business rules live in `src/server/services/docs`; Drizzle queries in `src/server/repositories/docs`; Zod contracts in `src/types`. The viewer adds the first non-API surface: a server-rendered page at `src/app/d/[id]/page.tsx` that resolves access without an `ApiContext` (a secret-link visitor has no user) and renders stored HTML inside a sandboxed iframe.

**Tech Stack:** Next.js 16 (App Router), Clerk (session tokens + API keys), Drizzle ORM, Postgres, Zod 4, Vitest, Bun.

**Decisions taken before this plan:**
- Both sharing modes: share by email (already built) **and** an optional per-document secret link the owner enables.
- Agent authentication uses **Clerk API keys** (`acceptsToken`), not a local `api_keys` table.
- The agent-facing tool is a **skill + curl**, not a CLI or MCP server.

**Out of scope (follow-ups):** the owner dashboard UI (list/detail/share screens), `DELETE /api/docs/[id]`, revoking an individual email share, and listing a document's version history. Task 6 ships the minimum owner UI needed to obtain a secret link; the full dashboard is a separate plan.

---

## Task 0: Verify Clerk API Keys Availability

This task is a prerequisite check, not code. If it fails, stop and revisit the auth decision before doing Task 1.

- [ ] **Step 1: Confirm the installed Clerk version exposes the token types**

Run: `node -p "require('@clerk/backend/dist/tokens/tokenTypes')"` or inspect `node_modules/@clerk/backend/dist/tokens/tokenTypes.d.ts`.

Expected: `TokenType` includes `api_key` and `m2m_token`. (Verified on `@clerk/nextjs@7.5.2`.)

- [ ] **Step 2: Enable API Keys in the Clerk dashboard**

In the Clerk dashboard, enable the **API Keys** feature for the instance and confirm **user-scoped** keys can be created (not only organization-scoped).

This matters: for a user-scoped API key the auth object's `subject` is the Clerk **user** id, which maps directly onto `users.clerk_user_id` and therefore onto document ownership. An org-scoped key or an `m2m_token` has a machine/org subject with no owning user, which this data model cannot represent without a new column.

Expected: a test API key can be created for your own user, with a `sk_`-style secret shown once.

- [ ] **Step 3: Record the manual verification**

Note in the PR description that API Keys were enabled and that keys are user-scoped. There is no automated test that can cover a dashboard setting.

---

## Task 1: Accept API Keys In The API Context

**Files:**
- Modify: `src/server/foundation/context.ts`
- Modify: `src/server/foundation/context.test.ts`
- Modify: `src/proxy.ts`

- [ ] **Step 1: Add failing context tests**

Extend `src/server/foundation/context.test.ts` with cases that mock `auth()` to return a machine auth object:

```ts
it("resolves the user from an api_key subject", async () => {
  mockAuth({ tokenType: "api_key", subject: "user_123", isAuthenticated: true });

  const result = await createApiContext({ log, database });

  expect(result.ok).toBe(true);
});

it("rejects a machine token whose subject is not a user id", async () => {
  mockAuth({ tokenType: "m2m_token", subject: "mch_123", isAuthenticated: true });

  const result = await createApiContext({ log, database });

  expect(result).toMatchObject({ ok: false, error: { status: 401 } });
});
```

Follow the mocking style already used in the file for `@clerk/nextjs/server`.

- [ ] **Step 2: Verify the tests fail**

Run: `bun run test src/server/foundation/context.test.ts`

Expected: fail — `createApiContext` only reads `session.userId`.

- [ ] **Step 3: Resolve the Clerk user id from either token type**

In `createApiContext`, call `auth({ acceptsToken: ["session_token", "api_key"] })` and narrow on `tokenType`:

```ts
const session = await auth({ acceptsToken: ["session_token", "api_key"] });

const clerkUserId =
  session.tokenType === "session_token"
    ? session.userId
    : session.tokenType === "api_key" && session.subject.startsWith("user_")
      ? session.subject
      : null;

if (!clerkUserId) {
  return { ok: false, error: unauthorizedError() };
}
```

Everything downstream (`findActiveUserByClerkId`, `log.add({ clerkUserId })`, the `user_not_synced` conflict) stays unchanged — an API key resolves to the same `User` row as a browser session, so ownership and email sharing keep working without any new concept.

- [ ] **Step 4: Record the token type in the request log**

Add `log.add({ tokenType: session.tokenType })` so wide events distinguish agent traffic from browser traffic. This is the only observability signal that tells you whether the agent path is actually being used.

- [ ] **Step 5: Verify the context tests pass**

Run: `bun run test src/server/foundation/context.test.ts`

Expected: pass.

- [ ] **Step 6: Let API keys through the middleware**

`src/proxy.ts` calls `auth.protect()` on mutating API routes, which by default accepts only session tokens and would reject a valid API key before it reaches the handler. Update it:

```ts
await auth.protect({ token: ["session_token", "api_key"] });
```

- [ ] **Step 7: Verify the full suite still passes**

Run: `bun run test && bun run typecheck && bun run lint`

Expected: pass.

- [ ] **Step 8: Manually verify an end-to-end upload**

With a real API key against a local dev server:

```bash
curl -sS -X POST http://localhost:3000/api/docs \
  -H "Authorization: Bearer $SHAREABLE_DOCS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"Smoke test","html":"<h1>hello</h1>"}'
```

Expected: `201` with the created document. This is the first proof that the agent path works; do not proceed without it.

---

## Task 2: Secret Link Tokens

**Files:**
- Modify: `src/db/schema.ts`
- Create: `drizzle/0002_*.sql` via `bun run db:generate`
- Create: `src/server/foundation/helpers/share-token.ts` + test
- Create: `src/server/repositories/docs/find-share-link-by-document.ts` + test
- Create: `src/server/repositories/docs/upsert-share-link.ts` + test
- Create: `src/server/repositories/docs/revoke-share-link.ts` + test
- Create: `src/server/repositories/docs/find-document-by-share-token.ts` + test
- Modify: `src/types/docs.ts`

- [ ] **Step 1: Add failing schema tests**

Extend `src/db/schema.test.ts`:

```ts
expect(documentShareLinks.tokenHash).toBeDefined();
expect(documentShareLinks.revokedAt).toBeDefined();
```

- [ ] **Step 2: Verify the test fails**

Run: `bun run test src/db/schema.test.ts`

- [ ] **Step 3: Add the `document_share_links` table**

```ts
export const documentShareLinks = pgTable(
  "document_share_links",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id").notNull().references(() => documents.id),
    tokenHash: text("token_hash").notNull(),
    createdByUserId: text("created_by_user_id").notNull().references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(() => new Date()),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("document_share_links_token_hash_unique").on(table.tokenHash),
    index("document_share_links_document_id_idx").on(table.documentId),
  ],
);
```

One active link per document is enough for the MVP, but rows are kept rather than deleted so a revoked link stays auditable. Only the **hash** is stored: a leaked database dump must not hand over working links.

- [ ] **Step 4: Generate the migration**

Run: `bun run db:generate`

Expected: a migration creating `document_share_links`.

- [ ] **Step 5: Add failing token helper tests**

Create `src/server/foundation/helpers/share-token.test.ts`:

```ts
it("generates a url-safe token and a stable hash", () => {
  const { token, tokenHash } = createShareToken();

  expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(hashShareToken(token)).toBe(tokenHash);
});

it("does not leak the token through the hash", () => {
  const { token, tokenHash } = createShareToken();

  expect(tokenHash).not.toContain(token);
});
```

- [ ] **Step 6: Implement the token helper**

Create `src/server/foundation/helpers/share-token.ts` using Node's `crypto`: 32 random bytes encoded as `base64url` for the token, and SHA-256 (hex) for the hash. A random 256-bit token is unguessable, so a plain hash is sufficient here — no salt or KDF, because there is no low-entropy secret to protect.

- [ ] **Step 7: Verify the helper tests pass**

Run: `bun run test src/server/foundation/helpers/share-token.test.ts`

- [ ] **Step 8: Add the repository functions, test-first**

For each of `findShareLinkByDocument`, `upsertShareLink`, `revokeShareLink`, and `findDocumentByShareToken`, write the failing test first and then the Drizzle query, mirroring the existing files in `src/server/repositories/docs`. `findDocumentByShareToken` must filter on `revokedAt IS NULL` **and** on the document's `deletedAt IS NULL`, and return the document — the lookup is by hash, so it is a plain indexed equality query.

- [ ] **Step 9: Verify the repository tests pass**

Run: `bun run test src/server/repositories/docs`

---

## Task 3: Share Link Endpoints

**Files:**
- Create: `src/server/services/docs/create-share-link.ts` + test
- Create: `src/server/services/docs/revoke-share-link.ts` + test
- Create: `src/server/handlers/docs/share-link.ts` + test
- Modify: `src/server/handlers/docs/index.ts` + test
- Create: `src/app/api/docs/[id]/link/route.ts`
- Modify: `src/types/docs.ts`

- [ ] **Step 1: Add failing service tests**

In `src/server/services/docs/create-share-link.test.ts`, using `test-helpers.ts`:

```ts
it("returns the plaintext token only on creation", async () => {
  const result = await createShareLink(ctx, { id: documentId });

  expect(result.token).toEqual(expect.any(String));
});

it("rejects a non-owner", async () => {
  await expect(createShareLink(otherUserCtx, { id: documentId }))
    .rejects.toMatchObject({ status: 403 });
});
```

Creating or revoking a link is an **owner-only** action — a user with shared access must not be able to widen distribution.

- [ ] **Step 2: Verify the tests fail**

Run: `bun run test src/server/services/docs/create-share-link.test.ts`

- [ ] **Step 3: Implement the services**

`createShareLink` loads the document, requires `resolveDocumentAccess(...) === "owned"`, generates a token, upserts the link (replacing any existing one — creating a new link rotates and invalidates the old), and returns `{ url, token }`. `revokeShareLink` sets `revokedAt`.

The plaintext token is returned **only** from this call and never stored; a lost link must be rotated, not recovered.

- [ ] **Step 4: Add the handlers and route**

`POST /api/docs/[id]/link` creates/rotates, `DELETE /api/docs/[id]/link` revokes. Both go through `withApiHandler` and `documentRouteParamsSchema`, matching the shape of `share-document.ts`. Both methods are mutating, so `src/proxy.ts` already protects them.

- [ ] **Step 5: Verify handler tests pass**

Run: `bun run test src/server/handlers/docs`

- [ ] **Step 6: Verify the full suite**

Run: `bun run test && bun run typecheck && bun run lint`

---

## Task 4: Access Resolution Without A User

**Files:**
- Modify: `src/server/foundation/helpers/resolve-document-access.ts` + test
- Modify: `src/types/docs-repository.ts`

`resolveDocumentAccess` currently takes an `ApiContext`, which always carries a `User`. A secret-link visitor has no user at all, so the viewer in Task 5 cannot reuse it as written.

- [ ] **Step 1: Add failing tests for the viewer union**

```ts
it("grants link access when the token matches an active link", async () => {
  const access = await resolveDocumentAccess(
    { db, viewer: { kind: "link", token } },
    document,
  );

  expect(access).toBe("link");
});

it("denies a revoked token", async () => { /* ... */ });
```

- [ ] **Step 2: Verify the tests fail**

Run: `bun run test src/server/foundation/helpers/resolve-document-access.test.ts`

- [ ] **Step 3: Widen the signature**

Change the first parameter to `{ db, viewer }` where `viewer` is
`{ kind: "user"; userId: string; email: string | null } | { kind: "link"; token: string }`,
and add `"link"` to the `DocumentAccess` union. Owner and shared-email logic is unchanged; the link branch hashes the token and checks it points at this document through an active link.

- [ ] **Step 4: Update the existing callers**

`get-document.ts`, `update-document.ts`, `share-document.ts` and the Task 3 services pass `{ db: ctx.db, viewer: { kind: "user", userId: ctx.user.id, email: ctx.userEmail } }`. Their behaviour must not change.

- [ ] **Step 5: Guard writes against link access**

`update-document.ts` and the share services must treat `"link"` as insufficient. A secret link is read-only; assert this explicitly in their tests rather than relying on the viewer type never being constructed there.

- [ ] **Step 6: Verify the full suite**

Run: `bun run test && bun run typecheck && bun run lint`

---

## Task 5: Sandboxed Viewer Page

**Files:**
- Create: `src/app/d/[id]/page.tsx`
- Create: `src/app/d/[id]/viewer.test.ts`
- Create: `src/server/services/docs/view-document.ts` + test
- Modify: `src/proxy.ts`

This is the task that makes the product exist: until now nothing renders a stored document.

- [ ] **Step 1: Add failing view-service tests**

`viewDocument({ db, viewer, documentId, version })` returns `{ document, version, access }` or throws not-found/forbidden. It is deliberately separate from `getDocument`, which is bound to `ApiContext`.

```ts
it("resolves a document for a link viewer", async () => { /* ... */ });
it("hides existence from an unauthorized viewer", async () => {
  await expect(viewDocument({ db, viewer: anonymous, documentId }))
    .rejects.toMatchObject({ status: 404 });
});
```

Return **404, not 403**, for a viewer with no access. On a page that anyone can hit with a guessed ULID, a 403 confirms the document exists; a 404 does not.

- [ ] **Step 2: Verify the tests fail**

Run: `bun run test src/server/services/docs/view-document.test.ts`

- [ ] **Step 3: Implement the view service**

- [ ] **Step 4: Add the viewer page**

`src/app/d/[id]/page.tsx` is an async Server Component. Per Next.js 16, `params` and `searchParams` are promises:

```tsx
export default async function DocumentViewerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string; version?: string }>;
}) {
  const { id } = await params;
  const { t } = await searchParams;
  // build the viewer from the Clerk session when there is no token, otherwise from t
}
```

Resolve the viewer as: a `t` query param means link access; otherwise fall back to the Clerk session (owner or shared email). Call `notFound()` when the service throws not-found.

- [ ] **Step 5: Render the HTML in a sandboxed iframe**

Stored HTML is arbitrary and author-controlled. Render it with:

```tsx
<iframe
  srcDoc={version.html}
  sandbox="allow-scripts"
  className="h-full w-full border-0"
  title={document.name}
/>
```

`sandbox="allow-scripts"` **without** `allow-same-origin` puts the document in an opaque origin: scripts still run (so diagrams and interactive plans work) but cannot read our cookies, our DOM, or `localStorage` on our origin. Omitting `allow-same-origin` is what makes this safe — the two flags together are equivalent to no sandbox at all, so this pairing must be asserted in a test.

- [ ] **Step 6: Add a viewer regression test**

Assert that the rendered iframe carries `sandbox="allow-scripts"` and never `allow-same-origin`, and that the HTML is not injected via `dangerouslySetInnerHTML` anywhere. This is a security invariant that a future refactor could quietly break.

- [ ] **Step 7: Keep `/d/**` out of the protected matcher**

`src/proxy.ts` protects `/app` and `/dashboard`, so `/d/**` is already public — confirm this, and confirm `clerkMiddleware` still populates the session for signed-in visitors so shared-email access works on the same route.

- [ ] **Step 8: Verify the full suite**

Run: `bun run test && bun run typecheck && bun run lint`

- [ ] **Step 9: Manually verify all three access paths**

Open `/d/<id>` as the owner, as a signed-in shared recipient, and in a private window with `?t=<token>`. Then verify a revoked token gives a 404.

---

## Task 6: Minimal Owner Surface For Getting A Link

**Files:**
- Create: `src/app/app/page.tsx`
- Create: `src/app/app/documents-list.tsx`

The owner needs some way to obtain a secret link without hand-writing curl. This is the smallest possible surface, not the dashboard.

- [ ] **Step 1: List the owner's documents**

A Server Component at `/app` listing documents via the existing service layer, each row linking to `/d/<id>`. Use shadcn primitives per `.agents/skills/shadcn`.

- [ ] **Step 2: Add a "create share link" action**

A Server Action (or a small client component calling `POST /api/docs/[id]/link`) that returns the URL and lets the owner copy it. Show the token **once**, with a clear note that rotating replaces the previous link.

- [ ] **Step 3: Verify the route is protected**

`/app` already matches `isProtectedRoute` in `src/proxy.ts`. Confirm a signed-out visitor is redirected.

- [ ] **Step 4: Verify the full suite**

Run: `bun run test && bun run typecheck && bun run lint`

---

## Task 7: Agent Publishing Skill

**Files:**
- Create: `.claude/skills/publish-doc/SKILL.md`
- Create: `.agents/skills/publish-doc/SKILL.md` (or a symlink, matching how `shadcn` is mirrored)
- Modify: `.env.example`
- Modify: `README.md`

- [ ] **Step 1: Write the skill**

Frontmatter `name: publish-doc` and a description that triggers on "publish this doc", "share this plan with the team", "upload this HTML". Body covers:

- reading `SHAREABLE_DOCS_API_KEY` and `SHAREABLE_DOCS_URL` from the environment, never hardcoding them
- `POST /api/docs` to create, `PUT /api/docs/[id]` to publish a new version of an existing doc
- `POST /api/docs/[id]/link` to obtain a shareable link
- returning the `/d/<id>` URL to the user

Keep the curl invocations copy-pasteable and use `--fail-with-body` so a non-2xx response surfaces the API's error payload instead of failing silently.

- [ ] **Step 2: Document the required environment variables**

Add `SHAREABLE_DOCS_API_KEY` and `SHAREABLE_DOCS_URL` to `.env.example` with a comment that the key is a Clerk user-scoped API key. Note that the key belongs in the agent's environment, not in the app's `.env`.

- [ ] **Step 3: Replace the create-next-app README**

`README.md` is still the template boilerplate. Replace it with what this project actually is: the three access modes, how an agent authenticates, and a worked publish example.

- [ ] **Step 4: Verify the skill end-to-end**

From a fresh Claude Code session in another repo, ask the agent to publish an HTML file. Confirm the document appears at `/d/<id>` and that a teammate can open the secret link in a private window.

---

## Verification Checklist

- [ ] `bun run test` passes
- [ ] `bun run typecheck` passes
- [ ] `bun run lint` passes
- [ ] `bun run db:migrate` applies `0002` cleanly against a local Postgres
- [ ] An agent can publish with only an API key and get back a working URL
- [ ] A secret link works signed-out and stops working once revoked
- [ ] The viewer iframe carries `sandbox="allow-scripts"` and never `allow-same-origin`
- [ ] An unauthorized viewer gets 404, not 403
