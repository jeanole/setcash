import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { ProjectRole } from '@prisma/client';

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['user', 'admin', 'owner']).default('user'),
  positionId: z.string().optional().nullable(),
});

// GET /api/projects/[id]/members - List project members
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Check if user is a member
    const membership = await prisma.projectMember.findUnique({
      where: {
        projectId_userEmail: {
          projectId: id,
          userEmail: session.user.email,
        },
      },
    });

    const isSuperAdmin = session.user.role === 'superadmin';

    if (!membership && !isSuperAdmin) {
      return NextResponse.json({ error: 'Not a member of this project' }, { status: 403 });
    }

    if (membership && membership.role === 'user' && !isSuperAdmin) {
      return NextResponse.json({ error: 'Forbidden: admin or owner role required' }, { status: 403 });
    }

    const members = await prisma.projectMember.findMany({
      where: { projectId: id },
      include: {
        position: true,
      },
    });

    return NextResponse.json(
      members.map((m) => ({
        id: m.id,
        email: m.userEmail,
        role: m.role,
        positionId: m.positionId,
        positionName: m.position?.name || null,
      }))
    );
  } catch (error) {
    console.error('Error fetching members:', error);
    return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
  }
}

// POST /api/projects/[id]/members - Invite member
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Check if user is admin or owner
    const membership = await prisma.projectMember.findUnique({
      where: {
        projectId_userEmail: {
          projectId: id,
          userEmail: session.user.email,
        },
      },
    });

    if (!membership || (membership.role !== 'admin' && membership.role !== 'owner')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const validated = inviteSchema.parse(body);

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email: validated.email },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found — they must register first' },
        { status: 400 }
      );
    }

    // Check if already a member
    const existingMember = await prisma.projectMember.findUnique({
      where: {
        projectId_userEmail: {
          projectId: id,
          userEmail: validated.email,
        },
      },
    });

    if (existingMember) {
      return NextResponse.json(
        { error: 'User is already a member of this project' },
        { status: 400 }
      );
    }

    // Only owners can invite owners
    if (validated.role === 'owner' && membership.role !== 'owner') {
      return NextResponse.json(
        { error: 'Only owners can invite owners' },
        { status: 403 }
      );
    }

    // Create member
    const newMember = await prisma.projectMember.create({
      data: {
        projectId: id,
        userEmail: validated.email,
        role: validated.role as ProjectRole,
        positionId: validated.positionId || null,
      },
    });

    // Create notification for invited user
    await prisma.notification.create({
      data: {
        userEmail: validated.email,
        type: 'project_invite',
        message: `You have been invited to join a project`,
        projectId: id,
      },
    });

    return NextResponse.json(newMember, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error('Error inviting member:', error);
    return NextResponse.json({ error: 'Failed to invite member' }, { status: 500 });
  }
}
