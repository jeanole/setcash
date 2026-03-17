// ============================================================================
// GET /api/admin/analytics — Analytics dashboard data (superadmin only)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { db as prisma } from '@/lib/db';

const querySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => parseInt(v ?? '1', 10))
    .pipe(z.number().int().min(1)),
  pageSize: z
    .string()
    .optional()
    .transform((v) => parseInt(v ?? '25', 10))
    .pipe(z.number().int().min(1).max(100)),
});

export async function GET(req: NextRequest) {
  try {
    // Auth — superadmin only
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.user.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse + validate query params
    const { searchParams } = req.nextUrl;
    const parsed = querySchema.safeParse({
      page: searchParams.get('page') ?? undefined,
      pageSize: searchParams.get('pageSize') ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid query parameters.' }, { status: 400 });
    }

    const { page, pageSize } = parsed.data;
    const skip = (page - 1) * pageSize;

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Compute KPIs in parallel
    const [
      totalVisits,
      visitsLast7Days,
      demoLoginsLast7Days,
      demoSuccessLast7Days,
      dailyVisitsRaw,
      demoLogItems,
      demoLogTotal,
    ] = await Promise.all([
      // Total visits (all time)
      prisma.visitLog.count(),

      // Visits in last 7 days
      prisma.visitLog.count({
        where: { timestamp: { gte: sevenDaysAgo } },
      }),

      // Demo logins in last 7 days
      prisma.demoLoginAttempt.count({
        where: { timestamp: { gte: sevenDaysAgo } },
      }),

      // Successful demo logins in last 7 days (for success rate)
      prisma.demoLoginAttempt.count({
        where: { timestamp: { gte: sevenDaysAgo }, loginSuccess: true },
      }),

      // Daily visit aggregates (last 30 days) — raw SQL for date truncation
      prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
        SELECT
          TO_CHAR(DATE_TRUNC('day', "timestamp"), 'YYYY-MM-DD') AS date,
          COUNT(*)::bigint AS count
        FROM "VisitLog"
        WHERE "timestamp" >= ${thirtyDaysAgo}
        GROUP BY DATE_TRUNC('day', "timestamp")
        ORDER BY DATE_TRUNC('day', "timestamp") ASC
      `,

      // Demo login log (paginated, newest first)
      prisma.demoLoginAttempt.findMany({
        orderBy: { timestamp: 'desc' },
        take: pageSize,
        skip,
        select: {
          id: true,
          timestamp: true,
          countryCode: true,
          turnstileSuccess: true,
          loginSuccess: true,
        },
      }),

      // Total count for pagination
      prisma.demoLoginAttempt.count(),
    ]);

    const demoSuccessRate =
      demoLoginsLast7Days > 0
        ? Math.round((demoSuccessLast7Days / demoLoginsLast7Days) * 100)
        : 0;

    const dailyVisits = dailyVisitsRaw.map((row) => ({
      date: row.date,
      count: Number(row.count),
    }));

    return NextResponse.json({
      kpi: {
        totalVisits,
        visitsLast7Days,
        demoLoginsLast7Days,
        demoSuccessRate,
      },
      dailyVisits,
      demoLog: {
        items: demoLogItems,
        total: demoLogTotal,
        page,
        pageSize,
      },
    });
  } catch (error) {
    console.error('[admin/analytics] Error fetching analytics:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
