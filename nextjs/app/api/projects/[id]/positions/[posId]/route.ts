import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const updateSchema = z.object({
  name: z.string().min(1).max(50),
});

// PUT /api/projects/[id]/positions/[posId] - Update position
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; posId: string }> }
) {
  const session = await auth();
  const { id, posId } = await params;

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

    // Get position
    const position = await prisma.projectPosition.findUnique({
      where: { id: posId },
    });

    if (!position || position.projectId !== id) {
      return NextResponse.json({ error: 'Position not found' }, { status: 404 });
    }

    // Cannot edit Misc
    if (position.name.toLowerCase() === 'misc') {
      return NextResponse.json(
        { error: 'Cannot edit Misc position' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validated = updateSchema.parse(body);

    // Check for "Misc" reservation
    if (validated.name.toLowerCase() === 'misc') {
      return NextResponse.json(
        { error: "'Misc' is reserved" },
        { status: 400 }
      );
    }

    // Check for duplicate (excluding self)
    const existing = await prisma.projectPosition.findFirst({
      where: {
        projectId: id,
        name: {
          equals: validated.name,
          mode: 'insensitive',
        },
        id: { not: posId },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Position already exists' },
        { status: 400 }
      );
    }

    const updated = await prisma.projectPosition.update({
      where: { id: posId },
      data: { name: validated.name },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error('Error updating position:', error);
    return NextResponse.json({ error: 'Failed to update position' }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/positions/[posId] - Delete position
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; posId: string }> }
) {
  const session = await auth();
  const { id, posId } = await params;

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

    // Get position
    const position = await prisma.projectPosition.findUnique({
      where: { id: posId },
    });

    if (!position || position.projectId !== id) {
      return NextResponse.json({ error: 'Position not found' }, { status: 404 });
    }

    // Cannot delete Misc
    if (position.name.toLowerCase() === 'misc') {
      return NextResponse.json(
        { error: 'Cannot delete Misc position' },
        { status: 400 }
      );
    }

    // Update members with this position to null
    await prisma.projectMember.updateMany({
      where: { positionId: posId },
      data: { positionId: null },
    });

    await prisma.projectPosition.delete({
      where: { id: posId },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error deleting position:', error);
    return NextResponse.json({ error: 'Failed to delete position' }, { status: 500 });
  }
}
