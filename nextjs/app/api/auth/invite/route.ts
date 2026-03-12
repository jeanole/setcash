import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { sendPlatformInviteEmail } from '@/lib/email';

const schema = z.object({
  email: z.string().email(),
  message: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || 'Invalid input.';
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const { email, message } = parsed.data;

  if (email.toLowerCase() === session.user.email.toLowerCase()) {
    return NextResponse.json({ error: 'You cannot invite yourself.' }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const signupUrl = appUrl;

  try {
    await sendPlatformInviteEmail(email, signupUrl, session.user.email, message);
  } catch (err) {
    console.error('[Invite] Failed to send platform invite email:', err);
  }

  return NextResponse.json({ message: `Invitation sent to ${email}.` });
}
