// ============================================================================
// POST /api/analytics/event — Log a page event (public, no auth required)
// Tracks: cta_click, scroll_depth, time_on_page, page_view
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db as prisma } from '@/lib/db';
import { visitLogLimiter } from '@/lib/ratelimit';
import { classifyUA, getCountryCode, getClientIp } from '@/lib/analytics';

const EVENT_TYPES = ['cta_click', 'scroll_depth', 'time_on_page', 'page_view'] as const;

const eventSchema = z.object({
  path:            z.string().max(200).optional().default('/'),
  eventType:       z.enum(EVENT_TYPES),
  eventLabel:      z.string().max(200).optional().nullable(),
  isAuthenticated: z.boolean().optional().default(false),
  sessionId:       z.string().min(1).max(64).optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = await visitLogLimiter.limit(`event:${ip}`);
    if (!rl.success) {
      return new NextResponse(null, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = eventSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }

    const { path, eventType, eventLabel, isAuthenticated, sessionId } = parsed.data;
    const countryCode = getCountryCode(req);
    const userAgent = req.headers.get('user-agent');
    const deviceType = classifyUA(userAgent);

    await prisma.pageEvent.create({
      data: {
        countryCode,
        deviceType,
        path,
        eventType,
        eventLabel: eventLabel ?? null,
        isAuthenticated,
        sessionId: sessionId ?? null,
      },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('[analytics/event] Error logging event:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
