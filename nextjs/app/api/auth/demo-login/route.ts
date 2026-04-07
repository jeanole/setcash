import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db as prisma } from '@/lib/db';
import { getCountryCode } from '@/lib/analytics';

const schema = z.object({
  turnstileToken: z.string().min(1, 'Missing verification token.'),
});

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

  // Return demo credentials — the client will use signIn('credentials', ...)
  const email = process.env.DEMO_USER_EMAIL;
  const password = process.env.DEMO_USER_PASSWORD;
  if (!email || !password) {
    return NextResponse.json({ error: 'Demo login not configured' }, { status: 503 });
  }

  return NextResponse.json({ email, password });
}
