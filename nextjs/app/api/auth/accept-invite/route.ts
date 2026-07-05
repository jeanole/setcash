import { NextResponse } from 'next/server';
import { db as prisma } from '@/lib/db';
import { z } from 'zod';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

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

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: invitation.email },
  });

  return NextResponse.json({
    email: invitation.email,
    projectName: invitation.project.name,
    invitedBy: invitation.invitedBy,
    message: invitation.message,
    userExists: !!existingUser,
    autoAdd: invitation.autoAdd,
  });
}

// POST: Accept invitation — create user if needed, add to project
const acceptSchema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .optional(),
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

  let user = await prisma.user.findUnique({
    where: { email: invitation.email },
  });

  if (!user) {
    // New user — password required
    if (!password) {
      return NextResponse.json(
        { error: 'Password is required to create your account.' },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    user = await prisma.user.create({
      data: {
        email: invitation.email,
        passwordHash,
        emailVerified: new Date(), // Invitation proves email ownership
        isActive: true,
        defaultProjectId: invitation.projectId,
      },
    });
  } else {
    // Existing user — activate if inactive, set default project if none
    const updates: Record<string, unknown> = {};
    if (!user.isActive) updates.isActive = true;
    if (!user.emailVerified) updates.emailVerified = new Date();
    if (!user.defaultProjectId) updates.defaultProjectId = invitation.projectId;

    if (Object.keys(updates).length > 0) {
      await prisma.user.update({
        where: { email: invitation.email },
        data: updates,
      });
    }
  }

  // Only auto-add to project if the inviter had admin/owner/superadmin privileges
  if (invitation.autoAdd) {
    const existingMembership = await prisma.projectMember.findUnique({
      where: {
        projectId_userEmail: {
          projectId: invitation.projectId,
          userEmail: invitation.email,
        },
      },
    });

    if (!existingMembership) {
      await prisma.projectMember.create({
        data: {
          projectId: invitation.projectId,
          userEmail: invitation.email,
          role: invitation.role,
        },
      });
    }

    // Create notification
    await prisma.notification.create({
      data: {
        userEmail: invitation.email,
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
        message: `${invitation.email} accepted your invitation to "${invitation.project.name}". Add them to the project to give access.`,
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
