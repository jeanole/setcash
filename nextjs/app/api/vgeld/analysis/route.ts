// ============================================================================
// V-Geld Analysis API - GET /api/vgeld/analysis
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db as prisma } from '@/lib/db';
import { getVgeldAnalysis } from '@/lib/vgeld';

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

    // Per-user balances of the whole project are admin-only. Authority is read
    // from the database rather than trusting JWT claims. A plain 403 is returned
    // (no forced re-auth) since a regular member is a legitimate caller here.
    const [user, membership] = await Promise.all([
      prisma.user.findUnique({
        where: { email: session.user.email },
        select: { isSuperAdmin: true },
      }),
      prisma.projectMember.findUnique({
        where: {
          projectId_userEmail: {
            projectId,
            userEmail: session.user.email,
          },
        },
        select: { role: true },
      }),
    ]);

    const isAdmin = membership?.role === 'admin' || membership?.role === 'owner';

    if (!user?.isSuperAdmin && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 });
    }

    // Confirmed transfers vs. real-spending bills, aggregated in the database
    const analysis = await getVgeldAnalysis(projectId);

    return NextResponse.json(analysis);
  } catch (error) {
    console.error('Error fetching V-Geld analysis:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
