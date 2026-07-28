---
name: publish-doc
description: Publishes an HTML document to Shareable Docs and returns a viewer link. Use when the user asks to publish a doc, share a plan or report with the team, upload HTML, push a new version of a published document, or get a shareable link for one.
---

# Publish a document to Shareable Docs

Uploads an HTML document to the Shareable Docs API and returns the `/d/<id>` viewer URL. Optionally creates a secret link so people without an account can open it.

## Configuration

Read both values from the environment. Never hardcode them and never print the key.

- `SHAREABLE_DOCS_URL` — base URL of the deployment, no trailing slash (e.g. `https://docs.example.com`).
- `SHAREABLE_DOCS_API_KEY` — a Clerk **user-scoped** API key. Documents are owned by the user the key belongs to.

If either is missing, stop and ask the user to set it. Do not guess a URL.

```bash
: "${SHAREABLE_DOCS_URL:?Set SHAREABLE_DOCS_URL in the environment}"
: "${SHAREABLE_DOCS_API_KEY:?Set SHAREABLE_DOCS_API_KEY in the environment}"
```

Always use `curl --fail-with-body` so a non-2xx response surfaces the API's error payload instead of failing silently. Errors come back as `{"error":{"code":"...","message":"..."}}`.

## Create a document

`POST /api/docs` with `name` (required, max 200 chars), `html` (required, max 1 MB), and optional `description` (max 2000 chars). Use `--data @file` or a `jq`-built payload — do not inline large HTML into a shell string.

```bash
jq -n --arg name "Q3 Launch Plan" --rawfile html ./plan.html \
  '{name: $name, html: $html}' \
| curl -sS --fail-with-body -X POST "$SHAREABLE_DOCS_URL/api/docs" \
    -H "Authorization: Bearer $SHAREABLE_DOCS_API_KEY" \
    -H "Content-Type: application/json" \
    --data @-
```

Response (`201`):

```json
{
  "id": "01JG3AZX5T4V8Q9RB2C6DEF7GH",
  "name": "Q3 Launch Plan",
  "description": null,
  "latestVersion": 1,
  "ownerUserId": "...",
  "createdAt": "2026-07-27T12:00:00.000Z",
  "updatedAt": "2026-07-27T12:00:00.000Z"
}
```

Keep the `id` (a 26-char ULID) — it identifies the document for updates and links.

## Publish a new version

`PUT /api/docs/<id>` with `{html}` appends a new version to an existing document. The viewer always shows the latest version, so existing links keep working.

```bash
jq -n --rawfile html ./plan.html '{html: $html}' \
| curl -sS --fail-with-body -X PUT "$SHAREABLE_DOCS_URL/api/docs/$DOC_ID" \
    -H "Authorization: Bearer $SHAREABLE_DOCS_API_KEY" \
    -H "Content-Type: application/json" \
    --data @-
```

Response (`200`): `{"id": "...", "version": 2, "latestVersion": 2, "updatedAt": "..."}`.

## Get a shareable secret link (optional)

`POST /api/docs/<id>/link` creates a secret link anyone can open without signing in. Owner-only. Calling it again **rotates** the token and invalidates the previous link — warn the user before rotating an existing link.

```bash
curl -sS --fail-with-body -X POST "$SHAREABLE_DOCS_URL/api/docs/$DOC_ID/link" \
  -H "Authorization: Bearer $SHAREABLE_DOCS_API_KEY"
```

Response contains the full shareable `url` (shaped like `$SHAREABLE_DOCS_URL/d/<id>?t=<token>`) and the plaintext `token`. The token is shown **only once** and never stored — if it is lost, rotate to get a new one.

## Report back to the user

Always end by giving the user the viewer URL:

- Signed-in access (owner, or emails shared via `POST /api/docs/<id>/share`): `$SHAREABLE_DOCS_URL/d/<id>`
- Secret link (no sign-in needed): the `url` returned by the `/link` call

Only create a secret link when the user asked for one; otherwise the plain `/d/<id>` URL is the answer.
