import { NextRequest, NextResponse } from "next/server";

/**
 * Optimistic auth gate using only the auth-token cookie. Real authorization
 * still happens in each route via `requireAuth`/`requireAdmin` — this just
 * keeps unauthenticated users away from the dashboard shell so they don't see
 * loading flashes of pages they can't read anyway.
 *
 * Note: in Next.js 16 the `middleware.ts` convention was renamed to `proxy.ts`
 * (see node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md).
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect dashboard / panel routes — the rest is public or handled by
  // route handlers themselves.
  const isDashboard = pathname.startsWith("/panel") || pathname.startsWith("/admin");
  if (!isDashboard) return NextResponse.next();

  const token = request.cookies.get("auth-token")?.value;
  if (!token) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/panel/:path*",
    "/admin/:path*",
  ],
};
