# Clerk + Neon + Local Postgres Drizzle Design

## Context

This project is a Next.js 16.2.9 App Router application under `src/app`. The PR adds Clerk authentication, Clerk webhook user sync, Drizzle ORM, Neon Postgres for Vercel, and a Dockerized local Postgres database for development.

The local database direction is changing: local development should use a Dockerized Postgres database instead of SQLite. This keeps the local and deployed database dialects the same, removes dual-schema drift, and makes migrations simpler to reason about.

Next.js framework guidance is anchored to the version declared by the repository: `next` 16.2.9 in `package.json`. In Next.js 16, Middleware is now called Proxy, so the Clerk request guard belongs in `src/proxy.ts`, not `src/middleware.ts`.

Request-time APIs in Next.js 16 App Router are asynchronous. Code should `await` `headers()`, `cookies()`, `draftMode()`, route `params`, and page `params`/`searchParams` where applicable. When migrating examples or local patterns from Next.js 13/14, replace synchronous access such as `cookies().get(...)`, `headers().get(...)`, direct `draftMode()` access, or direct `params`/`searchParams` destructuring with the async Next.js 16 pattern.

## Decisions

- Use Drizzle ORM.
- Use Postgres as the only database dialect.
- Use Neon Postgres in Vercel through the Vercel Marketplace or Neon/Vercel integration.
- Use a local Docker Compose Postgres service for development.
- Remove SQLite, libSQL, SQLite-specific schema, SQLite migration config, and SQLite fallback behavior.
- Keep Clerk as the source of truth for identity.
- Keep a local `users` table synchronized from Clerk with `user.created`, `user.updated`, and `user.deleted` webhook events.
- Soft-delete local users on Clerk deletion by setting `deletedAt` instead of deleting the row.
- Keep database access out of Proxy because Proxy runs in the Edge runtime and should only perform lightweight auth routing.
- Use `@t3-oss/env-nextjs` and Zod for typed environment validation.
- Use the `postgres` driver with `drizzle-orm/postgres-js` so local Docker Postgres and Neon Postgres use the same runtime driver.

## Architecture

The application has four integration areas:

1. Clerk application shell

   `src/app/layout.tsx` wraps the app with `ClerkProvider`. UI can use Clerk components and hooks where needed.

2. Clerk request protection

   `src/proxy.ts` uses `clerkMiddleware()` and `createRouteMatcher()` from `@clerk/nextjs/server`.

   The initial protected set is narrow and explicit. When these routes are added, protect:

   - `/app(.*)`
   - `/dashboard(.*)`
   - future mutating API routes except public webhook routes

   `/api/webhooks/clerk` must remain public because Clerk webhook requests are not signed in as application users.

   Proxy should follow Next.js 16 Proxy conventions. If Proxy logic needs request data, prefer the `NextRequest` argument. If Next.js request-time helpers are introduced around protected route decisions, use their async forms.

3. Clerk webhook sync

   `src/app/api/webhooks/clerk/route.ts` exposes a public `POST` Route Handler. It uses `verifyWebhook()` from `@clerk/nextjs/webhooks`, then dispatches supported events into `src/server/clerk/user-sync.ts`.

   Event normalization helpers live outside the route file, for example in `src/app/api/webhooks/clerk/event.ts`, so the route file stays focused on verification, dispatch, and responses.

   The Route Handler exports `runtime = "nodejs"` to keep database driver expectations explicit.

   Route Handlers should follow Next.js 16 async request-time API conventions. Await `headers()`, `cookies()`, `draftMode()`, and route context `params` when they are used. Query strings inside Route Handlers can come from the `Request`/`NextRequest` URL APIs; page-level `searchParams` props are async and should be awaited.

4. Database layer

   `src/db` contains the Postgres schema, connection factory, typed database exports, and environment helpers. Application code imports from this layer instead of importing Drizzle drivers directly.

   The runtime database URL comes from `DATABASE_URL`. Local development gets that URL from `.env.local`, pointed at the Docker Postgres service. Vercel gets it from Neon integration env vars.

## Local Postgres

Local development uses `docker-compose.yml` with an official Postgres image. The service should be named `postgres` and expose port `5432` on localhost.

Recommended local settings:

```bash
POSTGRES_USER=shareable_docs
POSTGRES_PASSWORD=shareable_docs
POSTGRES_DB=shareable_docs
DATABASE_URL=postgres://shareable_docs:shareable_docs@localhost:5432/shareable_docs
```

The repository should provide scripts for common local database tasks:

