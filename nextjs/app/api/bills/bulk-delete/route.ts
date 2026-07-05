// ============================================================================
// Bills Bulk Delete API - POST
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db as prisma } from '@/lib/db';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';
import { UPLOADS_DIR } from '@/lib/upload';
import { verifyAdminRole } from '@/lib/auth-guard';

const bulkDeleteSchema = z.object({
  ids: z.array(z.string()).min(1).max(500),
});

// POST /api/bills/bulk-delete - Bulk delete bills
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = session.user.currentProjectId;
    if (!projectId) {
      return NextResponse.json({ error: 'No project selected' }, { status: 400 });
    }

    // Check admin permission (fast pre-filter based on JWT claims)
    if (session.user.role !== 'admin' && session.user.role !== 'owner' && session.user.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden - admin only' }, { status: 403 });
    }

    // SEC-02: re-verify admin authority against the DB rather than trusting
    // the (possibly stale) JWT claim before allowing a bulk delete.
    const guard = await verifyAdminRole(session.user.email, projectId);
    if (!guard.authorized) {
      return guard.response!;
    }

    const body = await req.json();
    const validation = bulkDeleteSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { ids } = validation.data;

    // Filter to only bills in this project
    const validBills = await prisma.bill.findMany({
      where: {
        id: { in: ids },
        projectId,
      },
      include: {
        images: true,
      },
    });

    const validIds = validBills.map((b) => b.id);

    if (validIds.length === 0) {
      return NextResponse.json({ ok: true, deleted: 0 });
    }

    // Bills that have reached 'approved' or 'paid' status may only
    // be bulk-deleted by a DB-verified admin. The route itself is admin-only
    // (verified above), so this is a defense-in-depth guard should the entry
    // check above ever be loosened to admit non-admin callers.
    const protectedBills = validBills.filter((b) => b.status === 'approved' || b.status === 'paid');
    if (protectedBills.length > 0 && !guard.authorized) {
      return NextResponse.json(
        {
          error: `Cannot bulk delete: selection includes ${protectedBills.length} approved/paid bill(s) which require admin authority`,
        },
        { status: 403 }
      );
    }

    // Record the deletion of every bill in the audit trail and
    // remove the bills inside a single transaction BEFORE touching the
    // filesystem. EditLog.billId is onDelete: SetNull, so these audit rows
    // survive the bill delete.
    const imagePaths = validBills.flatMap((b) =>
      b.images.filter((img) => img.filePath).map((img) => img.filePath)
    );

    await prisma.$transaction([
      ...validBills.map((b) =>
        prisma.editLog.create({
          data: {
            projectId,
            timestamp: new Date(),
            user: session.user.email,
            billId: b.id,
            changes: {
              _event: 'deleted',
              billNumber: b.billNumber,
              vendor: b.vendor,
              item: b.item,
              amount: Number(b.grossAmount),
            } as never,
            source: 'user',
          },
        })
      ),
      prisma.bill.deleteMany({
        where: {
          id: { in: validIds },
        },
      }),
    ]);

    // Clean up image files only after the DB transaction has committed —
    // tolerate per-file unlink errors without failing the request.
    for (const filePath of imagePaths) {
      const imgPath = path.join(UPLOADS_DIR, filePath);
      try {
        if (fs.existsSync(imgPath)) {
          fs.unlinkSync(imgPath);
        }
      } catch (e) {
        console.error('Failed to delete image file:', e);
      }
    }

    console.log('Bulk deleted', validIds.length, 'bills');

    return NextResponse.json({ ok: true, deleted: validIds.length });
  } catch (error) {
    console.error('Error bulk deleting bills:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
