import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  budget: z.number().min(0).optional(),
});

// Helper to check admin access
async function checkAdminAccess(session: any, projectId: string) {
  if (session?.user?.role === 'superadmin') {
    return true;
  }

  const membership = await prisma.projectMember.findUnique({
    where: {
      projectId_userEmail: {
        projectId,
        userEmail: session?.user?.email,
      },
    },
  });

  return membership?.role === 'admin' || membership?.role === 'owner';
}

// PUT /api/projects/[id]/motives/[motiveId] - Update motive
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; motiveId: string }> }
) {
  const session = await auth();
  const { id, motiveId } = await params;

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const hasAccess = await checkAdminAccess(session, id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if motive exists and belongs to project
    const existingMotive = await prisma.motive.findFirst({
      where: {
        id: motiveId,
        projectId: id,
      },
    });

    if (!existingMotive) {
      return NextResponse.json({ error: 'Motive not found' }, { status: 404 });
    }

    // Cannot edit "Default" motive
    if (existingMotive.name === 'Default') {
      return NextResponse.json(
        { error: 'Cannot edit Default motive' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validated = updateSchema.parse(body);

    // Check for name change conflicts
    if (validated.name && validated.name !== existingMotive.name) {
      // Cannot rename to "Default"
      if (validated.name === 'Default') {
        return NextResponse.json(
          { error: "'Default' is a reserved motive name" },
          { status: 400 }
        );
      }

      // Check for duplicate
      const duplicate = await prisma.motive.findFirst({
        where: {
          projectId: id,
          name: {
            equals: validated.name,
            mode: 'insensitive',
          },
          id: { not: motiveId },
        },
      });

      if (duplicate) {
        return NextResponse.json(
          { error: 'A motive with this name already exists' },
          { status: 400 }
        );
      }
    }

    const updateData: { name?: string; budget?: number } = {};
    if (validated.name !== undefined) updateData.name = validated.name;
    if (validated.budget !== undefined) updateData.budget = validated.budget;

    const motive = await prisma.motive.update({
      where: { id: motiveId },
      data: updateData,
      include: {
        billMotives: true,
      },
    });

    return NextResponse.json({
      id: motive.id,
      name: motive.name,
      budget: Number(motive.budget),
      billCount: motive.billMotives.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error('Error updating motive:', error);
    return NextResponse.json({ error: 'Failed to update motive' }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/motives/[motiveId] - Delete motive
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; motiveId: string }> }
) {
  const session = await auth();
  const { id, motiveId } = await params;

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const hasAccess = await checkAdminAccess(session, id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if motive exists and belongs to project
    const existingMotive = await prisma.motive.findFirst({
      where: {
        id: motiveId,
        projectId: id,
      },
    });

    if (!existingMotive) {
      return NextResponse.json({ error: 'Motive not found' }, { status: 404 });
    }

    // Cannot delete "Default" motive
    if (existingMotive.name === 'Default') {
      return NextResponse.json(
        { error: 'Cannot delete Default motive' },
        { status: 400 }
      );
    }

    // Delete bill motive allocations first (cascade)
    await prisma.billMotive.deleteMany({
      where: { motiveId },
    });

    // Delete budget matrix entries
    await prisma.budgetMatrix.deleteMany({
      where: { motiveId },
    });

    // Delete the motive
    await prisma.motive.delete({
      where: { id: motiveId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting motive:', error);
    return NextResponse.json({ error: 'Failed to delete motive' }, { status: 500 });
  }
}
