# Docs API Versioning Design

## Context

This project is a Next.js 16.2.9 App Router application under `src/app`. API endpoints should be implemented as Route Handlers in `src/app/api/**/route.ts`, using the Web `Request` and `Response` APIs and following the local Next.js 16 documentation in `node_modules/next/dist/docs/`.

The existing backend foundation is Clerk authentication, a synchronized local `users` table, Drizzle ORM, and Postgres. Clerk remains the source of truth for identity, while application authorization should use the local `users.id` row associated with the current Clerk user.

The new documents API must store HTML documents, support multiple immutable versions per document, and allow document access through ownership or email-based sharing.

## Goals

- Add REST API endpoints for creating, reading, updating, listing, and sharing HTML documents.
- Store document metadata separately from versioned HTML content.
- Preserve every document version instead of overwriting HTML.
- Authorize reads for owners and users whose primary email was shared.
- Authorize updates only for owners.
- Authorize sharing for any user who currently has access to the document.
- Validate API request contracts and database write contracts with Zod.
- Centralize request user resolution in a reusable API context helper.
- Create a reusable endpoint foundation for error handling, request parsing, database access, structured logs, and business-logic dispatch.

## Non-Goals

- No UI changes are included in this spec.
- No rich text sanitization or HTML rewriting is included. The API stores the submitted HTML as-is.
- No per-version sharing rules. If a user has access to a document, they have access to every version.
- No public link sharing.
- No document deletion endpoint.
- No metadata-only update endpoint for `name` or `description`.

## API Context

Create a shared server helper for API Route Handlers in `src/server/foundation/context.ts`.

The helper should build an `ApiContext` for every protected API request. It should:

- Read the current Clerk auth state.
- Require an authenticated Clerk user.
- Load the active local `users` row by `clerkUserId`.
- Normalize and expose the local user's primary email when present.
- Return a clear `401` response when no Clerk session exists.
- Return a clear `403` response when a Clerk session exists but the local user row has not been synchronized yet.
- Expose the local user as `ctx.user`.
- Expose the local user's normalized primary email as `ctx.userEmail`.
- Expose the Drizzle database handle as `ctx.db`.

The context helper should avoid database work in `src/proxy.ts`. Proxy remains responsible only for coarse route protection.

Suggested shape:

```ts
type ApiContext = {
  db: typeof db;
  user: User;
  userEmail: string | null;
};

type ApiContextResult =
  | { ok: true; ctx: ApiContext }
  | { ok: false; response: Response };
```

HTTP handlers should call this helper at the start of each endpoint and return `result.response` when `ok` is false. This keeps `src/app/api/**/route.ts` files as thin Next.js adapters and keeps request parsing, authorization, and document behavior in server modules.

## API Endpoint Foundation

Create a small server-side API foundation before implementing the document endpoints. The foundation should make Route Handlers consistent and keep framework code separate from business logic.

Suggested files:

```txt
src/server/handlers/api.ts
src/server/handlers/docs.ts
src/server/handlers/docs/*.ts
src/server/foundation/context.ts
src/server/foundation/errors.ts
src/server/foundation/logs.ts
```

### Handler wrapper

`src/server/handlers/api.ts` should expose a wrapper such as `withApiHandler`. It should:

- Build `ApiContext` once per request.
- Catch expected application errors and convert them to JSON responses.
- Catch unexpected errors, log them, and return a generic `500` response.
- Add a request id to every request if none is provided by upstream headers.
- Log request completion with method, pathname, status, duration, request id, and user id when available.
- Avoid logging submitted HTML or full request bodies.

Suggested shape:

```ts
type ApiHandler<TParams = unknown> = (input: {
  request: Request;
  ctx: ApiContext;
  params: TParams;
}) => Promise<Response>;

function withApiHandler<TParams>(
  handler: ApiHandler<TParams>,
): (request: Request, routeContext?: unknown) => Promise<Response>;
```

Dynamic route params should still be awaited and validated by the endpoint or request helper, because Next.js 16 exposes route `params` as a promise.

### Errors and responses

`src/server/foundation/errors.ts` should define typed application errors, for example `ApiError`, with a status code, stable error code, safe message, and optional validation details. Business logic should throw these typed errors for expected failures such as forbidden access, missing documents, validation failures, and local user sync conflicts.

