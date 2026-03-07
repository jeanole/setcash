// ============================================================================
// V-Geld Balance API - GET /api/vgeld/balance
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db as prisma } from '@/lib/db';

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

    // Sum all V-Geld received by current user in this project
    const receivedResult = await prisma.vgeld.aggregate({
      where: { projectId, toUser: currentUser },
      _sum: { amount: true },
    });

    // Sum all confirmed bill spending by current user in this project
    const spentResult = await prisma.bill.aggregate({
      where: {
        projectId,
        submittedByEmail: currentUser,
        status: 'confirmed',
      },
      _sum: { nettoAmount: true },
    });

    const received = Number(receivedResult._sum.amount ?? 0);
    const spent = Number(spentResult._sum.nettoAmount ?? 0);
    const balance = received - spent;

    return NextResponse.json({ balance });
  } catch (error) {
    console.error('Error fetching V-Geld balance:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
