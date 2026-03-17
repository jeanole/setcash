// ============================================================================
// POST /api/analytics/visit — Log a landing page visit (public, no auth)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db as prisma } from '@/lib/db';
import { visitLogLimiter } from '@/lib/ratelimit';
import { classifyUA, getCountryCode, getClientIp } from '@/lib/analytics';

const visitSchema = z.object({
  path: z.string().max(200).optional().default('/'),
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

    const { path } = parsed.data;
    const countryCode = getCountryCode(req);
    const userAgent = req.headers.get('user-agent');
    const deviceType = classifyUA(userAgent);

    await prisma.visitLog.create({
      data: {
        countryCode,
        deviceType,
        path,
      },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('[analytics/visit] Error logging visit:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
