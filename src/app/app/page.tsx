import { auth } from "@clerk/nextjs/server";

import { db } from "@/db";
import { normalizeEmail } from "@/server/foundation/helpers/email";
import { listAccessibleDocuments } from "@/server/repositories/docs/list-documents";
import { findActiveUserByClerkId } from "@/server/repositories/users/find-active-user-by-clerk-id";

import { DocumentsList, type DocumentListEntry } from "./documents-list";

// /app matches isProtectedRoute in src/proxy.ts, so a signed-out visitor is
// redirected to sign-in before this component ever renders.
export default async function DocumentsPage() {
  const session = await auth();
  const user = session.userId
    ? await findActiveUserByClerkId(db, session.userId)
    : null;

  if (!user) {
    return (
      <PageShell>
        <p className="text-sm text-muted-foreground">
          Your account is still being set up. Refresh this page in a moment.
        </p>
      </PageShell>
    );
  }

  const documents = await listAccessibleDocuments(db, {
    ownerUserId: user.id,
    sharedWithEmail: normalizeEmail(user.primaryEmail),
    access: "owned",
  });

  const entries: DocumentListEntry[] = documents.map((document) => ({
    id: document.id,
    name: document.name,
    description: document.description,
    latestVersionNumber: document.latestVersion.versionNumber,
    updatedAt: document.updatedAt.toISOString(),
  }));

  return (
    <PageShell>
      <DocumentsList documents={entries} />
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-foreground">Your documents</h1>
        <p className="text-sm text-muted-foreground">
          Open a document or create a secret link to share it outside the team.
        </p>
      </header>
      {children}
    </main>
  );
}
