import { NextResponse } from 'next/server';
import { db as prisma } from '@/lib/db';
import { z } from 'zod';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { signUpLimiter } from '@/lib/ratelimit';
import { sendVerificationEmail } from '@/lib/email';
import { getClientIp } from '@/lib/client-ip';
import { passwordSchema } from '@/lib/auth/password';
import { insensitiveEquals } from '@/lib/db-match';

const schema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.string().email().max(254)),
  password: passwordSchema,
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

  // Rate limit by client IP (see lib/client-ip — spoofable headers ignored)
  const { success } = await signUpLimiter.limit(getClientIp(req));
  if (!success) {
    return NextResponse.json(
      { error: 'Too many sign-up attempts. Please try again later.' },
      { status: 429 }
    );
  }

  // Generic success — no user enumeration
  const genericMessage = 'If this email is not already registered, a verification link has been sent.';

  try {
    // Case-insensitive: legacy rows may have mixed-case emails
    const existing = await prisma.user.findFirst({
      where: { email: insensitiveEquals(email) },
      select: { id: true },
    });

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
