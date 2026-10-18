// ============================================================================
// V-Geld Balance API - GET /api/vgeld/balance
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db as prisma } from '@/lib/db';
import { getVgeldBalance } from '@/lib/vgeld';

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

    const balance = await getVgeldBalance(projectId, session.user.email);

    return NextResponse.json({ balance });
  } catch (error) {
    console.error('Error fetching V-Geld balance:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
