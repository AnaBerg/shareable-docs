import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { db } from "@/db";
import { isApiError } from "@/server/foundation/errors";
import { normalizeEmail } from "@/server/foundation/helpers/email";
import type { DocumentViewer } from "@/server/foundation/helpers/resolve-document-access";
import { findActiveUserByClerkId } from "@/server/repositories/users/find-active-user-by-clerk-id";
import { viewDocument } from "@/server/services/docs/view-document";
import { getDocumentQuerySchema } from "@/types/docs";

export default async function DocumentViewerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ version?: string }>;
}) {
  const { id } = await params;
  const { version: versionParam } = await searchParams;

  const query = getDocumentQuerySchema.safeParse({ version: versionParam });
  if (!query.success) {
    notFound();
  }

  // Security invariant: the share token must never appear in this page's URL —
  // the sandboxed iframe below can read it through document.baseURI. The proxy
  // (src/proxy.ts) strips `?t=` into this httpOnly, per-document cookie before
  // the page renders; keep the cookie name in sync with it.
  const token = (await cookies()).get(`doc_token_${id}`)?.value;

  const { document, version, latestVersion } = await viewDocumentForVisitor({
    token,
    documentId: id,
    version: query.data.version,
  });

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex shrink-0 items-baseline gap-3 border-b border-border bg-background px-4 py-2">
        <h1 className="truncate text-sm font-medium text-foreground">{document.name}</h1>
        <span className="shrink-0 text-xs text-muted-foreground">
          v{version.versionNumber}
          {version.versionNumber !== latestVersion.versionNumber &&
            ` (latest v${latestVersion.versionNumber})`}
        </span>
      </header>
      {/*
        Security invariant: the stored HTML is arbitrary and author-controlled.
        It must only ever be rendered through this sandboxed iframe, and the
        sandbox must stay exactly "allow-scripts" — adding "allow-same-origin"
        would give the document access to our origin and defeat the sandbox.
        Enforced by viewer.test.ts.
      */}
      <iframe
        srcDoc={version.html}
        sandbox="allow-scripts"
        className="w-full flex-1 border-0"
        title={document.name}
      />
    </div>
  );
}

async function resolveSessionViewer(): Promise<DocumentViewer | null> {
  const session = await auth();
  if (!session.userId) {
    return null;
  }

  const user = await findActiveUserByClerkId(db, session.userId);
  if (!user) {
    return null;
  }

  return { kind: "user", userId: user.id, email: normalizeEmail(user.primaryEmail) };
}

// The proxy stores the cookie for any /d/<id>?t=... visit without validating
// it, so a stale token (e.g. after the owner rotates the link) or a planted
// one must not shadow a session-authorized viewer: try the link token first,
// then fall back to the Clerk session before giving up with a 404.
async function viewDocumentForVisitor(input: {
  token: string | undefined;
  documentId: string;
  version: number | undefined;
}) {
  const { token, ...rest } = input;

  if (token !== undefined) {
    const byLink = await viewDocumentOrNull({ viewer: { kind: "link", token }, ...rest });
    if (byLink) {
      return byLink;
    }
  }

  const bySession = await viewDocumentOrNull({ viewer: await resolveSessionViewer(), ...rest });
  if (!bySession) {
    notFound();
  }

  return bySession;
}

async function viewDocumentOrNull(input: {
  viewer: DocumentViewer | null;
  documentId: string;
  version: number | undefined;
}) {
  try {
    return await viewDocument({ db, ...input });
  } catch (error) {
    if (isApiError(error)) {
      return null;
    }

    throw error;
  }
}
