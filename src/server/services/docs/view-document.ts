import { findDocumentById } from "@/server/repositories/docs/find-document-by-id";
import { findLatestVersion } from "@/server/repositories/docs/find-latest-version";
import { findVersion } from "@/server/repositories/docs/find-version";
import { notFoundError } from "@/server/foundation/errors";
import {
  resolveDocumentAccess,
  type DocumentViewer,
} from "@/server/foundation/helpers/resolve-document-access";
import type { DocumentsDatabase } from "@/types/docs-repository";

export type ViewDocumentInput = {
  db: DocumentsDatabase;
  viewer: DocumentViewer | null;
  documentId: string;
  version?: number;
};

// Deliberately separate from getDocument: a link visitor has no ApiContext.
// Every failure is a 404 — on a publicly reachable page, a 403 would confirm
// that the document exists.
export async function viewDocument({ db, viewer, documentId, version }: ViewDocumentInput) {
  const document = await findDocumentById(db, documentId);
  if (!document) {
    throw notFoundError("Document not found");
  }

  const access = viewer === null ? null : await resolveDocumentAccess({ db, viewer }, document);
  if (!access) {
    throw notFoundError("Document not found");
  }

  const latestVersion = await findLatestVersion(db, document.id);
  const resolvedVersion =
    version === undefined ? latestVersion : await findVersion(db, document.id, version);

  if (!resolvedVersion || !latestVersion) {
    throw notFoundError("Document version not found");
  }

  return { document, version: resolvedVersion, latestVersion, access };
}
