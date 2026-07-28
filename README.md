# Shareable Docs

Publish HTML documents from an agent or the CLI, and share them with your team through a link. Documents are versioned; the viewer at `/d/<id>` renders the latest version inside a sandboxed iframe.

## Access modes

A document can be opened in three ways:

1. **Owner** — the signed-in user who created it (directly or via their API key) can always open `/d/<id>`.
2. **Shared by email** — the owner shares the document with specific emails (`POST /api/docs/share/<id>`); recipients open `/d/<id>` while signed in with a matching email.
3. **Secret link** — the owner creates an optional per-document link (`POST /api/docs/<id>/link`); anyone with `/d/<id>?t=<token>` can read the document without an account. Creating a new link rotates the token and invalidates the old one; revoking disables it.

Secret links are read-only. Unauthorized viewers get a 404, never a 403, so document existence is not leaked.

## Agent authentication

Agents authenticate with a Clerk **user-scoped** API key sent as a bearer token:

```text
Authorization: Bearer $SHAREABLE_DOCS_API_KEY
```

The key maps to a Clerk user, so documents published with it are owned by that user — ownership and email sharing behave exactly as they do for a browser session. Create the key in the Clerk dashboard (API Keys, user-scoped).

The key and the deployment URL live in the **agent's** environment (`SHAREABLE_DOCS_API_KEY`, `SHAREABLE_DOCS_URL`), not in this app's `.env`. The `publish-doc` skill in `.agents/skills/publish-doc` packages the full workflow for Claude Code and other agents.

## Publish example

Create a document from an HTML file:

```bash
jq -n --arg name "Q3 Launch Plan" --rawfile html ./plan.html \
  '{name: $name, html: $html}' \
| curl -sS --fail-with-body -X POST "$SHAREABLE_DOCS_URL/api/docs" \
    -H "Authorization: Bearer $SHAREABLE_DOCS_API_KEY" \
    -H "Content-Type: application/json" \
    --data @-
```

The `201` response includes the document `id`. Share it with teammates at `$SHAREABLE_DOCS_URL/d/<id>`, or create a secret link:

```bash
curl -sS --fail-with-body -X POST "$SHAREABLE_DOCS_URL/api/docs/$DOC_ID/link" \
  -H "Authorization: Bearer $SHAREABLE_DOCS_API_KEY"
```

Publish a new version later with `PUT /api/docs/$DOC_ID` and `{"html": "..."}` — existing links keep pointing at the latest version.

## Local development

```bash
bun install
cp .env.example .env   # fill in the Clerk keys
bun run db:local:up    # start Postgres via Docker
bun run db:migrate
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Tests

Run the test suite with:

```bash
bun run test
```

Vitest runs in `test` mode and loads `.env.test` when present. The current unit tests do not connect to Postgres, but T3 Env still validates that `DATABASE_URL` is set. When `.env.test` does not provide one, the Vitest config supplies a local Postgres URL only as a valid placeholder for that env validation.

For tests that connect to Postgres, create `.env.test` with a real `DATABASE_URL` for the test database.

Also available: `bun run typecheck` and `bun run lint`.

## Database

- `bun run db:local:up` / `db:local:down` / `db:local:logs` — local Postgres via Docker Compose
- `bun run db:generate` — generate a Drizzle migration from `src/db/schema.ts`
- `bun run db:migrate` — apply migrations
- `bun run db:studio` — browse the database with Drizzle Studio
