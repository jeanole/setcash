import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import crypto from 'crypto';
import { forgotPasswordLimiter } from '@/lib/ratelimit';
import { sendPasswordResetEmail } from '@/lib/email';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

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
  const { success } = await forgotPasswordLimiter.limit(email.toLowerCase());
  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again in a few minutes.' },
      { status: 429 }
    );
  }

  // Always return success — no user enumeration
  const genericMessage = 'If an account exists with that email, a reset link has been sent.';

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    // Only proceed if user exists, has a password, and is not a demo account
    if (user && user.passwordHash && !user.isDemoAccount) {
      // Delete any existing tokens for this email
      await prisma.passwordResetToken.deleteMany({ where: { email } });

      // Generate token
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      // Store hashed token with 1-hour expiry
      await prisma.passwordResetToken.create({
        data: {
          email,
          tokenHash,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      // Build reset URL
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;

      // Send email (fire-and-forget — don't block the response on email errors)
      sendPasswordResetEmail(email, resetUrl).catch((err) => {
        console.error('[ForgotPassword] Failed to send email:', err);
      });
    }
  } catch (err) {
    console.error('[ForgotPassword] Error:', err);
    // Still return generic success — don't leak internal errors
  }

  return NextResponse.json({ message: genericMessage });
}
