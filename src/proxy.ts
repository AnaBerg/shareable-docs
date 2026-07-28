import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

const isProtectedRoute = createRouteMatcher(["/app(.*)", "/dashboard(.*)"]);
const isApiRoute = createRouteMatcher(["/api(.*)"]);
const isClerkWebhookRoute = createRouteMatcher(["/api/webhooks/clerk"]);
const mutatingMethods = new Set(["DELETE", "PATCH", "POST", "PUT"]);
const documentViewerPath = /^\/d\/([^/]+)$/;

export default clerkMiddleware(async (auth, req) => {
  const tokenRedirect = redirectDocumentLinkToken(req);
  if (tokenRedirect) {
    return tokenRedirect;
  }

  if (isProtectedRoute(req) || isProtectedApiRoute(req)) {
    await auth.protect({ token: ["session_token", "api_key"] });
  }
});

// Security invariant: the /d/<id> viewer renders author-controlled HTML in a
// sandboxed iframe, and a srcdoc iframe inherits the embedding page's full URL
// (query string included) as document.baseURI — readable even in the sandbox.
// A share token in `?t=` would therefore leak to the document's own scripts.
// So before the page ever renders, move the token out of the URL into an
// httpOnly cookie scoped to this one document and redirect to the clean URL.
function redirectDocumentLinkToken(req: NextRequest): NextResponse | undefined {
  const match = documentViewerPath.exec(req.nextUrl.pathname);
  const token = req.nextUrl.searchParams.get("t");
  if (!match || !token) {
    return undefined;
  }

  const documentId = match[1];
  const cleanUrl = req.nextUrl.clone();
  cleanUrl.searchParams.delete("t");

  const response = NextResponse.redirect(cleanUrl);
  // Cookie name and path are per document so links to different documents
  // don't clobber each other and the token is never sent to other routes.
  // Keep the name in sync with src/app/d/[id]/page.tsx.
  response.cookies.set({
    name: `doc_token_${documentId}`,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: `/d/${documentId}`,
  });

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:css|js|png|jpg|jpeg|gif|webp|svg|ico)$).*)",
  ],
};

function isProtectedApiRoute(req: Parameters<typeof isApiRoute>[0]): boolean {
  if (!isApiRoute(req) || isClerkWebhookRoute(req)) {
    return false;
  }

  return req.nextUrl.pathname.startsWith("/api/internal") || mutatingMethods.has(req.method);
}
