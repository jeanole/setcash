import { handlers } from '../../../../../auth';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// In-memory rate limiter — credential login (5 attempts per 60s per IP)
// Moved from middleware.ts since matcher excludes /api/auth/* routes
// ---------------------------------------------------------------------------
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

// Periodically evict expired entries so the map doesn't grow unbounded.
// unref() so this timer never keeps the Node process alive on its own.
const loginAttemptsCleanup = setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of loginAttempts) {
    if (now > entry.resetAt) {
      loginAttempts.delete(ip);
    }
  }
}, 60_000);
loginAttemptsCleanup.unref();

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

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    '127.0.0.1'
  );
}

// ---------------------------------------------------------------------------
// Rate-limited wrapper for NextAuth credentials callback
// ---------------------------------------------------------------------------
async function handleRequest(req: NextRequest): Promise<Response> {
  const ip = getClientIp(req);

  if (!checkRateLimit(ip)) {
    return new NextResponse('Too many login attempts. Please try again later.', {
      status: 429,
      headers: { 'Retry-After': '60' },
    });
  }

  // Call NextAuth handler
  const { GET, POST } = handlers;
  const handler = req.method === 'GET' ? GET : POST;
  return handler(req);
}

export async function GET(req: NextRequest): Promise<Response> {
  return handleRequest(req);
}

export async function POST(req: NextRequest): Promise<Response> {
  return handleRequest(req);
}
