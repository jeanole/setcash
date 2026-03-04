// ============================================================================
// Admin Project Members API - GET (list), POST (add member)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db as prisma } from '@/lib/db';
import { z } from 'zod';
import { ProjectRole } from '@prisma/client';

// Validation schema for adding members
const MemberSchema = z.object({
  email: z.string().email(),
  projectRole: z.enum(['user', 'admin', 'owner']).optional(),
  positionId: z.string().optional(),
});

// GET /api/admin/projects/[id]/members - List project members
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is super-admin
    if (session.user.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    // Check if project exists
    const project = await prisma.project.findUnique({
      where: { id },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const members = await prisma.projectMember.findMany({
      where: { projectId: id },
      orderBy: { userEmail: 'asc' },
      select: {
        id: true,
        userEmail: true,
        role: true,
        positionId: true,
        position: {
          select: {
            name: true,
          },
        },
      },
    });

    const mapped = members.map((m) => ({
      id: m.id,
      email: m.userEmail,
      projectRole: m.role,
      positionId: m.positionId,
      positionName: m.position?.name ?? 'Misc',
    }));

    return NextResponse.json(mapped);
  } catch (error) {
    console.error('Error fetching project members:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/admin/projects/[id]/members - Add member to project
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is super-admin
    if (session.user.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();

    // Validate request body
    const validation = MemberSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email, projectRole, positionId } = validation.data;

    // Check if project exists
    const project = await prisma.project.findUnique({
      where: { id },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Find user by email (case-insensitive)
    const foundUser = await prisma.user.findFirst({
      where: {
        email: {
          equals: email,
          mode: 'insensitive',
        },
      },
    });

    if (!foundUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 400 });
    }

    // Validate position if provided
    if (positionId) {
      const position = await prisma.projectPosition.findFirst({
        where: {
          id: positionId,
          projectId: id,
        },
      });

      if (!position) {
        return NextResponse.json(
          { error: 'Position not found' },
          { status: 400 }
        );
      }
    }

    // Create membership
    const membership = await prisma.projectMember.create({
      data: {
        projectId: id,
        userEmail: foundUser.email,
        role: (projectRole as ProjectRole) ?? 'user',
        positionId: positionId ?? null,
      },
    });

    // Create notification for invited user
    await prisma.notification.create({
      data: {
        userEmail: foundUser.email,
        type: 'project_invite',
        message: `You have been added to "${project.name}" as ${projectRole ?? 'user'}.`,
        projectId: id,
      },
    });

    return NextResponse.json({ ok: true, id: membership.id });
  } catch (error) {
    // Check for unique constraint violation
    if (
      error instanceof Error &&
      error.message.includes('Unique constraint')
    ) {
      return NextResponse.json(
        { error: 'User is already a member' },
        { status: 400 }
      );
    }

    console.error('Error adding project member:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
