// ============================================================================
// Admin Project Member API - PUT (update), DELETE
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db as prisma } from '@/lib/db';
import { z } from 'zod';
import { ProjectRole } from '@prisma/client';

// Validation schema for updating members
const UpdateMemberSchema = z.object({
  projectRole: z.enum(['user', 'admin', 'owner']).optional(),
  positionId: z.string().optional(),
});

// PUT /api/admin/projects/[id]/members/[memberId] - Update member
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
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

    const { id, memberId } = await params;
    const body = await req.json();

    // Validate request body
    const validation = UpdateMemberSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const { projectRole, positionId } = validation.data;

    // Ensure at least one field to update
    if (projectRole === undefined && positionId === undefined) {
      return NextResponse.json(
        { error: 'At least one field (projectRole or positionId) is required' },
        { status: 400 }
      );
    }

    // Check if member exists in this project
    const member = await prisma.projectMember.findFirst({
      where: {
        id: memberId,
        projectId: id,
      },
    });

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
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

    // Update member
    await prisma.projectMember.update({
      where: { id: memberId },
      data: {
        ...(projectRole !== undefined && { role: projectRole as ProjectRole }),
        ...(positionId !== undefined && { positionId: positionId || null }),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error updating project member:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/projects/[id]/members/[memberId] - Remove member
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
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

    const { id, memberId } = await params;

    // Check if member exists in this project
    const member = await prisma.projectMember.findFirst({
      where: {
        id: memberId,
        projectId: id,
      },
    });

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Delete member
    await prisma.projectMember.delete({
      where: { id: memberId },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error deleting project member:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
