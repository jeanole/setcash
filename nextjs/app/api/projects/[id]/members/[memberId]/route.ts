import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { ProjectRole } from '@prisma/client';
import { cleanupAfterMemberRemoval } from '@/lib/telegram/membership-cleanup';

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

    // Non-owners cannot modify their own membership record
    if (targetMember.userEmail === session.user.email && currentMembership.role !== 'owner') {
      return NextResponse.json({ error: 'Cannot modify your own membership record' }, { status: 403 });
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
    }

    const updateData: { role?: ProjectRole; positionId?: string | null } = {};
    if (validated.role) {
      updateData.role = validated.role as ProjectRole;
    }
    if (validated.positionId !== undefined) {
      updateData.positionId = validated.positionId;
    }

    // The position must belong to this project
    if (validated.positionId) {
      const position = await prisma.projectPosition.findFirst({
        where: { id: validated.positionId, projectId: id },
        select: { id: true },
      });
      if (!position) {
        return NextResponse.json({ error: 'Invalid position' }, { status: 400 });
      }
    }

    // Last-owner check and write share a serializable transaction so two
    // concurrent demotions cannot both pass the count.
    const result = await prisma.$transaction(
      async (tx) => {
        const current = await tx.projectMember.findUnique({ where: { id: memberId } });
        if (!current || current.projectId !== id) {
          return { error: 'Member not found', status: 404 };
        }

        if (current.role === 'owner' && validated.role && validated.role !== 'owner') {
          const ownerCount = await tx.projectMember.count({
            where: { projectId: id, role: 'owner' },
          });
          if (ownerCount <= 1) {
            return { error: 'Cannot remove the last owner', status: 400 };
          }
        }

        const updated = await tx.projectMember.update({
          where: { id: memberId },
          data: updateData,
        });
        return { updated };
      },
      { isolationLevel: 'Serializable' }
    );

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result.updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    if ((error as { code?: string }).code === 'P2034') {
      return NextResponse.json({ error: 'Concurrent update detected, please retry' }, { status: 409 });
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

    // Last-owner check, delete and side-effects share a serializable transaction
    const result = await prisma.$transaction(
      async (tx) => {
        const current = await tx.projectMember.findUnique({ where: { id: memberId } });
        if (!current || current.projectId !== id) {
          return { error: 'Member not found', status: 404 };
        }

        if (current.role === 'owner') {
          const ownerCount = await tx.projectMember.count({
            where: { projectId: id, role: 'owner' },
          });
          if (ownerCount <= 1) {
            return { error: 'Cannot remove the last owner', status: 400 };
          }
        }

        await tx.projectMember.delete({ where: { id: memberId } });
        await cleanupAfterMemberRemoval(tx, id, current.userEmail);
        return null;
      },
      { isolationLevel: 'Serializable' }
    );

    if (result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2034') {
      return NextResponse.json({ error: 'Concurrent update detected, please retry' }, { status: 409 });
    }
    console.error('Error removing member:', error);
    return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 });
  }
}
