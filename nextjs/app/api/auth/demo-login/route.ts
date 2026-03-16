import { NextResponse } from 'next/server';
import { z } from 'zod';

const schema = z.object({
  turnstileToken: z.string().min(1, 'Missing verification token.'),
});

export async function POST(req: Request) {
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
    return NextResponse.json({ error: 'Verification failed. Please try again.' }, { status: 403 });
  }

  // Return demo credentials — the client will use signIn('credentials', ...)
  const email = process.env.DEMO_USER_EMAIL ?? 'testuser@setcash.app';
  const password = process.env.DEMO_USER_PASSWORD ?? 'supersafepw';

  return NextResponse.json({ email, password });
}
