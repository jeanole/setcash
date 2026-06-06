// ============================================================================
// V-Geld Balance API - GET /api/vgeld/balance
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db as prisma } from '@/lib/db';
import { SPENDING_BILL_STATUSES } from '@/lib/spending';

// GET /api/vgeld/balance - Current user's V-Geld balance
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = session.user.currentProjectId;
    if (!projectId) {
      return NextResponse.json({ error: 'No project selected' }, { status: 400 });
    }

    // Verify project membership
    const membership = await prisma.projectMember.findUnique({
      where: {
        projectId_userEmail: {
          projectId,
          userEmail: session.user.email,
        },
      },
    });

    if (!membership && session.user.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const currentUser = session.user.email;

    // Sum all confirmed V-Geld received by current user in this project.
    // Only count transfers where confirmedBy is set — unconfirmed transfers
    // do not count as received funds.
    const receivedResult = await prisma.vgeld.aggregate({
      where: { projectId, toUser: currentUser, confirmedBy: { not: null } },
      _sum: { amount: true },
    });

    // Sum real-spending bills by current user (confirmed + approved + paid).
    // total brutto = brutto19 + brutto7 + brutto0
    const confirmedBills = await prisma.bill.findMany({
      where: {
        projectId,
        submittedByEmail: currentUser,
        status: { in: SPENDING_BILL_STATUSES as any },
      },
      select: { brutto19: true, brutto7: true, brutto0: true },
    });

    const received = Number(receivedResult._sum.amount ?? 0);
    const spent = confirmedBills.reduce(
      (sum, b) => sum + Number(b.brutto19) + Number(b.brutto7) + Number(b.brutto0),
      0
    );
    const balance = received - spent;

    return NextResponse.json({ balance });
  } catch (error) {
    console.error('Error fetching V-Geld balance:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
