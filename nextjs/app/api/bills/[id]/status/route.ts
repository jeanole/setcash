// ============================================================================
// Bill Status API - PATCH
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db as prisma } from '@/lib/db';
import { z } from 'zod';
import { BillStatus } from '@prisma/client';

const updateStatusSchema = z.object({
  status: z.enum(['confirmed', 'pending', 'approved', 'rejected', 'paid']),
});

// PATCH /api/bills/[id]/status - Update status (approve/reject/paid)
export async function PATCH(
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

    // Check admin permission for status changes
    if (session.user.role !== 'admin' && session.user.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden - admin only' }, { status: 403 });
    }

    const { id } = params;

    // Verify bill belongs to this project
    const bill = await prisma.bill.findFirst({
      where: { id, projectId },
      select: { id: true, status: true },
    });

    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    const body = await req.json();
    const validation = updateStatusSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      );
    }

    const { status } = validation.data;

    // Update bill status
    await prisma.bill.update({
      where: { id },
      data: { status: status as BillStatus },
    });

    // Log the status change
    await prisma.editLog.create({
      data: {
        projectId,
        timestamp: new Date(),
        user: session.user.email,
        billId: id,
        changes: { status },
        source: 'user',
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error updating bill status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
