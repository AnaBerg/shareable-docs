import type {
  Document,
  DocumentShare,
  DocumentVersion,
  NewDocument,
  NewDocumentVersion,
} from "@/db";
import type { ApiContext } from "@/server/foundation/context";

export type DocumentsDatabase = ApiContext["db"];

export type DocumentAccess = "owned" | "shared" | "link";

export type DocumentListItem = Document & {
  access: DocumentAccess;
  latestVersion: DocumentVersion;
};

export type CreateDocumentInput = {
  document: Omit<NewDocument, "id" | "createdAt" | "updatedAt" | "deletedAt">;
  version: Pick<NewDocumentVersion, "html" | "createdByUserId">;
};

export type AddVersionInput = {
  documentId: string;
  html: string;
  createdByUserId: string;
};

export type ShareDocumentInput = {
  documentId: string;
  emails: string[];
  sharedByUserId: string;
};

export type ListDocumentsInput = {
  ownerUserId: string;
  sharedWithEmail: string | null;
  access: "all" | "owned" | "shared";
};

export type ShareDocumentResult = DocumentShare[];

export type UpsertShareLinkInput = {
  documentId: string;
  tokenHash: string;
  createdByUserId: string;
};
