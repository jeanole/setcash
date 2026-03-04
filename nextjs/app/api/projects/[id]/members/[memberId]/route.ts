import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../../../auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { ProjectRole } from '@prisma/client';

const updateSchema = z.object({
  role: z.enum(['user', 'admin', 'owner']).optional(),
  positionId: z.string().optional().nullable(),
});

// PUT /api/projects/[id]/members/[memberId] - Update member
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const session = await auth();
  const { id, memberId } = await params;

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Check current user's membership and role
    const currentMembership = await prisma.projectMember.findUnique({
      where: {
        projectId_userEmail: {
          projectId: id,
          userEmail: session.user.email,
        },
      },
    });

    if (!currentMembership || (currentMembership.role !== 'admin' && currentMembership.role !== 'owner')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get target member
    const targetMember = await prisma.projectMember.findUnique({
      where: { id: memberId },
    });

    if (!targetMember || targetMember.projectId !== id) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    const body = await request.json();
    const validated = updateSchema.parse(body);

    // Only owners can change owner roles
    if (validated.role && (targetMember.role === 'owner' || validated.role === 'owner')) {
      if (currentMembership.role !== 'owner') {
        return NextResponse.json(
          { error: 'Only owners can change owner roles' },
          { status: 403 }
        );
      }

      // Check if trying to remove last owner
      if (targetMember.role === 'owner' && validated.role !== 'owner') {
        const ownerCount = await prisma.projectMember.count({
          where: {
            projectId: id,
            role: 'owner',
          },
        });

        if (ownerCount <= 1) {
          return NextResponse.json(
            { error: 'Cannot remove the last owner' },
            { status: 400 }
          );
        }
      }
    }

    const updateData: { role?: ProjectRole; positionId?: string | null } = {};
    if (validated.role) {
      updateData.role = validated.role as ProjectRole;
    }
    if (validated.positionId !== undefined) {
      updateData.positionId = validated.positionId;
    }

    const updated = await prisma.projectMember.update({
      where: { id: memberId },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error('Error updating member:', error);
    return NextResponse.json({ error: 'Failed to update member' }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/members/[memberId] - Remove member
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const session = await auth();
  const { id, memberId } = await params;

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Check current user's membership and role
    const currentMembership = await prisma.projectMember.findUnique({
      where: {
        projectId_userEmail: {
          projectId: id,
          userEmail: session.user.email,
        },
      },
    });

    if (!currentMembership || (currentMembership.role !== 'admin' && currentMembership.role !== 'owner')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get target member
    const targetMember = await prisma.projectMember.findUnique({
      where: { id: memberId },
    });

    if (!targetMember || targetMember.projectId !== id) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Only owners can remove owners
    if (targetMember.role === 'owner' && currentMembership.role !== 'owner') {
      return NextResponse.json(
        { error: 'Only owners can remove owners' },
        { status: 403 }
      );
    }

    // Check if trying to remove last owner
    if (targetMember.role === 'owner') {
      const ownerCount = await prisma.projectMember.count({
        where: {
          projectId: id,
          role: 'owner',
        },
      });

      if (ownerCount <= 1) {
        return NextResponse.json(
          { error: 'Cannot remove the last owner' },
          { status: 400 }
        );
      }
    }

    await prisma.projectMember.delete({
      where: { id: memberId },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error removing member:', error);
    return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 });
  }
}