The handler layer should provide JSON helpers for success and error responses, either in `src/server/handlers/api.ts` or a sibling file under `src/server/handlers`. Response helpers should produce one consistent envelope for errors and should avoid leaking stack traces, SQL details, Clerk secrets, or submitted HTML.

### Request parsing

`src/server/handlers/api.ts`, or a sibling file under `src/server/handlers`, should contain reusable helpers for:

- Reading JSON request bodies safely.
- Returning `400` for malformed JSON.
- Validating bodies, query strings, and route params with Zod.
- Converting `URLSearchParams` to plain objects before validation.

Endpoint files should not duplicate try/catch blocks for JSON parsing or Zod formatting.

### Database access

Next.js route files and HTTP handlers should not import the global database directly. They should receive `ctx.db` from `ApiContext` and pass it into repositories or services. This makes tests easier and keeps database access consistent.

Repository modules under `src/server/repositories/docs` should own Drizzle queries. Service modules under `src/server/services/docs` should own business rules and transaction orchestration. Handler files under `src/server/handlers` should only compose the API foundation, request contracts, and service calls. Next route files under `src/app/api` should only export the corresponding handler functions required by Next.js.

### Logging

`src/server/foundation/logs.ts` should expose a minimal structured logger wrapper around `console`. Logs should include:

- `requestId`.
- HTTP method and pathname.
- Response status.
- Duration in milliseconds.
- `userId` when a local user was resolved.
- Stable error code for expected failures.

Logs should not include raw HTML, complete request bodies, secret values, database URLs, or full email lists unless explicitly safe and necessary. For share operations, logging counts is safer than logging every email.

## Database Design

Add three Postgres tables to `src/db/schema.ts`.

### `documents`

Stores stable document metadata and ownership.

- `id`: text primary key, generated by the application with `crypto.randomUUID()`.
- `ownerUserId`: text, required, references `users.id`.
- `name`: text, required.
- `description`: text, nullable.
- `createdAt`: timestamptz, required.
- `updatedAt`: timestamptz, required.
- `deletedAt`: timestamptz, nullable.

Indexes:

- `documents_owner_user_id_idx` on `ownerUserId`.

### `document_versions`

Stores immutable HTML snapshots.

- `id`: text primary key, generated by the application with `crypto.randomUUID()`.
- `documentId`: text, required, references `documents.id`.
- `versionNumber`: integer, required, starts at `1`.
- `html`: text, required.
- `createdByUserId`: text, required, references `users.id`.
- `createdAt`: timestamptz, required.

Indexes:

- Unique index `document_versions_document_id_version_unique` on `(documentId, versionNumber)`.
- Index `document_versions_document_id_created_at_idx` on `(documentId, createdAt)`.

### `document_shares`

Stores email-based access grants. The share target does not need to exist in `users` yet.

- `id`: text primary key, generated by the application with `crypto.randomUUID()`.
- `documentId`: text, required, references `documents.id`.
- `sharedWithEmail`: text, required, stored lowercased and trimmed.
- `sharedByUserId`: text, required, references `users.id`.
- `createdAt`: timestamptz, required.

Indexes:

- Unique index `document_shares_document_id_email_unique` on `(documentId, sharedWithEmail)`.
- Index `document_shares_shared_with_email_idx` on `sharedWithEmail`.

## Zod Contracts

Create shared schemas for endpoint inputs, database inserts, and document-facing TypeScript types in `src/types/docs.ts`.

API schemas:

- `createDocumentRequestSchema`
  - `name`: non-empty string.
  - `description`: optional string; blank strings may be normalized to `null`.
  - `html`: non-empty string.
- `updateDocumentRequestSchema`
  - `html`: non-empty string.
- `getDocumentQuerySchema`
  - `version`: optional positive integer parsed from the query string.
- `listDocumentsQuerySchema`
  - `access`: optional enum `"all" | "owned" | "shared"`, default `"all"`.
- `shareDocumentRequestSchema`
  - `emails`: non-empty array of valid email strings.

Database write schemas:

- `newDocumentSchema`.
- `newDocumentVersionSchema`.
- `newDocumentShareSchema`.

Database schemas should validate the full object immediately before insertion. Email fields should be normalized before DB validation.

## Endpoint Contracts

All document endpoints use `runtime = "nodejs"` because they access Postgres through the server database driver.

Dynamic Route Handlers should follow the Next.js 16 route context shape where `params` is a promise. For example, `GET /api/docs/{id}` should await `ctx.params` before validating `id`.

