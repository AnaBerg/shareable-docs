import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

// Exactly "/" — the document list lives at the root, but the matcher must not
// widen to "/(.*)" or it would swallow the public /d/<id> viewer along with it.
const isProtectedRoute = createRouteMatcher(["/", "/dashboard(.*)"]);
const isApiRoute = createRouteMatcher(["/api(.*)"]);
const isClerkWebhookRoute = createRouteMatcher(["/api/webhooks/clerk"]);
const mutatingMethods = new Set(["DELETE", "PATCH", "POST", "PUT"]);
// The captured id becomes a cookie name and path below, so it is constrained to
// the ULID shape used everywhere else rather than "anything but a slash": an
// arbitrary string would reach Set-Cookie unvalidated, and cookies.set rejects
// invalid values, turning a crafted /d/<bad>?t=... into a 500 before auth runs.
const documentViewerPath = /^\/d\/([0-9A-HJKMNP-TV-Z]{26})$/;

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
