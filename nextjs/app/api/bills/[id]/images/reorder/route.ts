// ============================================================================
// Bill Images Reorder API - PUT
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db as prisma } from '@/lib/db';
import { z } from 'zod';

const reorderImagesSchema = z.object({
  images: z.array(z.object({
    id: z.string(),
    sortOrder: z.number(),
  })),
});

// PUT /api/bills/[id]/images/reorder - Reorder images
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = session.user.currentProjectId;
    if (!projectId) {
      return NextResponse.json({ error: 'No project selected' }, { status: 400 });
    }

    const { id } = params;

    // Verify bill belongs to project
    const bill = await prisma.bill.findFirst({
      where: { id, projectId },
    });

    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    const body = await req.json();
    const validation = reorderImagesSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { images } = validation.data;

    // Update each image's sort order
    for (const img of images) {
      await prisma.billImage.updateMany({
        where: {
          id: img.id,
          billId: id,
        },
        data: {
          sortOrder: img.sortOrder,
        },
      });
    }

    // Log the reorder
    await prisma.editLog.create({
      data: {
        projectId,
        timestamp: new Date(),
        user: session.user.email,
        billId: id,
        changes: { images: 'reordered' },
        source: 'user',
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error reordering images:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
