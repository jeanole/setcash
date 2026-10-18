/**
 * Integration tests for bill creation, status changes and OCR flag
 * verification (real DB, mocked session).
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { createTestContext, cleanupTestContext, makeSession, TestContext } from '../helpers';

jest.mock('@/auth');
const mockAuth = auth as jest.MockedFunction<typeof auth>;

// Uploads go to a throwaway directory; UPLOADS_DIR is read at module load,
// so the route modules are required after setting it.
const UPLOADS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'setcash-uploads-'));
process.env.UPLOADS_DIR = UPLOADS_DIR;
/* eslint-disable @typescript-eslint/no-require-imports */
const billsRoute = require('@/app/api/bills/route') as typeof import('@/app/api/bills/route');
const billRoute = require('@/app/api/bills/[id]/route') as typeof import('@/app/api/bills/[id]/route');
const statusRoute = require('@/app/api/bills/[id]/status/route') as typeof import('@/app/api/bills/[id]/status/route');
const verifyRoute = require('@/app/api/bills/[id]/verify-field/route') as typeof import('@/app/api/bills/[id]/verify-field/route');
/* eslint-enable @typescript-eslint/no-require-imports */

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);

async function multipartRequest(
  fields: Record<string, string>,
  photo = false,
  contentLength?: string | null
): Promise<NextRequest> {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  if (photo) form.append('photos', new Blob([JPEG], { type: 'image/jpeg' }), 'receipt.jpg');

  // Serialise so the request carries a Content-Length like a browser upload
  // (null = omit it, as with a chunked body forwarded by a proxy)
  const encoded = new Request('http://localhost/api/bills', { method: 'POST', body: form });
  const body = Buffer.from(await encoded.arrayBuffer());
  const headers: Record<string, string> = { 'content-type': encoded.headers.get('content-type')! };
  if (contentLength !== null) headers['content-length'] = contentLength ?? String(body.byteLength);
  return new NextRequest('http://localhost/api/bills', { method: 'POST', body, headers });
}

