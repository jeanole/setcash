/**
 * Large multipart uploads (BUG-25) and the middleware matcher that keeps the
 * upload endpoints out of Next.js' 10 MB middleware body buffer.
 *
 * Route handlers are called directly, so Jest cannot show the 10 MB truncation
 * itself (that happens in the Next.js server when middleware matches). The
 * matcher test pins the config that prevents it; the real-server behaviour was
 * verified against `next build` + `server.ts`.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { NextRequest } from 'next/server';
import { pathToRegexp } from 'next/dist/compiled/path-to-regexp';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { createTestContext, cleanupTestContext, makeSession, TestContext } from '../helpers';

jest.mock('@/auth');
const mockAuth = auth as jest.MockedFunction<typeof auth>;

const UPLOADS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'setcash-large-'));
process.env.UPLOADS_DIR = UPLOADS_DIR;
const billsRoute = require('@/app/api/bills/route') as typeof import('@/app/api/bills/route');
const imagesRoute = require('@/app/api/bills/[id]/images/route') as typeof import('@/app/api/bills/[id]/images/route');

const MB = 1024 * 1024;

/** A JPEG-looking file (valid magic bytes) of the given size */
function jpeg(bytes: number): Buffer {
  const buf = Buffer.alloc(bytes, 7);
  Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]).copy(buf);
  return buf;
}

async function uploadRequest(url: string, fields: Record<string, string>, photos: Buffer[]): Promise<NextRequest> {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  photos.forEach((data, i) => form.append('photos', new Blob([data], { type: 'image/jpeg' }), `receipt-${i}.jpg`));
  const encoded = new Request(url, { method: 'POST', body: form });
  const body = Buffer.from(await encoded.arrayBuffer());
  return new NextRequest(url, {
    method: 'POST',
    body,
    headers: {
      'content-type': encoded.headers.get('content-type')!,
      'content-length': String(body.byteLength),
    },
  });
}

describe('large uploads', () => {
  let ctx: TestContext;
  const memberEmails: string[] = [];

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  /** Fresh project member: the upload routes rate-limit per user */
  async function asMember() {
    const email = `large-${Math.random().toString(36).slice(2, 10)}@example.com`;
    const user = await db.user.create({ data: { email, passwordHash: 'x' } });
    await db.projectMember.create({ data: { projectId: ctx.projectId, userEmail: email, role: 'user' } });
    memberEmails.push(email);
    mockAuth.mockResolvedValue({
      user: { ...makeSession(ctx).user, id: user.id, email, role: 'user', currentProjectRole: 'user' },
    } as never);
    return email;
  }

  afterAll(async () => {
    await cleanupTestContext(ctx);
    await db.user.deleteMany({ where: { email: { in: memberEmails } } });
    fs.rmSync(UPLOADS_DIR, { recursive: true, force: true });
  });

  const bill = { date: '2026-03-01', vendor: 'Shop', brutto19: '11.90' };

  it('should create a bill from two 6 MB photos', async () => {
    await asMember();

    const res = await billsRoute.POST(await uploadRequest('http://localhost/api/bills', bill, [jpeg(6 * MB), jpeg(6 * MB)]));

    expect(res.status).toBe(200);
    const { id } = await res.json();
    expect(await db.billImage.count({ where: { billId: id } })).toBe(2);
  }, 60000);

  it('should create a bill from three 5 MB photos', async () => {
    await asMember();

    const res = await billsRoute.POST(
      await uploadRequest('http://localhost/api/bills', bill, [jpeg(5 * MB), jpeg(5 * MB), jpeg(5 * MB)])
    );

    expect(res.status).toBe(200);
    const { id } = await res.json();
    const images = await db.billImage.findMany({ where: { billId: id } });
    expect(images).toHaveLength(3);
    for (const image of images) {
      expect(fs.statSync(path.join(UPLOADS_DIR, image.filePath)).size).toBe(5 * MB);
    }
  }, 60000);

  it('should add two 6 MB photos to an existing bill', async () => {
    const email = await asMember();
    const existing = await db.bill.create({
      data: { projectId: ctx.projectId, submittedByEmail: email, date: new Date(), status: 'confirmed', vendor: 'X' },
    });

    const res = await imagesRoute.POST(
      await uploadRequest(`http://localhost/api/bills/${existing.id}/images`, {}, [jpeg(6 * MB), jpeg(6 * MB)]),
      { params: Promise.resolve({ id: existing.id }) }
    );

    expect(res.status).toBe(200);
    expect(await db.billImage.count({ where: { billId: existing.id } })).toBe(2);
  }, 60000);
});

describe('middleware matcher', () => {
  // The config is read from the source: importing middleware.ts would start NextAuth
  const source = fs.readFileSync(path.join(__dirname, '..', '..', 'middleware.ts'), 'utf8');
  const literal = source.match(/^\s*'(\/\(\(\?!.*)',\s*$/m)?.[1];
  const matcher = pathToRegexp(literal!.replace(/\\\\/g, '\\'));
  const runsMiddleware = (pathname: string) => matcher.test(pathname);

  it('should find the matcher in middleware.ts', () => {
    expect(literal).toBeDefined();
  });

  it.each([
    '/api/bills',
    '/api/bills/ckabc123/images',
    '/api/bills/ckabc123/images/ckimg456',
    '/api/bug-reports',
  ])('should keep the upload endpoint %s out of middleware (no 10 MB body buffering)', (pathname) => {
    expect(runsMiddleware(pathname)).toBe(false);
  });

  it.each([
    '/',
    '/dashboard',
    '/bills',
    '/bills/new',
    '/bills/ckabc123',
    '/api/bills/ckabc123',
    '/api/bills/ckabc123/status',
    '/api/bills/ckabc123/images/reorder',
    '/api/bills/bulk-delete',
    '/api/bug-reports/screenshots/abc',
    '/api/billsx',
    '/api/projects',
  ])('should still run middleware for %s', (pathname) => {
    expect(runsMiddleware(pathname)).toBe(true);
  });
});
