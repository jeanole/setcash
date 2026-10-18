/**
 * GET /api/ocr-log pagination parameter validation (BUG-15, real DB).
 */

import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { createTestContext, cleanupTestContext, makeSession, TestContext } from '../helpers';

jest.mock('@/auth');
const mockAuth = auth as jest.MockedFunction<typeof auth>;

/* eslint-disable @typescript-eslint/no-require-imports */
const route = require('@/app/api/ocr-log/route') as typeof import('@/app/api/ocr-log/route');
/* eslint-enable @typescript-eslint/no-require-imports */

const get = (query: string) => route.GET(new NextRequest(`http://localhost/api/ocr-log${query}`));

describe('GET /api/ocr-log', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
    await db.ocrLog.create({ data: { projectId: ctx.projectId, provider: 'test', status: 'done' } });
  });

  beforeEach(() => {
    mockAuth.mockResolvedValue(makeSession(ctx, 'admin') as never);
  });

  afterAll(async () => {
    await db.ocrLog.deleteMany({ where: { projectId: ctx.projectId } });
    await cleanupTestContext(ctx);
  });

  it('should return 400 for non-numeric page and limit', async () => {
    const res = await get('?page=abc&limit=xyz');

    expect(res.status).toBe(400);
  });

  it.each(['?page=0', '?page=-1', '?page=1.5', '?limit=0', '?limit=101', '?page=1e21', '?limit=NaN'])(
    'should return 400 for %s',
    async (query) => {
      const res = await get(query);

      expect(res.status).toBe(400);
    }
  );

  it('should apply defaults when the parameters are missing or empty', async () => {
    const res = await get('?page=&limit=');
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ page: 1, limit: 20, total: 1 });
  });

  it('should accept valid values', async () => {
    const res = await get('?page=1&limit=100');
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.logs).toHaveLength(1);
  });
});
