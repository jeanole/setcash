import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { buildCsp, createNonce, NONCE_HEADER } from './lib/csp';

// ---------------------------------------------------------------------------
// NextAuth v5 Edge Middleware
// Uses the edge-compatible config (no Prisma) — only verifies JWTs.
// ---------------------------------------------------------------------------

const { auth } = NextAuth(authConfig);

// Pass the request on with a fresh CSP nonce. Next.js reads the nonce from the
// request's Content-Security-Policy header and stamps it on its own scripts;
// pages can read it via the x-nonce header.
function nextWithCsp(req: NextRequest): NextResponse {
  const nonce = createNonce();
  const csp = buildCsp(nonce, process.env.NODE_ENV === 'development');

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(NONCE_HEADER, nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export default auth(function middleware(req) {
  const { nextUrl, auth: session } = req as typeof req & {
    auth: { user?: { id: string } } | null;
  };

  const isAuthenticated = !!session?.user;

  // Allow public routes through without auth check
  const isPublicRoute =
    nextUrl.pathname === '/' ||
    nextUrl.pathname === '/login' ||
    nextUrl.pathname === '/forgot-password' ||
    nextUrl.pathname === '/reset-password' ||
    nextUrl.pathname === '/verify-email' ||
    nextUrl.pathname === '/accept-invite' ||
    nextUrl.pathname === '/api/health' ||
    nextUrl.pathname === '/api/analytics/visit' ||
    nextUrl.pathname === '/api/analytics/event' ||
    nextUrl.pathname.startsWith('/api/auth/') ||
    nextUrl.pathname.startsWith('/_next/') ||
    nextUrl.pathname === '/favicon.ico';

  if (isPublicRoute) {
    return nextWithCsp(req);
  }

  // Redirect unauthenticated users to /
  if (!isAuthenticated) {
    const loginUrl = new URL('/', nextUrl.origin);
    loginUrl.searchParams.set('callbackUrl', nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return nextWithCsp(req);
});

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - api/auth (NextAuth routes)
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public files with extensions
     * - the multipart upload endpoints (POST /api/bills, /api/bills/[id]/images,
     *   /api/bills/[id]/images/[imageId], /api/bug-reports). When middleware runs,
     *   Next.js 15 buffers at most `middlewareClientMaxBodySize` (10 MB) of the
     *   request body and hands the route a truncated stream, which breaks uploads
     *   larger than that. Raising the limit would buffer every body in memory
     *   instead, so these routes are kept out of middleware. They authenticate
     *   themselves (401 JSON) and need no CSP nonce for JSON responses.
     *   Anchored with `$` so pages such as /bills and /bills/[id] still match;
     *   `images/reorder` is a JSON endpoint and stays behind middleware.
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico|api/bills/?$|api/bills/[^/]+/images(?:/(?!reorder/?$)[^/]+)?/?$|api/bug-reports/?$|.*\\..*).*)',
  ],
};
