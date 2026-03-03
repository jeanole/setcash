import { auth } from './auth';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// NextAuth v5 Edge Middleware
// Protects all routes under /(protected)/
// ---------------------------------------------------------------------------

export default auth(function middleware(req) {
  const { nextUrl, auth: session } = req as typeof req & {
    auth: { user?: { id: string } } | null;
  };

  const isAuthenticated = !!session?.user;
  const isProtected = nextUrl.pathname.startsWith('/dashboard') ||
    nextUrl.pathname.match(/^\/(protected)\//);

  // Allow public routes through without auth check
  const isPublicRoute =
    nextUrl.pathname === '/login' ||
    nextUrl.pathname.startsWith('/api/auth/') ||
    nextUrl.pathname.startsWith('/_next/') ||
    nextUrl.pathname === '/favicon.ico';

  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Redirect unauthenticated users to /login
  if (!isAuthenticated) {
    const loginUrl = new URL('/login', nextUrl.origin);
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
