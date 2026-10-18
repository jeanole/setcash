import { NextResponse } from 'next/server';
import { db as prisma } from '@/lib/db';
import { z } from 'zod';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { passwordSchema } from '@/lib/auth/password';

const schema = z.object({
  token: z.string().min(1).max(256),
  password: passwordSchema,
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || 'Invalid input.';
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const { token, password } = parsed.data;

  // Hash the incoming token to match stored hash
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  // Find valid (non-expired) token
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  });

  if (!resetToken || resetToken.expiresAt < new Date()) {
    // Clean up expired token if it exists
    if (resetToken) {
      await prisma.passwordResetToken.delete({ where: { id: resetToken.id } });
    }
    return NextResponse.json(
      { error: 'Invalid or expired reset link. Please request a new one.' },
      { status: 400 }
    );
  }

  // Find the user
  const user = await prisma.user.findUnique({ where: { email: resetToken.email } });

  if (!user) {
    return NextResponse.json(
      { error: 'Invalid or expired reset link. Please request a new one.' },
      { status: 400 }
    );
  }

  // Block demo accounts from resetting password
  if (user.isDemoAccount) {
    return NextResponse.json(
      { error: 'Password reset is not available for demo accounts.' },
      { status: 403 }
    );
  }

  // Hash new password and update user
  const passwordHash = await bcrypt.hash(password, 12);

  // Claim the token atomically: if a concurrent request already used it,
  // deleteMany removes nothing and we stop (single-use).
  const updated = await prisma.$transaction(async (tx) => {
    const { count } = await tx.passwordResetToken.deleteMany({ where: { id: resetToken.id } });
    if (count === 0) return false;

    await tx.user.update({
      where: { email: resetToken.email },
      data: {
        passwordHash,
        // Using a password reset link proves email ownership — mark as verified
        emailVerified: user.emailVerified ?? new Date(),
        // End every existing session (e.g. one held by whoever knew the old password)
        sessionVersion: { increment: 1 },
      },
    });

    // Delete ALL remaining tokens for this email (invalidate siblings)
    await tx.passwordResetToken.deleteMany({ where: { email: resetToken.email } });
    return true;
  });

  if (!updated) {
    return NextResponse.json(
      { error: 'Invalid or expired reset link. Please request a new one.' },
      { status: 400 }
    );
  }

  return NextResponse.json({ message: 'Password has been reset successfully.' });
}
