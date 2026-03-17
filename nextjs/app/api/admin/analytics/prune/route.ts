// ============================================================================
// DELETE /api/admin/analytics/prune — Prune old analytics records (superadmin)
// ============================================================================

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db as prisma } from '@/lib/db';

const RETENTION_DAYS = 90;

export async function DELETE() {
  try {
    // Auth — superadmin only
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.user.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

    const [visitResult, demoResult] = await prisma.$transaction([
      prisma.visitLog.deleteMany({
        where: { timestamp: { lt: cutoff } },
      }),
      prisma.demoLoginAttempt.deleteMany({
        where: { timestamp: { lt: cutoff } },
      }),
    ]);

    return NextResponse.json({
      visits: visitResult.count,
      demoLogins: demoResult.count,
    });
  } catch (error) {
    console.error('[admin/analytics/prune] Error pruning analytics:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
