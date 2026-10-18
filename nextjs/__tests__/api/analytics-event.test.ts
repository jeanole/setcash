/**
 * POST /api/analytics/event uses its own per-IP bucket (BUG-23, real DB).
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';

/* eslint-disable @typescript-eslint/no-require-imports */
const eventRoute = require('@/app/api/analytics/event/route') as typeof import('@/app/api/analytics/event/route');
const visitRoute = require('@/app/api/analytics/visit/route') as typeof import('@/app/api/analytics/visit/route');
/* eslint-enable @typescript-eslint/no-require-imports */

const PATH = `/test-analytics-${Math.random().toString(36).slice(2, 8)}`;

function eventReq(ip: string): NextRequest {
  return new NextRequest('http://localhost/api/analytics/event', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip },
    body: JSON.stringify({ path: PATH, eventType: 'page_view' }),
  });
}

function visitReq(ip: string): NextRequest {
  return new NextRequest('http://localhost/api/analytics/visit', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip },
    body: JSON.stringify({ path: PATH }),
  });
}

describe('POST /api/analytics/event rate limiting', () => {
  afterAll(async () => {
    await db.pageEvent.deleteMany({ where: { path: PATH } });
    await db.visitLog.deleteMany({ where: { path: PATH } });
  });

  it('should accept more than the 30/min visit budget from one IP', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 40; i++) {
      statuses.push((await eventRoute.POST(eventReq('198.51.100.10'))).status);
    }

    expect(statuses.every((s) => s === 204)).toBe(true);
  });

  it('should not let events exhaust the visit-log budget of the same IP', async () => {
    for (let i = 0; i < 40; i++) await eventRoute.POST(eventReq('198.51.100.11'));

    const res = await visitRoute.POST(visitReq('198.51.100.11'));

    expect(res.status).not.toBe(429);
  });

  it('should return 429 once the per-IP event budget of 120/min is used up', async () => {
    let last = 0;
    for (let i = 0; i < 121; i++) {
      last = (await eventRoute.POST(eventReq('198.51.100.12'))).status;
    }

    expect(last).toBe(429);
  });
});
