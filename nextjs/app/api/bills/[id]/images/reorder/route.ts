// ============================================================================
// Bill Images Reorder API - PUT
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db as prisma } from '@/lib/db';
import { z } from 'zod';
import { verifyAdminRole } from '@/lib/auth-guard';
import { imageEditLockResponse, syncLegacyImageColumns } from '@/app/api/bills/_lib/shared';

// Upper bound on the list length (bills hold at most 10 images via the UI;
// the headroom covers older bills that were created with more)
const MAX_REORDER_ITEMS = 50;

const reorderImagesSchema = z.object({
  images: z
    .array(z.object({
      id: z.string().min(1).max(100),
      sortOrder: z.number().int().min(0).max(1000),
    }))
    .max(MAX_REORDER_ITEMS)
    .refine((images) => new Set(images.map((i) => i.id)).size === images.length, {
      message: 'Duplicate image ids',
    }),
});

// PUT /api/bills/[id]/images/reorder - Reorder images
export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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
      select: { id: true, submittedByEmail: true, status: true },
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

    // Approved/paid bills: images are frozen unless the caller is a DB-verified admin
    const lockResponse = await imageEditLockResponse(bill.status, session.user.email, projectId);
    if (lockResponse) return lockResponse;

    const body = await req.json();
    const validation = reorderImagesSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { images } = validation.data;

    // Update every image's sort order in one transaction (all or nothing),
    // then keep the legacy "first image" column in step.
    await prisma.$transaction(async (tx) => {
      for (const img of images) {
        await tx.billImage.updateMany({
          where: {
            id: img.id,
            billId: id,
          },
          data: {
            sortOrder: img.sortOrder,
          },
        });
      }

      await syncLegacyImageColumns(tx, id);

      // Log the reorder
      await tx.editLog.create({
        data: {
          projectId,
          timestamp: new Date(),
          user: session.user.email,
          billId: id,
          changes: { images: 'reordered' },
          source: 'user',
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error reordering images:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
