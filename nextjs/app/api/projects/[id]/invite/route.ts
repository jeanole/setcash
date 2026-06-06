import { NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { sendInvitationEmail } from '@/lib/email';
import { inviteLimiter } from '@/lib/ratelimit';

const schema = z.object({
  email: z.string().email(),
  message: z.string().max(500).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Block demo accounts from sending invitations
  if (session.user.isDemoAccount && session.user.role !== 'superadmin') {
    return NextResponse.json({ error: 'Demo accounts cannot send invitations.' }, { status: 403 });
  }

  const { id: projectId } = await params;

  // Verify the inviter is a member of this project (or superadmin)
  const isSuperAdmin = session.user.role === 'superadmin';
  let inviterRole: string | null = null;

  if (isSuperAdmin) {
    inviterRole = 'superadmin';
  } else {
    const membership = await prisma.projectMember.findUnique({
      where: {
        projectId_userEmail: {
          projectId,
          userEmail: session.user.email,
        },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this project' }, { status: 403 });
    }
    inviterRole = membership.role;
  }

  // Rate limit: 20 invites per hour per project
  const rl = await inviteLimiter.limit(projectId);
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many invite requests. Please try again later.' }, { status: 429 });
  }

  // Only admins, owners, and superadmins can send invitations or auto-add members
  const canAutoAdd = inviterRole === 'admin' || inviterRole === 'owner' || inviterRole === 'superadmin';

  if (!canAutoAdd) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || 'Invalid input.';
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const { email, message } = parsed.data;

  // Don't allow self-invite
  if (email.toLowerCase() === session.user.email.toLowerCase()) {
    return NextResponse.json({ error: 'You cannot invite yourself.' }, { status: 400 });
  }

  // Check if already a member
  const existingMember = await prisma.projectMember.findUnique({
    where: {
      projectId_userEmail: {
        projectId,
        userEmail: email,
      },
    },
  });

  if (existingMember) {
    return NextResponse.json({ error: 'This user is already a member of the project.' }, { status: 400 });
  }

  // Get project name for the email
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true },
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
  }

  // Delete any existing invitation tokens for this email + project
  await prisma.invitationToken.deleteMany({
    where: { email, projectId },
  });

  // Generate token
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  // Store with 7-day expiry
  await prisma.invitationToken.create({
    data: {
      email,
      tokenHash,
      projectId,
      role: 'user',
      message: message || null,
      invitedBy: session.user.email,
      autoAdd: canAutoAdd,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  // Build invite URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const inviteUrl = `${appUrl}/accept-invite?token=${rawToken}`;

  // If the invited email belongs to an existing user, create an in-app notification now
  const existingUser = await prisma.user.findUnique({ where: { email }, select: { email: true } });
  if (existingUser) {
    await prisma.notification.create({
      data: {
        userEmail: email,
        type: 'pending_invite',
        message: `${session.user.email} invited you to join "${project.name}". Check your email for the invite link.`,
        projectId,
      },
    });
  }

  // Send email
  try {
    await sendInvitationEmail(email, inviteUrl, session.user.email, project.name, message);
  } catch (err) {
    console.error('[Invite] Failed to send invitation email:', err);
    // Token is created — the invite still works if user has the link
  }

  return NextResponse.json({ message: `Invitation sent to ${email}.` });
}
