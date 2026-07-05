import { NextResponse } from 'next/server';
import { db as prisma } from '@/lib/db';
import { z } from 'zod';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { signUpLimiter } from '@/lib/ratelimit';
import { sendVerificationEmail } from '@/lib/email';

const schema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .regex(/[a-z]/, 'Password must contain a lowercase letter.')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter.')
    .regex(/[0-9]/, 'Password must contain a digit.'),
});

export async function POST(req: Request) {
  // Gate self-registration behind EXTERNAL_REGISTRATION env var
  if (process.env.EXTERNAL_REGISTRATION === 'false') {
    return NextResponse.json(
      { error: 'Self-registration is disabled. Please ask a team member for an invitation.' },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || 'Invalid input.';
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const { email, password } = parsed.data;

  // Rate limit by IP — prefer the trusted Cloudflare header (cannot be spoofed
  // by clients when the app is behind Cloudflare), then the reverse-proxy header,
  // and fall back to x-forwarded-for which is least trustworthy.
  const ip =
    req.headers.get('cf-connecting-ip')?.trim() ||
    req.headers.get('x-real-ip')?.trim() ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown';
  const { success } = await signUpLimiter.limit(ip);
  if (!success) {
    return NextResponse.json(
      { error: 'Too many sign-up attempts. Please try again later.' },
      { status: 429 }
    );
  }

  // Generic success — no user enumeration
  const genericMessage = 'If this email is not already registered, a verification link has been sent.';

  try {
    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing) {
      // Don't reveal that the account exists
      return NextResponse.json({ message: genericMessage });
    }

    // Create user with unverified email
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        emailVerified: null,
      },
    });

    // Delete any existing verification tokens for this email
    await prisma.emailVerificationToken.deleteMany({ where: { email } });

    // Generate token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    // Store hashed token with 24-hour expiry
    await prisma.emailVerificationToken.create({
      data: {
        email,
        tokenHash,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    // Build verification URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const verifyUrl = `${appUrl}/verify-email?token=${rawToken}`;

    // Send email (fire-and-forget)
    sendVerificationEmail(email, verifyUrl).catch((err) => {
      console.error('[SignUp] Failed to send verification email:', err);
    });
  } catch (err) {
    console.error('[SignUp] Error:', err);
    // Still return generic success
  }

  return NextResponse.json({ message: genericMessage });
}
