export const runtime = "nodejs";

export {
  createShareLinkHandler as POST,
  revokeShareLinkHandler as DELETE,
} from "@/server/handlers/docs";
