import { NextResponse } from 'next/server';
import { db as prisma } from '@/lib/db';
import { z } from 'zod';
import crypto from 'crypto';

const schema = z.object({
  token: z.string().min(1),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid token.' }, { status: 400 });
  }

  const { token } = parsed.data;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  try {
    const record = await prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
    });

    if (!record) {
      return NextResponse.json(
        { error: 'Invalid or expired verification link.' },
        { status: 400 }
      );
    }

    if (record.expiresAt < new Date()) {
      // Clean up expired token
      await prisma.emailVerificationToken.delete({ where: { tokenHash } });
      return NextResponse.json(
        { error: 'This verification link has expired. Please request a new one.' },
        { status: 400 }
      );
    }

    // Mark user as verified
    await prisma.user.update({
      where: { email: record.email },
      data: { emailVerified: new Date() },
    });

    // Delete all verification tokens for this email
    await prisma.emailVerificationToken.deleteMany({ where: { email: record.email } });

    return NextResponse.json({ message: 'Email verified successfully! You can now sign in.' });
  } catch (err) {
    console.error('[VerifyEmail] Error:', err);
    return NextResponse.json({ error: 'An error occurred.' }, { status: 500 });
  }
}