```json
{
  "dev": "bun scripts/dev-preflight.mjs -- next dev",
  "dev:preflight": "bun scripts/dev-preflight.mjs",
  "db:local:up": "docker compose up -d postgres",
  "db:local:down": "docker compose down",
  "db:local:logs": "docker compose logs -f postgres"
}
```

`bun dev` runs a Docker/Compose preflight, starts the local Postgres service, waits for the container to be running and healthy, then launches `next dev`. `bun run dev:preflight` runs only the preflight checks. `db:local:up` remains available for manual use when only the database service is needed.

No local database data should be committed. If the Compose service uses a bind mount or named volume, the data directory must be ignored.

## Database Design

Start with a Postgres `users` schema that can support documents later:

- `id`: application-local primary key.
- `clerkUserId`: unique Clerk user id.
- `primaryEmail`: nullable text.
- `firstName`: nullable text.
- `lastName`: nullable text.
- `imageUrl`: nullable text.
- `createdAt`: timestamptz.
- `updatedAt`: timestamptz.
- `deletedAt`: nullable timestamptz.

`id` is generated by the application with `crypto.randomUUID()` before insert. This keeps id generation explicit and independent of database extensions.

Indexes:

- Unique index on `clerkUserId`.
- Non-unique index on `primaryEmail`.

The first document-related migration can later reference `users.id` for local relational integrity while still keeping `clerkUserId` available for direct auth lookups.

## Drizzle Layout

Use a Postgres-only structure:

```txt
src/db/
  index.ts
  client.ts
  env.ts
  env.test.ts
  schema.ts
```

Expected responsibilities:

- `schema.ts`: Postgres table definitions and relations.
- `client.ts`: creates the Neon/Postgres Drizzle client from `DATABASE_URL`.
- `env.ts`: validates and exposes typed env values plus small helper functions.
- `index.ts`: exports `db`, schema, and common helpers.

There should be one Drizzle Kit config:

```txt
drizzle.config.ts
```

The migration output should be:

```txt
drizzle/
```

Old SQLite-specific folders/configs should be removed from the implementation.

## Migrations

Use a single Postgres migration pipeline.

Recommended scripts:

```json
{
  "db:generate": "drizzle-kit generate --config=drizzle.config.ts",
  "db:migrate": "drizzle-kit migrate --config=drizzle.config.ts",
  "db:studio": "drizzle-kit studio --config=drizzle.config.ts"
}
```

For deployed Postgres migrations:

- Prefer `DATABASE_URL_UNPOOLED` for migration tooling when Vercel/Neon provides it.
- Use `DATABASE_URL` for application runtime.
- If only `DATABASE_URL` exists, migrations may use it, but the config should make that fallback visible.

## Environment Variables

Local development:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...
CLERK_WEBHOOK_SIGNING_SECRET=...
DATABASE_URL=postgres://shareable_docs:shareable_docs@localhost:5432/shareable_docs
DATABASE_URL_UNPOOLED=
```

Vercel production and preview:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...
CLERK_WEBHOOK_SIGNING_SECRET=...
DATABASE_URL=...
DATABASE_URL_UNPOOLED=...
```

Rules:

- `.env*` files stay uncommitted.
- `.env.example` documents the required keys.
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is the only Clerk key intended for browser exposure.
- `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET`, and database URLs are server-only secrets.
- `DATABASE_URL` is required for runtime database access in all environments.

## Vercel + Neon Setup

Use Vercel Marketplace storage or the Neon/Vercel integration to provision Neon. The integration should inject `DATABASE_URL` and, where available, `DATABASE_URL_UNPOOLED` into the connected Vercel project.

Preview branching can be enabled if the project needs isolated preview database branches. If enabled, preview migrations must be applied to the preview branch before testing preview deployments.

The database region should be chosen near Vercel Functions to reduce latency.

## Clerk Setup

Install `@clerk/nextjs`.

Configure Clerk API keys locally and in Vercel.

Create a Clerk webhook endpoint:

- Local testing URL: public tunnel URL ending in `/api/webhooks/clerk`.
- Production URL: deployed app URL ending in `/api/webhooks/clerk`.
- Subscribed events: `user.created`, `user.updated`, `user.deleted`.
- Signing secret env var: `CLERK_WEBHOOK_SIGNING_SECRET`.

For local webhook testing, use a tunnel such as ngrok or Cloudflare Tunnel because Clerk cannot reach `localhost` directly.

## Webhook Behavior

`POST /api/webhooks/clerk` should:

1. Verify the request with `verifyWebhook(req)`.
2. Return `400` for invalid signatures.
3. Dispatch supported event types.
4. Return `200` for unsupported event types after logging that they were ignored.
5. Use idempotent writes because Clerk webhooks are delivered by Svix and may be retried.

