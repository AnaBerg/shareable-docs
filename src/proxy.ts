import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher(["/app(.*)", "/dashboard(.*)"]);
const isApiRoute = createRouteMatcher(["/api(.*)"]);
const isClerkWebhookRoute = createRouteMatcher(["/api/webhooks/clerk"]);
const mutatingMethods = new Set(["DELETE", "PATCH", "POST", "PUT"]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req) || isProtectedApiRoute(req)) {
    await auth.protect();
  }
});

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
