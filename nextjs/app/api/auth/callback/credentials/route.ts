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

async function getLoginEmail(req: NextRequest): Promise<string | null> {
  try {
    const form = await req.clone().formData();
    const email = form.get('email');
    return typeof email === 'string' && email ? email.trim().toLowerCase() : null;
  } catch {
    return null;
  }
}

async function handleRequest(req: NextRequest): Promise<Response> {
  if (req.method === 'POST') {
    const ipResult = await loginIpLimiter.limit(getClientIp(req));
    if (!ipResult.success) return tooManyAttempts();

    const email = await getLoginEmail(req);
    if (email) {
      const emailResult = await loginEmailLimiter.limit(email);
      if (!emailResult.success) return tooManyAttempts();
    }
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