### `POST /api/docs`

Creates a document and its initial version.

Request body:

```json
{
  "name": "Quarterly report",
  "description": "Optional description",
  "html": "<h1>Report</h1>"
}
```

Behavior:

1. Build `ApiContext`.
2. Validate request body with Zod.
3. Insert `documents` with the current local user as owner.
4. Insert `document_versions` with `versionNumber = 1`.
5. Return `201`.

Response body:

```json
{
  "id": "doc_id",
  "name": "Quarterly report",
  "description": "Optional description",
  "latestVersion": 1,
  "ownerUserId": "user_id",
  "createdAt": "2026-06-12T00:00:00.000Z",
  "updatedAt": "2026-06-12T00:00:00.000Z"
}
```

### `GET /api/docs/{id}`

Returns a document HTML version.

Query string:

- `version`: optional positive integer. Defaults to the latest version.

Behavior:

1. Build `ApiContext`.
2. Validate route params and query string with Zod.
3. Verify the current user can access the document.
4. Load the requested version or latest version.
5. Return `404` if the document or requested version does not exist.
6. Return `403` if the document exists but the current user cannot access it.

Response body:

```json
{
  "id": "doc_id",
  "name": "Quarterly report",
  "description": "Optional description",
  "version": 2,
  "latestVersion": 3,
  "html": "<h1>Report v2</h1>",
  "ownerUserId": "user_id",
  "createdAt": "2026-06-12T00:00:00.000Z",
  "updatedAt": "2026-06-12T00:00:00.000Z",
  "versionCreatedAt": "2026-06-12T00:00:00.000Z"
}
```

### `PUT /api/docs/{id}`

Creates a new immutable version for an existing document.

Request body:

```json
{
  "html": "<h1>Updated report</h1>"
}
```

Behavior:

1. Build `ApiContext`.
2. Validate route params and body with Zod.
3. Load the document.
4. Return `404` if the document does not exist.
5. Return `403` if the current user is not the owner.
6. Compute the next version number as `latestVersion + 1`.
7. Insert a new `document_versions` row.
8. Update `documents.updatedAt`.
9. Return `200`.

Response body:

```json
{
  "id": "doc_id",
  "version": 4,
  "latestVersion": 4,
  "updatedAt": "2026-06-12T00:00:00.000Z"
}
```

The implementation should use a transaction for the latest-version lookup and insert. The unique `(documentId, versionNumber)` index protects against duplicate version numbers if concurrent updates race.

### `GET /api/docs`

Lists documents the current user can access.

Query string:

- `access`: optional `"all" | "owned" | "shared"`, default `"all"`.

Behavior:

1. Build `ApiContext`.
2. Validate query string with Zod.
3. List documents where the current user is the owner and/or where `ctx.userEmail` matches `document_shares.sharedWithEmail`.
4. Exclude soft-deleted documents.
5. Include the latest version number for each document.
6. Sort by `documents.updatedAt` descending.

Response body:

```json
{
  "documents": [
    {
      "id": "doc_id",
      "name": "Quarterly report",
      "description": "Optional description",
      "access": "owned",
      "latestVersion": 3,
      "ownerUserId": "user_id",
      "createdAt": "2026-06-12T00:00:00.000Z",
      "updatedAt": "2026-06-12T00:00:00.000Z"
    }
  ]
}
```

If a user has no primary email, `access=shared` should return an empty list because there is no email to match.

### `POST /api/docs/share/{id}`

Shares a document with one or more email addresses.

Request body:

```json
{
  "emails": ["reader@example.com", "Reviewer@Example.com"]
}
```

Behavior:

1. Build `ApiContext`.
2. Validate route params and body with Zod.
3. Normalize emails by trimming and lowercasing.
4. Remove duplicate emails from the request.
5. Verify the current user can access the document.
6. Return `404` if the document does not exist.
7. Return `403` if the document exists but the current user cannot access it.
8. Insert access grants idempotently.
9. Return `200`.

Response body:

```json
{
  "id": "doc_id",
  "sharedWith": ["reader@example.com", "reviewer@example.com"]
}
```

Sharing is document-level. A shared email can read every existing and future version of that document.

## Authorization Rules