function jsonReq(url: string, method: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const validBill = { date: '2026-03-01', vendor: 'Shop', brutto19: '11.90' };

describe('bills API', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  beforeEach(() => {
    mockAuth.mockResolvedValue(makeSession(ctx, 'admin') as never);
  });

  afterAll(async () => {
    await cleanupTestContext(ctx);
    fs.rmSync(UPLOADS_DIR, { recursive: true, force: true });
  });

  describe('POST /api/bills', () => {
    it('should reject negative amounts', async () => {
      const res = await billsRoute.POST(await multipartRequest({ ...validBill, brutto19: '-1000' }));

      expect(res.status).toBe(400);
    });

    it('should reject allocations that only sum to 100 by using a negative share', async () => {
      const [a, b] = await Promise.all([
        db.motive.create({ data: { projectId: ctx.projectId, name: 'M1' } }),
        db.motive.create({ data: { projectId: ctx.projectId, name: 'M2' } }),
      ]);
      const res = await billsRoute.POST(await multipartRequest({
        ...validBill,
        motiveAllocations: JSON.stringify([{ id: a.id, percentage: 150 }, { id: b.id, percentage: -50 }]),
      }));

      expect(res.status).toBe(400);
    });

    it('should return 400 for an invalid date instead of failing', async () => {
      const res = await billsRoute.POST(await multipartRequest({ ...validBill, date: 'not-a-date' }));

      expect(res.status).toBe(400);
    });

    it('should accept an upload without Content-Length (chunked)', async () => {
      const res = await billsRoute.POST(await multipartRequest(validBill, true, null));

      expect(res.status).toBe(200);
    });

    it('should reject a body declared larger than the upload cap', async () => {
      const res = await billsRoute.POST(await multipartRequest(validBill, true, String(500 * 1024 * 1024)));

      expect(res.status).toBe(413);
    });

    it('should store each upload under a unique path', async () => {
      const first = await (await billsRoute.POST(await multipartRequest(validBill, true))).json();
      const second = await (await billsRoute.POST(await multipartRequest(validBill, true))).json();

      const images = await db.billImage.findMany({
        where: { billId: { in: [first.id, second.id] } },
        select: { filePath: true },
      });
      expect(images).toHaveLength(2);
      expect(images[0].filePath).not.toBe(images[1].filePath);
      for (const img of images) {
        expect(fs.existsSync(path.join(UPLOADS_DIR, img.filePath))).toBe(true);
      }
    });

    it('should not reuse a bill number after a bill is deleted', async () => {
      const created = await db.bill.findMany({
        where: { projectId: ctx.projectId },
        orderBy: { createdAt: 'asc' },
        select: { id: true, billNumber: true },
      });
      const highest = created[created.length - 1].billNumber;
      await db.bill.delete({ where: { id: created[0].id } });

      const res = await billsRoute.POST(await multipartRequest(validBill));
      const { id } = await res.json();
      const bill = await db.bill.findUniqueOrThrow({ where: { id } });

      expect(bill.billNumber).not.toBe(highest);
      expect(created.map((b) => b.billNumber)).not.toContain(bill.billNumber);
    });
  });

  describe('PATCH /api/bills/[id]/status', () => {
    it('should approve a confirmed bill and keep paid bills terminal', async () => {
      const bill = await db.bill.create({
        data: { projectId: ctx.projectId, submittedByEmail: ctx.userEmail, date: new Date(), status: 'confirmed', vendor: 'X', brutto19: 5 },
      });
      const params = { params: { id: bill.id } };
      const url = `http://localhost/api/bills/${bill.id}/status`;

      expect((await statusRoute.PATCH(jsonReq(url, 'PATCH', { status: 'approved' }), params)).status).toBe(200);
      expect((await statusRoute.PATCH(jsonReq(url, 'PATCH', { status: 'paid' }), params)).status).toBe(200);
      expect((await statusRoute.PATCH(jsonReq(url, 'PATCH', { status: 'rejected' }), params)).status).toBe(422);
      await expect(db.bill.findUniqueOrThrow({ where: { id: bill.id } })).resolves.toMatchObject({ status: 'paid' });
    });
  });

  describe('PUT /api/bills/[id]', () => {
    it('should refuse to change amounts of a paid bill', async () => {
      const bill = await db.bill.create({
        data: { projectId: ctx.projectId, submittedByEmail: ctx.userEmail, date: new Date(), status: 'paid', vendor: 'X', brutto19: 5 },
      });
      const res = await billRoute.PUT(
        jsonReq(`http://localhost/api/bills/${bill.id}`, 'PUT', { brutto19: 500 }),
        { params: { id: bill.id } }
      );

      expect(res.status).toBeGreaterThanOrEqual(400);
      await expect(db.bill.findUniqueOrThrow({ where: { id: bill.id } })).resolves.toMatchObject({ status: 'paid' });
      expect(Number((await db.bill.findUniqueOrThrow({ where: { id: bill.id } })).brutto19)).toBe(5);
    });
  });

  describe('PATCH /api/bills/[id]/verify-field', () => {
    it("should forbid a regular member from clearing another user's OCR flags", async () => {
      const otherEmail = `other-${Date.now()}@example.com`;
      await db.user.create({ data: { email: otherEmail, passwordHash: 'x' } });
      await db.projectMember.create({ data: { projectId: ctx.projectId, userEmail: otherEmail, role: 'user' } });
      const bill = await db.bill.create({
        data: {
          projectId: ctx.projectId, submittedByEmail: ctx.userEmail, date: new Date(),
          ocrFields: { vendor: { verified: false } },
        },
      });
      mockAuth.mockResolvedValue({
        user: { ...makeSession(ctx).user, id: 'other', email: otherEmail, role: 'user', currentProjectRole: 'user' },
      } as never);

      const res = await verifyRoute.PATCH(
        jsonReq(`http://localhost/api/bills/${bill.id}/verify-field`, 'PATCH', { field: 'vendor' }),
        { params: { id: bill.id } }
      );

      expect(res.status).toBe(403);
      await db.user.delete({ where: { email: otherEmail } });
    });
  });
});
