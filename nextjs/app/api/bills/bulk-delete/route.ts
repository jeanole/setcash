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

const bulkDeleteSchema = z.object({
  ids: z.array(z.string()).min(1),
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

    // Check admin permission
    if (session.user.role !== 'admin' && session.user.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden - admin only' }, { status: 403 });
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

    // Clean up image files
    for (const bill of validBills) {
      for (const img of bill.images) {
        if (img.filePath) {
          const imgPath = path.join(UPLOADS_DIR, img.filePath);
          if (fs.existsSync(imgPath)) {
            try {
              fs.unlinkSync(imgPath);
            } catch (e) {
              console.error('Failed to delete image file:', e);
            }
          }
        }
      }
    }

    // Delete bills (cascades to related records)
    const result = await prisma.bill.deleteMany({
      where: {
        id: { in: validIds },
      },
    });

    console.log('Bulk deleted', result.count, 'bills');

    return NextResponse.json({ ok: true, deleted: result.count });
  } catch (error) {
    console.error('Error bulk deleting bills:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
