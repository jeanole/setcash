import { auth } from './auth';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// NextAuth v5 Edge Middleware
// Protects all routes under /(protected)/
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// In-memory rate limiter — credential login (5 attempts per 60s per IP)
// ---------------------------------------------------------------------------
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60_000; // 60 seconds
  const maxAttempts = 5;

  const entry = loginAttempts.get(ip);

  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + windowMs });
    return true; // allowed
  }

  if (entry.count >= maxAttempts) {
    return false; // blocked
  }

  entry.count++;
  return true; // allowed
}

export default auth(function middleware(req) {
  const { nextUrl, auth: session } = req as typeof req & {
    auth: { user?: { id: string } } | null;
  };

  // Rate limit: credential login attempts
  if (
    req.method === 'POST' &&
    nextUrl.pathname === '/api/auth/callback/credentials'
  ) {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
      req.headers.get('x-real-ip') ??
      '127.0.0.1';

    if (!checkRateLimit(ip)) {
      return new NextResponse('Too many login attempts. Please try again later.', {
        status: 429,
        headers: { 'Retry-After': '60' },
      });
    }
  }

  const isAuthenticated = !!session?.user;

  // Allow public routes through without auth check
  const isPublicRoute =
    nextUrl.pathname === '/login' ||
    nextUrl.pathname === '/api/health' ||
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
