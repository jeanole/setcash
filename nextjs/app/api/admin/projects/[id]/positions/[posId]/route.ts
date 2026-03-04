// ============================================================================
// Admin Project Position API - PUT (update), DELETE
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db as prisma } from '@/lib/db';
import { z } from 'zod';

// Validation schema for updating positions
const UpdatePositionSchema = z.object({
  name: z.string().min(1).max(50),
});

// PUT /api/admin/projects/[id]/positions/[posId] - Update position
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; posId: string }> }
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

    const { id, posId } = await params;
    const body = await req.json();

    // Validate request body
    const validation = UpdatePositionSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const { name } = validation.data;

    // Check if position exists in this project
    const position = await prisma.projectPosition.findFirst({
      where: {
        id: posId,
        projectId: id,
      },
    });

    if (!position) {
      return NextResponse.json({ error: 'Position not found' }, { status: 404 });
    }

    // Prevent editing "Misc" position
    if (position.name === 'Misc') {
      return NextResponse.json(
        { error: 'Cannot edit Misc position' },
        { status: 400 }
      );
    }

    // Update position
    await prisma.projectPosition.update({
      where: { id: posId },
      data: { name: name.trim() },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    // Check for unique constraint violation
    if (
      error instanceof Error &&
      error.message.includes('Unique constraint')
    ) {
      return NextResponse.json(
        { error: 'Position already exists' },
        { status: 400 }
      );
    }

    console.error('Error updating position:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/projects/[id]/positions/[posId] - Delete position
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; posId: string }> }
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

    const { id, posId } = await params;

    // Check if position exists in this project
    const position = await prisma.projectPosition.findFirst({
      where: {
        id: posId,
        projectId: id,
      },
    });

    if (!position) {
      return NextResponse.json({ error: 'Position not found' }, { status: 404 });
    }

    // Prevent deleting "Misc" position
    if (position.name === 'Misc') {
      return NextResponse.json(
        { error: 'Cannot delete Misc position' },
        { status: 400 }
      );
    }

    // Set members' position_id to NULL (becomes "Misc")
    await prisma.projectMember.updateMany({
      where: { positionId: posId },
      data: { positionId: null },
    });

    // Delete position
    await prisma.projectPosition.delete({
      where: { id: posId },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error deleting position:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