Event behavior:

- `user.created`: upsert the user by `clerkUserId`.
- `user.updated`: upsert the user by `clerkUserId` and clear `deletedAt`.
- `user.deleted`: set `deletedAt` when `clerkUserId` is present.

Email extraction should use the Clerk primary email when present. If it is missing, store `null` rather than guessing.

## Application Auth Flow

Server-side application code should read the Clerk user id from Clerk auth helpers, then load the local user by `clerkUserId`.

If the Clerk session exists but the local user row does not exist yet, code should handle the race explicitly. The preferred behavior is:

- For normal page rendering: show a recoverable account setup state or call a server-side ensure-user helper.
- For mutating APIs: return a clear `409` or run an idempotent ensure-user operation before writing dependent records.

This is necessary because Clerk webhooks are asynchronous and cannot be treated as part of the sign-up transaction.

## Error Handling

- Missing `DATABASE_URL` should fail fast during server database initialization.
- Missing Postgres migration URL should fail fast during Drizzle config loading.
- Webhook verification failures return `400`.
- Database write failures return `500` so Clerk/Svix retries the event.
- Unsupported webhook events return `200` to avoid retry loops.
- Logs should include webhook event id and type, but not secret values or full database URLs.

## Testing And Verification

Automated checks should cover:

- Environment validation exposes `DATABASE_URL`.
- Missing `DATABASE_URL` fails fast for runtime DB access.
- Migration URL selection prefers `DATABASE_URL_UNPOOLED`.
- Clerk user payload mapping extracts stable fields.
- `user.created` and `user.updated` perform idempotent upserts.
- `user.deleted` performs a soft delete.
- Webhook handler rejects invalid signatures.

Manual verification checklist:

- Start local Postgres and the Next.js dev server with `bun dev`.
- For database-only work, start local Postgres manually with `bun run db:local:up`.
- Set `DATABASE_URL` to the local Docker Postgres URL.
- Run Postgres migrations locally.
- Create or send a Clerk test `user.created` event through the Clerk Dashboard using a tunnel.
- Confirm the user exists in local Postgres.
- Configure Neon in Vercel and verify env vars are present.
- Run Postgres migrations against Neon.
- Deploy to Vercel.
- Send a production Clerk webhook test event.
- Confirm the user exists in Neon.

General project checks:

- `bun run lint`
- `bun run typecheck`
- `bun run test`
- `bun run build`
- `bun run db:generate`

## Non-Goals

- Building document sharing features.
- Implementing organizations or teams in Clerk.
- Implementing role-based authorization beyond route protection hooks.
- Replacing Clerk with Neon Auth.
- Supporting SQLite, libSQL, or a non-Postgres local database.
- Adding a repository abstraction before the app has enough domain logic to justify it.

## Implementation Constraints

- Use Postgres only.
- Use Docker Compose for local Postgres.
- Use `postgres` and `drizzle-orm/postgres-js` for runtime Postgres access.
- Use `@t3-oss/env-nextjs` and Zod for typed env validation.
- Generate local user ids with `crypto.randomUUID()`.
- Keep generated migration snapshots under source control.

## References

- Clerk Next.js Quickstart: https://clerk.com/docs/nextjs/getting-started/quickstart
- Clerk webhook syncing guide: https://clerk.com/docs/guides/development/webhooks/syncing
- Clerk webhook overview: https://clerk.com/docs/guides/development/webhooks/overview
- Clerk `clerkMiddleware()` reference: https://clerk.com/docs/reference/nextjs/clerk-middleware
- Neon Vercel-managed integration: https://neon.com/docs/guides/vercel-managed-integration
- Neon Vercel connection guidance: https://neon.com/docs/guides/vercel-connection-methods
- Vercel Marketplace storage docs: https://vercel.com/docs/marketplace-storage
- Drizzle database connection docs: https://orm.drizzle.team/docs/connect-overview
- Drizzle config docs: https://orm.drizzle.team/docs/drizzle-config-file
- T3 Env Next.js docs: https://env.t3.gg/docs/nextjs
- Docker Postgres image docs: https://hub.docker.com/_/postgres
- Next.js 16.2.9 Proxy documentation, version anchored to `next` in `package.json`
- Next.js 16.2.9 Route Handlers documentation, version anchored to `next` in `package.json`
- Next.js 16.2.9 Request-time APIs documentation, version anchored to `next` in `package.json`
- Next.js 16.2.9 Edge runtime documentation, version anchored to `next` in `package.json`