- Unauthenticated requests return `401`.
- Authenticated requests without a local `users` row return `403`.
- Owners can read, update, list, and share their documents.
- Shared users can read, list, and share documents shared with their primary email.
- Shared users cannot update documents.
- A user with no primary email can still own documents but cannot receive email-based shares until their local `primaryEmail` is present.
- Soft-deleted users should not be loaded by `ApiContext`.
- Soft-deleted documents should be excluded from all endpoints.

## Error Responses

Use JSON error bodies consistently:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Invalid request body"
  }
}
```

Recommended status codes:

- `400`: malformed JSON, invalid route param, invalid query string, invalid body.
- `401`: missing Clerk session.
- `403`: authenticated user lacks access.
- `404`: document or version not found.
- `409`: a concurrent version insert conflicts after retry handling.
- `500`: unexpected server/database error.

Validation errors should not echo submitted HTML.

## File Layout

Expected implementation files:

```txt
src/app/api/docs/route.ts
src/app/api/docs/[id]/route.ts
src/app/api/docs/share/[id]/route.ts
src/server/handlers/api.ts
src/server/handlers/docs.ts
src/server/foundation/context.ts
src/server/foundation/errors.ts
src/server/foundation/logs.ts
src/server/services/docs/create-document.ts
src/server/services/docs/get-document.ts
src/server/services/docs/list-documents.ts
src/server/services/docs/share-document.ts
src/server/services/docs/update-document.ts
src/server/repositories/docs/*.ts
src/types/docs.ts
```

Files under `src/server/repositories/docs` should contain focused database queries. Files under `src/server/services/docs` should contain authorization and document workflows that are easier to test without Route Handler boilerplate. Files under `src/server/handlers/docs` should parse HTTP inputs and call the document services. The `src/app/api/docs/**/route.ts` files should stay thin and export the matching Next.js Route Handler methods.

## Testing

Use Vitest and follow the existing unit-test style.

Test the contract layer:

- Create request accepts valid input.
- Create request rejects missing name and empty HTML.
- Query schema parses positive integer versions.
- Share schema normalizes and deduplicates emails.
- DB insert schemas reject invalid persisted shapes.

Test the API context helper:

- Returns `401` when Clerk has no authenticated user.
- Returns `403` when a Clerk user exists but no active local user row exists.
- Returns `ApiContext` with local user and normalized email when present.

Test the API foundation:

- Handler wrapper catches typed `ApiError` instances and returns the expected status and JSON error envelope.
- Handler wrapper catches unexpected errors, logs them through `src/server/foundation/logs.ts`, and returns a generic `500`.
- Request parser in the handler layer returns `400` for malformed JSON.
- Zod request helpers in the handler layer format validation failures without echoing submitted HTML.
- Completion logs include request id, method, pathname, status, duration, and user id when available.

Test the document service:

- Create inserts metadata and initial version.
- Get latest version defaults correctly.
- Get specific version returns requested HTML.
- Owner can read and update.
- Shared email can read.
- Shared email cannot update.
- Owner and shared user can share.
- List returns owned, shared, or all based on the filter.
- User without primary email gets no shared documents.

Test HTTP handlers with mocked service/context dependencies where useful:

- `POST /api/docs` returns `201`.
- `GET /api/docs/{id}` returns latest by default.
- `PUT /api/docs/{id}` returns `403` for non-owner.
- `GET /api/docs?access=shared` validates the filter.
- `POST /api/docs/share/{id}` validates emails.

## Migration Plan

1. Add Drizzle schema definitions for `documents`, `document_versions`, and `document_shares`.
2. Generate a Postgres migration with `bun run db:generate`.
3. Add the shared API foundation: errors, logging, and API context under `src/server/foundation`.
4. Add foundation tests before implementation.
5. Add the shared handler wrapper, response helpers, and request parsing under `src/server/handlers`.
6. Add Zod contracts and document types in `src/types/docs.ts`.
7. Add repository and service tests before implementation.
8. Add repository and service implementation under `src/server/repositories/docs` and `src/server/services/docs`.
9. Add handler tests before each handler implementation.
10. Add thin Next.js Route Handlers in `src/app/api/docs/**/route.ts` that delegate to `src/server/handlers/docs.ts`.
11. Run `bun run test`, `bun run typecheck`, and `bun run lint`.

## Open Decisions Resolved

- Sharing is stored by normalized email, not by `userId`, so recipients do not need accounts before access is granted.
- Any user with document access can share the document onward.
- Updating a document creates a new version and does not mutate existing version rows.
- Reading without `version` returns the latest version.
- Listing defaults to all accessible documents.
