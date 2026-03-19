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

    // Compute all data in parallel
    const [
      totalVisits,
      visitsLast7Days,
      uniqueSessionsLast7Days,
      demoLoginsLast7Days,
      demoSuccessLast7Days,
      dailyVisitsRaw,
      demoLogItems,
      demoLogTotal,
      referrerBreakdownRaw,
      utmSourceBreakdownRaw,
      ctaClicksRaw,
      scrollDepthRaw,
      topPagesRaw,
      browserBreakdownRaw,
      osBreakdownRaw,
      deviceBreakdownRaw,
      countryBreakdownRaw,
      languageBreakdownRaw,
      screenBreakdownRaw,
    ] = await Promise.all([
      // Total visits (all time)
      prisma.visitLog.count(),

      // Visits in last 7 days
      prisma.visitLog.count({
        where: { timestamp: { gte: sevenDaysAgo } },
      }),

      // Unique sessions in last 7 days
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(DISTINCT "sessionId")::bigint AS count
        FROM "VisitLog"
        WHERE "timestamp" >= ${sevenDaysAgo}
          AND "sessionId" IS NOT NULL
      `,

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

      // Top referrers (last 30 days, non-null, top 10)
      prisma.$queryRaw<Array<{ referrer: string; count: bigint }>>`
        SELECT "referrer", COUNT(*)::bigint AS count
        FROM "VisitLog"
        WHERE "timestamp" >= ${thirtyDaysAgo}
          AND "referrer" IS NOT NULL
        GROUP BY "referrer"
        ORDER BY count DESC
        LIMIT 10
      `,

      // UTM source breakdown (last 30 days, non-null, top 10)
      prisma.$queryRaw<Array<{ utmSource: string; count: bigint }>>`
        SELECT "utmSource", COUNT(*)::bigint AS count
        FROM "VisitLog"
        WHERE "timestamp" >= ${thirtyDaysAgo}
          AND "utmSource" IS NOT NULL
        GROUP BY "utmSource"
        ORDER BY count DESC
        LIMIT 10
      `,

      // CTA clicks (last 30 days, grouped by label)
      prisma.$queryRaw<Array<{ eventLabel: string | null; count: bigint }>>`
        SELECT "eventLabel", COUNT(*)::bigint AS count
        FROM "PageEvent"
        WHERE "timestamp" >= ${thirtyDaysAgo}
          AND "eventType" = 'cta_click'
        GROUP BY "eventLabel"
        ORDER BY count DESC
        LIMIT 20
      `,

      // Scroll depth distribution (last 30 days)
      prisma.$queryRaw<Array<{ eventLabel: string | null; count: bigint }>>`
        SELECT "eventLabel", COUNT(*)::bigint AS count
        FROM "PageEvent"
        WHERE "timestamp" >= ${thirtyDaysAgo}
          AND "eventType" = 'scroll_depth'
        GROUP BY "eventLabel"
        ORDER BY "eventLabel" ASC
      `,

      // Top authenticated pages (last 30 days, page_view events)
      prisma.$queryRaw<Array<{ path: string; count: bigint }>>`
        SELECT "path", COUNT(*)::bigint AS count
        FROM "PageEvent"
        WHERE "timestamp" >= ${thirtyDaysAgo}
          AND "eventType" = 'page_view'
          AND "isAuthenticated" = true
        GROUP BY "path"
        ORDER BY count DESC
        LIMIT 15
      `,

      // Browser breakdown (last 30 days)
      prisma.$queryRaw<Array<{ browser: string; count: bigint }>>`
        SELECT "browser", COUNT(*)::bigint AS count
        FROM "VisitLog"
        WHERE "timestamp" >= ${thirtyDaysAgo}
          AND "browser" IS NOT NULL
        GROUP BY "browser"
        ORDER BY count DESC
        LIMIT 10
      `,

      // OS breakdown (last 30 days)
      prisma.$queryRaw<Array<{ os: string; count: bigint }>>`
        SELECT "os", COUNT(*)::bigint AS count
        FROM "VisitLog"
        WHERE "timestamp" >= ${thirtyDaysAgo}
          AND "os" IS NOT NULL
        GROUP BY "os"
        ORDER BY count DESC
        LIMIT 10
      `,

      // Device type breakdown (last 30 days)
      prisma.$queryRaw<Array<{ deviceType: string; count: bigint }>>`
        SELECT "deviceType", COUNT(*)::bigint AS count
        FROM "VisitLog"
        WHERE "timestamp" >= ${thirtyDaysAgo}
        GROUP BY "deviceType"
        ORDER BY count DESC
      `,

      // Country breakdown (last 30 days)
      prisma.$queryRaw<Array<{ countryCode: string; count: bigint }>>`
        SELECT "countryCode", COUNT(*)::bigint AS count
        FROM "VisitLog"
        WHERE "timestamp" >= ${thirtyDaysAgo}
          AND "countryCode" IS NOT NULL
        GROUP BY "countryCode"
        ORDER BY count DESC
        LIMIT 15
      `,

      // Language breakdown (last 30 days)
      prisma.$queryRaw<Array<{ language: string; count: bigint }>>`
        SELECT "language", COUNT(*)::bigint AS count
        FROM "VisitLog"
        WHERE "timestamp" >= ${thirtyDaysAgo}
          AND "language" IS NOT NULL
        GROUP BY "language"
        ORDER BY count DESC
        LIMIT 10
      `,

      // Screen resolution breakdown (last 30 days)
      prisma.$queryRaw<Array<{ resolution: string; count: bigint }>>`
        SELECT ("screenWidth" || 'x' || "screenHeight") AS resolution, COUNT(*)::bigint AS count
        FROM "VisitLog"
        WHERE "timestamp" >= ${thirtyDaysAgo}
          AND "screenWidth" IS NOT NULL
          AND "screenHeight" IS NOT NULL
        GROUP BY "screenWidth", "screenHeight"
        ORDER BY count DESC
        LIMIT 10
      `,
    ]);

    const demoSuccessRate =
      demoLoginsLast7Days > 0
        ? Math.round((demoSuccessLast7Days / demoLoginsLast7Days) * 100)
        : 0;

    const uniqueSessions = Number(uniqueSessionsLast7Days[0]?.count ?? 0);

    const dailyVisits = dailyVisitsRaw.map((row) => ({
      date: row.date,
      count: Number(row.count),
    }));

    const referrerBreakdown = referrerBreakdownRaw.map((row) => ({
      referrer: row.referrer,
      count: Number(row.count),
    }));

    const utmSourceBreakdown = utmSourceBreakdownRaw.map((row) => ({
      utmSource: row.utmSource,
      count: Number(row.count),
    }));

    const ctaClicks = ctaClicksRaw.map((row) => ({
      label: row.eventLabel ?? '(unlabelled)',
      count: Number(row.count),
    }));

    const scrollDepth = scrollDepthRaw.map((row) => ({
      milestone: row.eventLabel ?? '?',
      count: Number(row.count),
    }));

    const topPages = topPagesRaw.map((row) => ({
      path: row.path,
      count: Number(row.count),
    }));

    const browsers = browserBreakdownRaw.map((row) => ({
      label: row.browser,
      count: Number(row.count),
    }));

    const operatingSystems = osBreakdownRaw.map((row) => ({
      label: row.os,
      count: Number(row.count),
    }));

    const devices = deviceBreakdownRaw.map((row) => ({
      label: row.deviceType,
      count: Number(row.count),
    }));

    const countries = countryBreakdownRaw.map((row) => ({
      label: row.countryCode,
      count: Number(row.count),
    }));

    const languages = languageBreakdownRaw.map((row) => ({
      label: row.language,
      count: Number(row.count),
    }));

    const screens = screenBreakdownRaw.map((row) => ({
      label: row.resolution,
      count: Number(row.count),
    }));

    return NextResponse.json({
      kpi: {
        totalVisits,
        visitsLast7Days,
        uniqueSessions,
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
      trafficSources: {
        referrers: referrerBreakdown,
        utmSources: utmSourceBreakdown,
      },
      events: {
        ctaClicks,
        scrollDepth,
        topPages,
      },
      visitors: {
        browsers,
        operatingSystems,
        devices,
        countries,
        languages,
        screens,
      },
    });
  } catch (error) {
    console.error('[admin/analytics] Error fetching analytics:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
