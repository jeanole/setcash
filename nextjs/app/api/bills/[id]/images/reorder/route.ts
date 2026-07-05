// ============================================================================
// Bill Images Reorder API - PUT
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db as prisma } from '@/lib/db';
import { z } from 'zod';
import { verifyAdminRole } from '@/lib/auth-guard';

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

    const sessionClaimsAdmin =
      session.user.role === 'admin' ||
      session.user.role === 'owner' ||
      session.user.role === 'superadmin';

    // Verify bill belongs to project
    const bill = await prisma.bill.findFirst({
      where: { id, projectId },
      select: { id: true, submittedByEmail: true },
    });

    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    // Only the bill's submitter or an admin/owner/superadmin may reorder images
    const isSubmitter = session.user.email === bill.submittedByEmail;
    if (!sessionClaimsAdmin && !isSubmitter) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // SEC-02: non-submitters are relying on admin authority — re-verify
    // against the DB rather than trusting the (possibly stale) JWT claim.
    if (!isSubmitter) {
      const guard = await verifyAdminRole(session.user.email, projectId);
      if (!guard.authorized) {
        return guard.response!;
      }
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
