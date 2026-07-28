import { findDocumentByShareToken } from "@/server/repositories/docs/find-document-by-share-token";
import { isSharedWithEmail } from "@/server/repositories/docs/is-shared-with-email";
import { hashShareToken } from "@/server/foundation/helpers/share-token";
import type { DocumentAccess, DocumentsDatabase } from "@/types/docs-repository";

export type DocumentViewer =
  | { kind: "user"; userId: string; email: string | null }
  | { kind: "link"; token: string };

export async function resolveDocumentAccess(
  input: { db: DocumentsDatabase; viewer: DocumentViewer },
  document: { id: string; ownerUserId: string },
): Promise<DocumentAccess | null> {
  const { db, viewer } = input;

  if (viewer.kind === "link") {
    const linkedDocument = await findDocumentByShareToken(db, hashShareToken(viewer.token));
    return linkedDocument?.id === document.id ? "link" : null;
  }

  if (document.ownerUserId === viewer.userId) {
    return "owned";
  }

  if (viewer.email === null) {
    return null;
  }

  const hasSharedAccess = await isSharedWithEmail(db, document.id, viewer.email);

  if (hasSharedAccess) {
    return "shared";
  }

  return null;
}
