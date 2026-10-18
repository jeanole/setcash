import { handlers } from '../../../../../auth';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { loginEmailLimiter, loginIpLimiter } from '@/lib/ratelimit';
import { getClientIp } from '@/lib/client-ip';

// ---------------------------------------------------------------------------
// Rate-limited wrapper for NextAuth credentials callback
// (lives here because the middleware matcher excludes /api/auth/*)
//
// Two independent limits: per client IP (resolved via lib/client-ip, which
// ignores spoofable X-Forwarded-For) and per target email, so rotating IPs
// does not allow unlimited password guessing against one account.
// ---------------------------------------------------------------------------

function tooManyAttempts(): Response {
  return new NextResponse('Too many login attempts. Please try again later.', {
    status: 429,
    headers: { 'Retry-After': '60' },
  });
}

type LoginEmail =
  | { ok: true; email: string }
  | { ok: false; status: 400 | 415 };

/**
 * Extract the login email exactly the way Auth.js (@auth/core getBody) reads
 * the credentials body, so the limiter keys on the address that is actually
 * checked: content-type matched with a case-sensitive `includes`, JSON checked
 * before urlencoded, and for urlencoded bodies the LAST value of a repeated
 * key wins (FormData.get would return the first, allowing `email=x&email=victim`).
 * Any other content type is ignored by Auth.js (no credentials, no login) and
 * is rejected here instead of silently skipping the per-email limit.
 */
async function getLoginEmail(req: NextRequest): Promise<LoginEmail> {
  const contentType = req.headers.get('content-type');
  let raw: unknown;
  try {
    if (contentType?.includes('application/json')) {
      const body: unknown = await req.clone().json();
      raw = body !== null && typeof body === 'object' ? (body as Record<string, unknown>).email : undefined;
    } else if (contentType?.includes('application/x-www-form-urlencoded')) {
      const params = new URLSearchParams(await req.clone().text());
      raw = Object.fromEntries(params).email;
    } else {
      return { ok: false, status: 415 };
    }
  } catch {
    return { ok: false, status: 400 };
  }
  if (typeof raw !== 'string' || !raw.trim()) return { ok: false, status: 400 };
  return { ok: true, email: raw.trim().toLowerCase() };
}

async function handleRequest(req: NextRequest): Promise<Response> {
  if (req.method === 'POST') {
    const ipResult = await loginIpLimiter.limit(getClientIp(req));
    if (!ipResult.success) return tooManyAttempts();

    const login = await getLoginEmail(req);
    if (!login.ok) {
      return new NextResponse(
        login.status === 415 ? 'Unsupported content type' : 'Invalid login request',
        { status: login.status }
      );
    }
    const emailResult = await loginEmailLimiter.limit(login.email);
    if (!emailResult.success) return tooManyAttempts();
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
