// ============================================================================
// V-Geld Analysis API - GET /api/vgeld/analysis
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db as prisma } from '@/lib/db';
import { SPENDING_BILL_STATUSES } from '@/lib/spending';

// GET /api/vgeld/analysis - User summary with received/spent/remaining/%used
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

    // Aggregate V-Geld received per user — only confirmed transfers count
    // (confirmedBy not null). Unconfirmed transfers are excluded.
    const vgeldGroups = await prisma.vgeld.groupBy({
      by: ['toUser'],
      where: { projectId, confirmedBy: { not: null } },
      _sum: { amount: true },
    });

    // Aggregate real-spending bills per user (confirmed + approved + paid).
    // total brutto = brutto19 + brutto7 + brutto0
    const confirmedBills = await prisma.bill.findMany({
      where: { projectId, status: { in: SPENDING_BILL_STATUSES as any } },
      select: { submittedByEmail: true, brutto19: true, brutto7: true, brutto0: true },
    });

    // Build maps for quick lookup
    const receivedMap = new Map<string, number>(
      vgeldGroups.map((g) => [g.toUser, Number(g._sum.amount ?? 0)])
    );
    const spentMap = new Map<string, number>();
    for (const bill of confirmedBills) {
      const brutto = Number(bill.brutto19) + Number(bill.brutto7) + Number(bill.brutto0);
      spentMap.set(bill.submittedByEmail, (spentMap.get(bill.submittedByEmail) ?? 0) + brutto);
    }

    // Collect all users who appear in either set
    const allUsers = new Set<string>([
      ...receivedMap.keys(),
      ...spentMap.keys(),
    ]);

    const analysis = Array.from(allUsers).map((user) => {
      const received = receivedMap.get(user) ?? 0;
      const spent = spentMap.get(user) ?? 0;
      const remaining = received - spent;
      const percentUsed = received > 0 ? (spent / received) * 100 : 0;
      return { user, received, spent, remaining, percentUsed };
    });

    // Sort by user email for consistent ordering
    analysis.sort((a, b) => a.user.localeCompare(b.user));

    return NextResponse.json(analysis);
  } catch (error) {
    console.error('Error fetching V-Geld analysis:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
