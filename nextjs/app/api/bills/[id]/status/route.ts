// ============================================================================
// Bill Status API - PATCH
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db as prisma } from '@/lib/db';
import { z } from 'zod';
import { BillStatus } from '@prisma/client';

const updateStatusSchema = z.object({
  status: z.enum(['draft', 'confirmed', 'pending', 'approved', 'rejected', 'paid']),
});

// ---------------------------------------------------------------------------
// Status transition guard (Task 3)
//
// Defines which target statuses are reachable from each current status.
// 'paid' is a terminal state — no further transitions are permitted.
// This guard applies to ALL callers including admins; it is a data-integrity
// constraint, not a permissions constraint.
// ---------------------------------------------------------------------------
type AllowedStatus = 'draft' | 'confirmed' | 'pending' | 'approved' | 'rejected' | 'paid';

const ALLOWED_TRANSITIONS: Record<AllowedStatus, AllowedStatus[]> = {
  draft:     ['confirmed', 'rejected'],
  confirmed: ['pending', 'approved', 'rejected', 'draft'],
  pending:   ['approved', 'rejected', 'confirmed'],
  approved:  ['paid', 'rejected'],
  rejected:  ['confirmed'],
  paid:      [],
};

function isTransitionAllowed(current: AllowedStatus, next: AllowedStatus): boolean {
  return ALLOWED_TRANSITIONS[current].includes(next);
}

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

    const isAdmin = session.user.role === 'admin' || session.user.role === 'owner' || session.user.role === 'superadmin';

    const { id } = params;

    // Verify bill belongs to this project
    const bill = await prisma.bill.findFirst({
      where: { id, projectId },
      select: { id: true, status: true, submittedByEmail: true, billNumber: true, vendor: true },
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

    // Authorization: admin/owner/superadmin has full access;
    // bill author can only approve or revert to draft when bill is in confirmed status.
    // NOTE: The self-approval permission (author may approve their own confirmed bill)
    // is intentionally left unchanged pending product review — do not alter this block.
    if (!isAdmin) {
      const isAuthor = session.user.email === bill.submittedByEmail;
      const isSelfApprovalAllowed =
        isAuthor &&
        bill.status === 'confirmed' &&
        (status === 'approved' || status === 'draft');

      if (!isSelfApprovalAllowed) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Status transition guard — applies to all callers including admins.
    // Prevents financially invalid state transitions (e.g. paid→draft).
    if (!isTransitionAllowed(bill.status as AllowedStatus, status as AllowedStatus)) {
      return NextResponse.json({ error: 'Invalid status transition' }, { status: 422 });
    }

    // Update bill status
    await prisma.bill.update({
      where: { id },
      data: { status: status as BillStatus },
    });

    // Fire-and-forget: notify submitter on rejection
    if (status === 'rejected') {
      void Promise.resolve().then(async () => {
        try {
          const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { name: true },
          });
          const billLabel = bill.billNumber ?? bill.vendor ?? id;
          const projectName = project?.name ?? projectId;
          await prisma.notification.create({
            data: {
              userEmail: bill.submittedByEmail,
              type: 'bill_rejected',
              message: `Your bill '${billLabel}' in '${projectName}' was rejected.`,
              projectId,
            },
          });
        } catch {
          // ignore
        }
      });
    }

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
