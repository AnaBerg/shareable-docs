export const runtime = "nodejs";

export {
  createDocumentHandler as POST,
  listDocumentsHandler as GET,
} from "@/server/handlers/docs";
