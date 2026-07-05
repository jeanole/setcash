import { NextResponse } from 'next/server';
import { db as prisma } from '@/lib/db';
import { z } from 'zod';
import crypto from 'crypto';
import { resendVerificationLimiter } from '@/lib/ratelimit';
import { sendVerificationEmail } from '@/lib/email';

const schema = z.object({
  email: z.string().email(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 });
  }

  const { email } = parsed.data;

  // Rate limit by email
  const { success } = await resendVerificationLimiter.limit(email.toLowerCase());
  if (!success) {
    return NextResponse.json(
      { error: 'Please wait a couple of minutes before requesting another verification email.' },
      { status: 429 }
    );
  }

  // Generic success — no enumeration
  const genericMessage = 'If an unverified account exists with that email, a new verification link has been sent.';

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    // Only send if user exists, has a password, and is not yet verified
    if (user && user.passwordHash && !user.emailVerified) {
      // Delete existing tokens
      await prisma.emailVerificationToken.deleteMany({ where: { email } });

      // Generate new token
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      await prisma.emailVerificationToken.create({
        data: {
          email,
          tokenHash,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const verifyUrl = `${appUrl}/verify-email?token=${rawToken}`;

      sendVerificationEmail(email, verifyUrl).catch((err) => {
        console.error('[ResendVerification] Failed to send email:', err);
      });
    }
  } catch (err) {
    console.error('[ResendVerification] Error:', err);
  }

  return NextResponse.json({ message: genericMessage });
}
