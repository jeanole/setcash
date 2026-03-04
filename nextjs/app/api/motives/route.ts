// ============================================================================
// Motives API - GET
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db as prisma } from '@/lib/db';

// GET /api/motives - List motives for current project
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

    // Verify project access
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

    const motives = await prisma.motive.findMany({
      where: { projectId },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        name: true,
        budget: true,
      },
    });

    const mapped = motives.map((m) => ({
      id: m.id,
      name: m.name,
      budget: Number(m.budget),
    }));

    return NextResponse.json(mapped);
  } catch (error) {
    console.error('Error fetching motives:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
