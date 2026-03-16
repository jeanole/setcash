import { NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { sendInvitationEmail } from '@/lib/email';

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

  // Block demo accounts from sending invitations
  if (session.user.isDemoAccount && session.user.role !== 'superadmin') {
    return NextResponse.json({ error: 'Demo accounts cannot send invitations.' }, { status: 403 });
  }

  // Find the example project — platform invites land here
  const exampleProject = await prisma.project.findFirst({
    where: { isExample: true },
    select: { id: true, name: true },
  });

  if (!exampleProject) {
    return NextResponse.json(
      { error: 'No example project configured. Contact an administrator.' },
      { status: 500 }
    );
  }

  // Check if already a member of the example project
  const existingMember = await prisma.projectMember.findUnique({
    where: {
      projectId_userEmail: {
        projectId: exampleProject.id,
        userEmail: email,
      },
    },
  });

  if (existingMember) {
    return NextResponse.json(
      { error: 'This user already has an account.' },
      { status: 400 }
    );
  }

  // Delete any existing invitation tokens for this email + example project
  await prisma.invitationToken.deleteMany({
    where: { email, projectId: exampleProject.id },
  });

  // Generate token
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  // Store with 7-day expiry — autoAdd true so invitee gets immediate access to example project
  await prisma.invitationToken.create({
    data: {
      email,
      tokenHash,
      projectId: exampleProject.id,
      role: 'user',
      message: message || null,
      invitedBy: session.user.email,
      autoAdd: true,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  // Build invite URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const inviteUrl = `${appUrl}/accept-invite?token=${rawToken}`;

  // If the invited email belongs to an existing user, create an in-app notification
  const existingUser = await prisma.user.findUnique({ where: { email }, select: { email: true } });
  if (existingUser) {
    await prisma.notification.create({
      data: {
        userEmail: email,
        type: 'pending_invite',
        message: `${session.user.email} invited you to join SetCash. Check your email for the invite link.`,
        projectId: exampleProject.id,
      },
    });
  }

  // Send email
  try {
    await sendInvitationEmail(email, inviteUrl, session.user.email, exampleProject.name, message);
  } catch (err) {
    console.error('[Invite] Failed to send platform invite email:', err);
    // Token is created — the invite still works if user has the link
  }

  return NextResponse.json({ message: `Invitation sent to ${email}.` });
}
