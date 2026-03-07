// ============================================================================
// V-Geld Analysis API - GET /api/vgeld/analysis
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db as prisma } from '@/lib/db';

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

    // Aggregate V-Geld received per user
    const vgeldGroups = await prisma.vgeld.groupBy({
      by: ['toUser'],
      where: { projectId },
      _sum: { amount: true },
    });

    // Aggregate confirmed bill spending per user
    const billGroups = await prisma.bill.groupBy({
      by: ['submittedByEmail'],
      where: { projectId, status: 'confirmed' },
      _sum: { nettoAmount: true },
    });

    // Build maps for quick lookup
    const receivedMap = new Map<string, number>(
      vgeldGroups.map((g) => [g.toUser, Number(g._sum.amount ?? 0)])
    );
    const spentMap = new Map<string, number>(
      billGroups.map((g) => [g.submittedByEmail, Number(g._sum.nettoAmount ?? 0)])
    );

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
