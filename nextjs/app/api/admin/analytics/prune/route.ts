// ============================================================================
// DELETE /api/admin/analytics/prune — Prune old analytics records (superadmin)
// ============================================================================

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db as prisma } from '@/lib/db';

const DEFAULT_RETENTION_DAYS = 90;
const MIN_RETENTION_DAYS = 30;

function getRetentionDays(): number {
  const raw = parseInt(process.env.ANALYTICS_RETENTION_DAYS ?? '', 10);
  const days = Number.isFinite(raw) ? raw : DEFAULT_RETENTION_DAYS;
  return Math.max(days, MIN_RETENTION_DAYS);
}

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

    const retentionDays = getRetentionDays();
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    const [visitResult, demoResult, eventResult] = await prisma.$transaction([
      prisma.visitLog.deleteMany({
        where: { timestamp: { lt: cutoff } },
      }),
      prisma.demoLoginAttempt.deleteMany({
        where: { timestamp: { lt: cutoff } },
      }),
      prisma.pageEvent.deleteMany({
        where: { timestamp: { lt: cutoff } },
      }),
    ]);

    return NextResponse.json({
      visits: visitResult.count,
      demoLogins: demoResult.count,
      events: eventResult.count,
    });
  } catch (error) {
    console.error('[admin/analytics/prune] Error pruning analytics:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
