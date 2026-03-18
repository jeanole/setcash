import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// NextAuth v5 Edge Middleware
// Uses the edge-compatible config (no Prisma) — only verifies JWTs.
// ---------------------------------------------------------------------------

const { auth } = NextAuth(authConfig);

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
    return NextResponse.next();
  }

  // Redirect unauthenticated users to /
  if (!isAuthenticated) {
    const loginUrl = new URL('/', nextUrl.origin);
    loginUrl.searchParams.set('callbackUrl', nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
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
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
};
