import { NextResponse } from 'next/server';
import { db as prisma } from '@/lib/db';
import { z } from 'zod';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { passwordSchema } from '@/lib/auth/password';

// GET: Validate token and return invitation details
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Missing token.' }, { status: 400 });
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const invitation = await prisma.invitationToken.findUnique({
    where: { tokenHash },
    include: { project: { select: { name: true } } },
  });

  if (!invitation || invitation.expiresAt < new Date()) {
    if (invitation) {
      await prisma.invitationToken.delete({ where: { id: invitation.id } });
    }
    return NextResponse.json({ error: 'Invalid or expired invitation link.' }, { status: 400 });
  }

  // Check if user already exists. An unverified account is treated as new:
  // its password was set by whoever signed up, which may not be the invitee,
  // so the invitee must choose a password (see POST).
  const existingUser = await prisma.user.findFirst({
    where: { email: { equals: invitation.email, mode: 'insensitive' } },
    select: { emailVerified: true },
  });

  return NextResponse.json({
    email: invitation.email,
    projectName: invitation.project.name,
    invitedBy: invitation.invitedBy,
    message: invitation.message,
    userExists: !!existingUser?.emailVerified,
    autoAdd: invitation.autoAdd,
  });
}

// POST: Accept invitation — create user if needed, add to project
const acceptSchema = z.object({
  token: z.string().min(1).max(256),
  password: passwordSchema.optional(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = acceptSchema.safeParse(body);

  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || 'Invalid input.';
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const { token, password } = parsed.data;

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const invitation = await prisma.invitationToken.findUnique({
    where: { tokenHash },
    include: { project: { select: { id: true, name: true } } },
  });

  if (!invitation || invitation.expiresAt < new Date()) {
    if (invitation) {
      await prisma.invitationToken.delete({ where: { id: invitation.id } });
    }
    return NextResponse.json(
      { error: 'Invalid or expired invitation link. Please ask for a new invite.' },
      { status: 400 }
    );
  }

  // Case-insensitive: older invitations/accounts may differ in letter case
  const user = await prisma.user.findFirst({
    where: { email: { equals: invitation.email, mode: 'insensitive' } },
  });
  // The address the account is (or will be) stored under
  const accountEmail = user?.email ?? invitation.email;

  // Never re-activate an account an admin has disabled
  if (user && !user.isActive) {
    return NextResponse.json(
      { error: 'This account has been disabled. Please contact an administrator.' },
      { status: 403 }
    );
  }

  // No account yet, or an unverified one: the invitee proves email ownership
  // with this link and must set the password. An unverified account's existing
  // password may have been chosen by someone else (pre-registration takeover),
  // so it is replaced and any sessions are ended.
  const needsPassword = !user || !user.emailVerified;
  if (needsPassword && !password) {
    return NextResponse.json(
      { error: 'Password is required to create your account.' },
      { status: 400 }
    );
  }
  const passwordHash = needsPassword && password ? await bcrypt.hash(password, 12) : null;

  // Claim the invitation atomically (single-use) and apply account changes
  const claimed = await prisma.$transaction(async (tx) => {
    const { count } = await tx.invitationToken.deleteMany({ where: { id: invitation.id } });
    if (count === 0) return false;

    if (!user) {
      await tx.user.create({
        data: {
          email: invitation.email,
          passwordHash: passwordHash!,
          emailVerified: new Date(), // Invitation proves email ownership
          isActive: true,
          defaultProjectId: invitation.projectId,
        },
      });
    } else if (!user.emailVerified) {
      await tx.user.update({
        where: { email: accountEmail },
        data: {
          passwordHash: passwordHash!,
          emailVerified: new Date(),
          sessionVersion: { increment: 1 },
          ...(user.defaultProjectId ? {} : { defaultProjectId: invitation.projectId }),
        },
      });
    } else if (!user.defaultProjectId) {
      await tx.user.update({
        where: { email: accountEmail },
        data: { defaultProjectId: invitation.projectId },
      });
    }
    return true;
  });

  if (!claimed) {
    return NextResponse.json(
      { error: 'Invalid or expired invitation link. Please ask for a new invite.' },
      { status: 400 }
    );
  }

  // Only auto-add to project if the inviter had admin/owner/superadmin privileges
  if (invitation.autoAdd) {
    const existingMembership = await prisma.projectMember.findUnique({
      where: {
        projectId_userEmail: {
          projectId: invitation.projectId,
          userEmail: accountEmail,
        },
      },
    });

    if (!existingMembership) {
      await prisma.projectMember.create({
        data: {
          projectId: invitation.projectId,
          userEmail: accountEmail,
          role: invitation.role,
        },
      });
    }

    // Create notification
    await prisma.notification.create({
      data: {
        userEmail: accountEmail,
        type: 'project_invite',
        message: `You have been added to project "${invitation.project.name}" by ${invitation.invitedBy}.`,
        projectId: invitation.projectId,
      },
    });
  } else {
    // Normal user invite — just create the account, admin must add them to the project manually
    await prisma.notification.create({
      data: {
        userEmail: invitation.invitedBy,
        type: 'project_invite',
        message: `${accountEmail} accepted your invitation to "${invitation.project.name}". Add them to the project to give access.`,
        projectId: invitation.projectId,
      },
    });
  }

  // Delete all invitation tokens for this email + project
  await prisma.invitationToken.deleteMany({
    where: { email: invitation.email, projectId: invitation.projectId },
  });

  const responseMessage = invitation.autoAdd
    ? `Welcome to ${invitation.project.name}! You can now sign in.`
    : `Account created! An admin will add you to ${invitation.project.name}.`;

  return NextResponse.json({ message: responseMessage });
}
