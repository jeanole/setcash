// ============================================================================
// Demo-Login security model (token-based, no password exposed to client)
// ============================================================================
// POST /api/auth/demo-login
//   - Verifies Turnstile, issues a short-lived (60s) single-use exchange token
//     stored as a SHA-256 hash in PasswordResetToken (reuses existing table).
//   - Returns ONLY { token } — the demo password NEVER leaves the server.
//
// GET /api/auth/demo-login?token=XXX
//   - Validates and consumes the exchange token (deletes it immediately).
//   - Calls NextAuth signIn('credentials', ...) server-side, which sets the
//     session cookie and redirects to /dashboard.
//   - The client navigates to this URL instead of calling signIn() with a password.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { db as prisma } from '@/lib/db';
import { getCountryCode } from '@/lib/analytics';
import { signIn } from '@/auth';

const schema = z.object({
  turnstileToken: z.string().min(1, 'Missing verification token.'),
});

// ---------------------------------------------------------------------------
// POST — Turnstile verification → short-lived exchange token
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Please complete the verification.' }, { status: 400 });
  }

  const { turnstileToken } = parsed.data;

  // Verify Turnstile token with Cloudflare
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error('[DemoLogin] TURNSTILE_SECRET_KEY not configured');
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
  }

  const countryCode = getCountryCode(req);

  const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      secret,
      response: turnstileToken,
    }),
  });

  const verifyData = await verifyRes.json();

  if (!verifyData.success) {
    // Log failed Turnstile attempt (fire-and-forget — do not block response)
    prisma.demoLoginAttempt
      .create({
        data: { countryCode, turnstileSuccess: false, loginSuccess: false },
      })
      .catch((err) => console.error('[DemoLogin] Failed to log attempt:', err));

    return NextResponse.json({ error: 'Verification failed. Please try again.' }, { status: 403 });
  }

  // Log successful attempt (Turnstile passed → login credentials always work)
  prisma.demoLoginAttempt
    .create({
      data: { countryCode, turnstileSuccess: true, loginSuccess: true },
    })
    .catch((err) => console.error('[DemoLogin] Failed to log attempt:', err));

  const email = process.env.DEMO_USER_EMAIL;
  const password = process.env.DEMO_USER_PASSWORD;
  if (!email || !password) {
    return NextResponse.json({ error: 'Demo login not configured' }, { status: 503 });
  }

  // Generate a single-use exchange token (60 s TTL).
  // Store only the SHA-256 hash — the raw token is returned to the client and
  // immediately discarded server-side; the demo password is never sent over the wire.
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 60 * 1000);

  await prisma.passwordResetToken.create({
    data: { email, tokenHash, expiresAt },
  });

  // Return only the opaque exchange token — no email, no password.
  return NextResponse.json({ token: rawToken });
}

// ---------------------------------------------------------------------------
// GET — Exchange token → NextAuth session (server-side sign-in + redirect)
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawToken = searchParams.get('token');

  if (!rawToken) {
    return NextResponse.redirect(new URL('/login?error=demo', req.url));
  }

  const email = process.env.DEMO_USER_EMAIL;
  const password = process.env.DEMO_USER_PASSWORD;
  if (!email || !password) {
    return NextResponse.redirect(new URL('/login?error=demo', req.url));
  }

  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  // Find and immediately consume the token (single-use)
  const storedToken = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!storedToken || storedToken.expiresAt < new Date() || storedToken.email !== email) {
    // Clean up expired/invalid token if present
    if (storedToken) {
      await prisma.passwordResetToken.delete({ where: { id: storedToken.id } }).catch(() => {});
    }
    return NextResponse.redirect(new URL('/login?error=demo', req.url));
  }

  // Delete before use to prevent replay attacks
  await prisma.passwordResetToken.delete({ where: { id: storedToken.id } });

  // Perform the sign-in server-side — NextAuth v5 signIn() sets the session
  // cookie and throws NEXT_REDIRECT, which Next.js converts to a 302 response.
  // The demo password stays entirely on the server.
  await signIn('credentials', { email, password, redirectTo: '/dashboard' });

  // signIn always redirects; this line is unreachable but satisfies TypeScript.
  return NextResponse.redirect(new URL('/dashboard', req.url));
}
