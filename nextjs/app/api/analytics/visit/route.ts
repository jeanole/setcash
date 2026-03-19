// ============================================================================
// POST /api/analytics/visit — Log a landing page visit (public, no auth)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db as prisma } from '@/lib/db';
import { visitLogLimiter } from '@/lib/ratelimit';
import { classifyUA, getCountryCode, getClientIp, parseBrowser, parseOS } from '@/lib/analytics';

const visitSchema = z.object({
  path:         z.string().max(200).optional().default('/'),
  referrer:     z.string().max(500).optional().nullable(),
  utmSource:    z.string().max(100).optional().nullable(),
  utmMedium:    z.string().max(100).optional().nullable(),
  utmCampaign:  z.string().max(100).optional().nullable(),
  screenWidth:  z.number().int().min(0).max(10000).optional().nullable(),
  screenHeight: z.number().int().min(0).max(10000).optional().nullable(),
  language:     z.string().max(20).optional().nullable(),
  sessionId:    z.string().min(1).max(64).optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    // Rate limit by IP
    const ip = getClientIp(req);
    const rl = await visitLogLimiter.limit(ip);
    if (!rl.success) {
      return new NextResponse(null, { status: 429 });
    }

    // Validate input
    const body = await req.json().catch(() => ({}));
    const parsed = visitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }

    const { path, referrer, utmSource, utmMedium, utmCampaign, screenWidth, screenHeight, language, sessionId } = parsed.data;
    const countryCode = getCountryCode(req);
    const userAgent = req.headers.get('user-agent');
    const deviceType = classifyUA(userAgent);
    const browser = parseBrowser(userAgent);
    const os = parseOS(userAgent);

    await prisma.visitLog.create({
      data: {
        countryCode,
        deviceType,
        path,
        referrer:     referrer ?? null,
        utmSource:    utmSource ?? null,
        utmMedium:    utmMedium ?? null,
        utmCampaign:  utmCampaign ?? null,
        browser:      browser ?? null,
        os:           os ?? null,
        screenWidth:  screenWidth ?? null,
        screenHeight: screenHeight ?? null,
        language:     language ?? null,
        sessionId:    sessionId ?? null,
      },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('[analytics/visit] Error logging visit:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
