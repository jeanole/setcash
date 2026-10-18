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
import { getBillStatusActions } from '@/components/bills/billActions';

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
const imagesRoute = require('@/app/api/bills/[id]/images/route') as typeof import('@/app/api/bills/[id]/images/route');
const imageRoute = require('@/app/api/bills/[id]/images/[imageId]/route') as typeof import('@/app/api/bills/[id]/images/[imageId]/route');
const uploadsRoute = require('@/app/api/uploads/[[...path]]/route') as typeof import('@/app/api/uploads/[[...path]]/route');
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


interface FilePart { field: string; filename: string; data?: Buffer }

/** Multipart POST/PUT with arbitrary text fields and file parts (any field name / extension). */
async function multipartWithFiles(
  fields: Record<string, string>,
  fileParts: FilePart[],
  method = 'POST'
): Promise<NextRequest> {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  for (const f of fileParts) form.append(f.field, new Blob([f.data ?? JPEG]), f.filename);
  const encoded = new Request('http://localhost/api/bills', { method, body: form });
  const body = Buffer.from(await encoded.arrayBuffer());
  return new NextRequest('http://localhost/api/bills', {
    method,
    body,
    headers: {
      'content-type': encoded.headers.get('content-type')!,
      'content-length': String(body.byteLength),
    },
  });
}

/** Chunked multipart body (no Content-Length) with one big file part under `evil`. */
function chunkedOversizedRequest(totalBytes: number): NextRequest {
  const boundary = '----setcash-test-boundary';
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="evil"; filename="big.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  const chunk = Buffer.alloc(1024 * 1024, 1);
  let stage = 0;
  let sent = 0;
  const stream = new ReadableStream({
    pull(controller) {
      if (stage === 0) { controller.enqueue(head); stage = 1; return; }
      if (sent < totalBytes) { controller.enqueue(chunk); sent += chunk.length; return; }
      controller.enqueue(tail);
      controller.close();
    },
  });
  return new NextRequest('http://localhost/api/bills', {
    method: 'POST',
    body: stream,
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
    duplex: 'half',
  } as ConstructorParameters<typeof NextRequest>[1]);
}

/** Every file below UPLOADS_DIR (relative paths) */
function listUploads(dir = UPLOADS_DIR): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listUploads(full));
    else out.push(path.relative(UPLOADS_DIR, full));
  }
  return out.sort();
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

  const memberEmails: string[] = [];

  /** A fresh project member (own user id, so the per-user rate limit is not shared). */
  async function createMember(role: 'user' | 'admin' = 'user') {
    const email = `member-${Math.random().toString(36).slice(2, 10)}@example.com`;
    const user = await db.user.create({ data: { email, passwordHash: 'x' } });
    await db.projectMember.create({ data: { projectId: ctx.projectId, userEmail: email, role } });
    memberEmails.push(email);
    const session = {
      user: { ...makeSession(ctx).user, id: user.id, email, role, currentProjectRole: role },
    };
    return { email, session };
  }

  afterAll(async () => {
    await cleanupTestContext(ctx);
    await db.user.deleteMany({ where: { email: { in: memberEmails } } });
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
      const params = { params: Promise.resolve({ id: bill.id }) };
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
        { params: Promise.resolve({ id: bill.id }) }
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
        { params: Promise.resolve({ id: bill.id }) }
      );

      expect(res.status).toBe(403);
      await db.user.delete({ where: { email: otherEmail } });
    });
  });
  // -------------------------------------------------------------------------
  // PROJ-26 QA fixes
  // -------------------------------------------------------------------------

  describe('PUT /api/bills/[id] - locked bills (BUG-4)', () => {
    async function lockedBill(ownerEmail: string, status: 'approved' | 'paid') {
      const [m1, m2] = await Promise.all([
        db.motive.create({ data: { projectId: ctx.projectId, name: `M1-${Math.random()}` } }),
        db.motive.create({ data: { projectId: ctx.projectId, name: `M2-${Math.random()}` } }),
      ]);
      const bill = await db.bill.create({
        data: {
          projectId: ctx.projectId, submittedByEmail: ownerEmail, date: new Date('2026-01-10T00:00:00.000Z'),
          status, vendor: 'Original', item: 'Item', brutto19: 10, grossAmount: 10,
          motives: { create: [{ motiveId: m1.id, percentage: 100 }] },
        },
      });
      return { bill, m1, m2 };
    }

    const put = (id: string, body: unknown) =>
      billRoute.PUT(jsonReq(`http://localhost/api/bills/${id}`, 'PUT', body), { params: Promise.resolve({ id }) });

    it('should reset an approved bill to pending when its owner re-allocates it', async () => {
      const member = await createMember();
      const { bill, m2 } = await lockedBill(member.email, 'approved');
      mockAuth.mockResolvedValue(member.session as never);

      const res = await put(bill.id, { motiveAllocations: [{ motiveId: m2.id, percentage: 100 }] });

      expect(res.status).toBe(200);
      const after = await db.bill.findUniqueOrThrow({ where: { id: bill.id }, include: { motives: true } });
      expect(after.status).toBe('pending');
      expect(after.motives.map((m) => m.motiveId)).toEqual([m2.id]);
    });

    it.each([
      ['vendor', { vendor: 'edited after approval' }],
      ['date', { date: '2025-01-01T00:00:00.000Z' }],
      ['item', { item: 'other item' }],
      ['type', { type: 'Rechnung' }],
      ['comment', { comment: 'sneaky' }],
    ])('should reset an approved bill to pending when its owner changes the %s', async (_name, body) => {
      const member = await createMember();
      const { bill } = await lockedBill(member.email, 'approved');
      mockAuth.mockResolvedValue(member.session as never);

      const res = await put(bill.id, body);

      expect(res.status).toBe(200);
      await expect(db.bill.findUniqueOrThrow({ where: { id: bill.id } })).resolves.toMatchObject({ status: 'pending' });
    });

    it('should keep an approved bill approved when the owner saves without real changes', async () => {
      const member = await createMember();
      const { bill, m1 } = await lockedBill(member.email, 'approved');
      mockAuth.mockResolvedValue(member.session as never);

      const res = await put(bill.id, {
        vendor: 'Original',
        date: '2026-01-10T00:00:00.000Z',
        motiveAllocations: [{ motiveId: m1.id, percentage: 100 }],
      });

      expect(res.status).toBe(200);
      await expect(db.bill.findUniqueOrThrow({ where: { id: bill.id } })).resolves.toMatchObject({ status: 'approved' });
    });

    it('should forbid the owner of a paid bill to change the vendor', async () => {
      const member = await createMember();
      const { bill } = await lockedBill(member.email, 'paid');
      mockAuth.mockResolvedValue(member.session as never);

      const res = await put(bill.id, { vendor: 'edited after payment' });

      expect(res.status).toBe(403);
      await expect(db.bill.findUniqueOrThrow({ where: { id: bill.id } })).resolves.toMatchObject({ vendor: 'Original', status: 'paid' });
    });

    it('should forbid the owner of a paid bill to re-allocate it and leave the allocations untouched', async () => {
      const member = await createMember();
      const { bill, m1, m2 } = await lockedBill(member.email, 'paid');
      mockAuth.mockResolvedValue(member.session as never);

      const res = await put(bill.id, { motiveAllocations: [{ motiveId: m2.id, percentage: 100 }] });

      expect(res.status).toBe(403);
      const after = await db.bill.findUniqueOrThrow({ where: { id: bill.id }, include: { motives: true } });
      expect(after.status).toBe('paid');
      expect(after.motives.map((m) => m.motiveId)).toEqual([m1.id]);
    });

    it('should let a DB-verified admin edit an approved bill without resetting it', async () => {
      const member = await createMember();
      const { bill } = await lockedBill(member.email, 'approved');
      mockAuth.mockResolvedValue(makeSession(ctx, 'admin') as never);

      const res = await put(bill.id, { vendor: 'Admin fix' });

      expect(res.status).toBe(200);
      await expect(db.bill.findUniqueOrThrow({ where: { id: bill.id } })).resolves.toMatchObject({ vendor: 'Admin fix', status: 'approved' });
    });

    it('should not trust a stale admin claim in the session of a plain member', async () => {
      const member = await createMember('user');
      const { bill } = await lockedBill(member.email, 'paid');
      mockAuth.mockResolvedValue({ user: { ...member.session.user, role: 'admin', currentProjectRole: 'admin' } } as never);

      const res = await put(bill.id, { vendor: 'forged admin' });

      expect(res.status).toBe(403);
    });
  });

  describe('PUT /api/bills/[id] - validation (BUG-5)', () => {
    async function ownBill() {
      return db.bill.create({
        data: { projectId: ctx.projectId, submittedByEmail: ctx.userEmail, date: new Date(), status: 'confirmed', vendor: 'X', brutto19: 5, grossAmount: 5 },
      });
    }
    const put = (id: string, body: unknown) =>
      billRoute.PUT(jsonReq(`http://localhost/api/bills/${id}`, 'PUT', body), { params: Promise.resolve({ id }) });

    it.each([
      ['an amount above the cap', { brutto19: 123456789012 }],
      ['an amount just above the cap', { brutto19: 1000000.01 }],
      ['a sub-cent amount', { brutto7: 0.0001 }],
      ['a negative amount', { brutto0: -1 }],
      ['an oversized vendor', { vendor: 'V'.repeat(100000) }],
      ['a vendor of 201 characters', { vendor: 'V'.repeat(201) }],
      ['an oversized item', { item: 'I'.repeat(501) }],
      ['an oversized type', { type: 'T'.repeat(101) }],
      ['an oversized comment', { comment: 'C'.repeat(2001) }],
    ])('should reject %s with 400', async (_name, body) => {
      const bill = await ownBill();

      const res = await put(bill.id, body);

      expect(res.status).toBe(400);
      const after = await db.bill.findUniqueOrThrow({ where: { id: bill.id } });
      expect(Number(after.brutto19)).toBe(5);
      expect(after.vendor).toBe('X');
    });

    it('should accept values at the limits', async () => {
      const bill = await ownBill();

      const res = await put(bill.id, { brutto19: 1000000, brutto7: 0.01, vendor: 'V'.repeat(200), comment: 'C'.repeat(2000) });

      expect(res.status).toBe(200);
    });
  });

  describe('multipart uploads (BUG-6, BUG-18, BUG-19)', () => {
    it('should not persist a file sent under an unexpected field when the request fails validation', async () => {
      const member = await createMember();
      mockAuth.mockResolvedValue(member.session as never);
      const before = listUploads();

      const res = await billsRoute.POST(
        await multipartWithFiles({ ...validBill, brutto19: '-1' }, [{ field: 'evil', filename: 'big.jpg', data: Buffer.alloc(300_000, 1) }])
      );

      expect(res.status).toBe(400);
      expect(listUploads()).toEqual(before);
    });

    it('should not persist a file sent under an unexpected field when the request succeeds', async () => {
      const member = await createMember();
      mockAuth.mockResolvedValue(member.session as never);
      const before = listUploads();

      const res = await billsRoute.POST(
        await multipartWithFiles(validBill, [
          { field: 'photos', filename: 'receipt.jpg' },
          { field: 'evil', filename: 'big.jpg', data: Buffer.alloc(300_000, 1) },
        ])
      );

      expect(res.status).toBe(200);
      const { id } = await res.json();
      const images = await db.billImage.findMany({ where: { billId: id } });
      expect(images).toHaveLength(1);
      expect(listUploads()).toEqual([...before, images[0].filePath].sort());
    });

    it('should not persist unexpected fields on POST /api/bills/[id]/images', async () => {
      const member = await createMember();
      mockAuth.mockResolvedValue(member.session as never);
      const bill = await db.bill.create({
        data: { projectId: ctx.projectId, submittedByEmail: member.email, date: new Date(), status: 'confirmed', vendor: 'X' },
      });
      const before = listUploads();

      const res = await imagesRoute.POST(
        await multipartWithFiles({}, [
          { field: 'photos', filename: 'a.jpg' },
          { field: 'evil', filename: 'big.jpg', data: Buffer.alloc(300_000, 1) },
        ]),
        { params: Promise.resolve({ id: bill.id }) }
      );

      expect(res.status).toBe(200);
      const images = await db.billImage.findMany({ where: { billId: bill.id } });
      expect(listUploads()).toEqual([...before, images[0].filePath].sort());

      // failure path: only an unexpected field -> "No files", nothing left behind
      const failed = await imagesRoute.POST(
        await multipartWithFiles({}, [{ field: 'evil', filename: 'big.jpg', data: Buffer.alloc(300_000, 1) }]),
        { params: Promise.resolve({ id: bill.id }) }
      );
      expect(failed.status).toBe(400);
      expect(listUploads()).toEqual([...before, images[0].filePath].sort());
    });

    it('should not persist unexpected fields on PUT /api/bills/[id]/images/[imageId]', async () => {
      const member = await createMember();
      mockAuth.mockResolvedValue(member.session as never);
      const created = await billsRoute.POST(await multipartWithFiles(validBill, [{ field: 'photos', filename: 'a.jpg' }]));
      const { id } = await created.json();
      const image = await db.billImage.findFirstOrThrow({ where: { billId: id } });
      const before = listUploads();
      const params = { params: Promise.resolve({ id, imageId: image.id }) };

      const ok = await imageRoute.PUT(
        await multipartWithFiles({}, [
          { field: 'photo', filename: 'crop.jpg' },
          { field: 'evil', filename: 'big.jpg', data: Buffer.alloc(300_000, 1) },
        ], 'PUT'),
        params
      );
      expect(ok.status).toBe(200);
      const replaced = await db.billImage.findUniqueOrThrow({ where: { id: image.id } });
      expect(listUploads()).toEqual(before.map((f) => (f === image.filePath ? replaced.filePath : f)).sort());

      const failed = await imageRoute.PUT(
        await multipartWithFiles({}, [{ field: 'evil', filename: 'big.jpg', data: Buffer.alloc(300_000, 1) }], 'PUT'),
        params
      );
      expect(failed.status).toBe(400);
      expect(listUploads()).toEqual([replaced.filePath].concat(before.filter((f) => f !== image.filePath)).sort());
    });

    it('should answer 413 for an over-cap chunked upload and leave no files behind', async () => {
      const member = await createMember();
      mockAuth.mockResolvedValue(member.session as never);
      const before = listUploads();

      const res = await billsRoute.POST(chunkedOversizedRequest(102 * 1024 * 1024));

      expect(res.status).toBe(413);
      expect(listUploads()).toEqual(before);
    }, 120000);

    it.each(['x.svg', 'x.gif', 'x.exe'])('should reject %s with 415, create no bill and keep no file', async (filename) => {
      const member = await createMember();
      mockAuth.mockResolvedValue(member.session as never);
      const before = listUploads();
      const billsBefore = await db.bill.count({ where: { projectId: ctx.projectId } });

      const res = await billsRoute.POST(
        await multipartWithFiles(validBill, [
          { field: 'photos', filename: 'ok.jpg' },
          { field: 'photos', filename },
        ])
      );

      expect(res.status).toBe(415);
      expect((await res.json()).error).toMatch(/not allowed/i);
      expect(await db.bill.count({ where: { projectId: ctx.projectId } })).toBe(billsBefore);
      expect(listUploads()).toEqual(before);
    });

    it('should reject a disallowed file type on POST /api/bills/[id]/images', async () => {
      const member = await createMember();
      mockAuth.mockResolvedValue(member.session as never);
      const bill = await db.bill.create({
        data: { projectId: ctx.projectId, submittedByEmail: member.email, date: new Date(), status: 'confirmed', vendor: 'X' },
      });
      const before = listUploads();

      const res = await imagesRoute.POST(
        await multipartWithFiles({}, [{ field: 'photos', filename: 'x.svg' }]),
        { params: Promise.resolve({ id: bill.id }) }
      );

      expect(res.status).toBe(415);
      expect(listUploads()).toEqual(before);
    });

    it('should still treat an empty file input as "no file"', async () => {
      const member = await createMember();
      mockAuth.mockResolvedValue(member.session as never);

      const res = await billsRoute.POST(await multipartWithFiles(validBill, [{ field: 'photos', filename: '', data: Buffer.alloc(0) }]));

      expect(res.status).toBe(200);
    });
  });

  describe('bill numbers (BUG-7)', () => {
    it('should not reuse the number of a deleted highest bill', async () => {
      const member = await createMember();
      mockAuth.mockResolvedValue(member.session as never);
      const ids: string[] = [];
      for (let i = 0; i < 3; i++) {
        ids.push((await (await billsRoute.POST(await multipartRequest(validBill))).json()).id);
      }
      const numbers = (await db.bill.findMany({ where: { id: { in: ids } }, orderBy: { billNumber: 'asc' } })).map((b) => b.billNumber);
      expect(numbers).toEqual(['1.01', '1.02', '1.03']);

      await db.bill.delete({ where: { id: ids[2] } });
      const next = await (await billsRoute.POST(await multipartRequest(validBill))).json();

      await expect(db.bill.findUniqueOrThrow({ where: { id: next.id } })).resolves.toMatchObject({ billNumber: '1.04' });
    });

    it('should keep counting after all bills of a user were deleted', async () => {
      const member = await createMember();
      mockAuth.mockResolvedValue(member.session as never);
      const first = await (await billsRoute.POST(await multipartRequest(validBill))).json();
      await db.bill.delete({ where: { id: first.id } });

      const second = await (await billsRoute.POST(await multipartRequest(validBill))).json();

      await expect(db.bill.findUniqueOrThrow({ where: { id: second.id } })).resolves.toMatchObject({ billNumber: '1.02' });
    });

    it('should roll over to the next group after 20 bills', async () => {
      const member = await createMember();
      mockAuth.mockResolvedValue(member.session as never);
      await db.billNumberCounter.create({ data: { projectId: ctx.projectId, userEmail: member.email, lastIndex: 20 } });

      const res = await (await billsRoute.POST(await multipartRequest(validBill))).json();

      await expect(db.bill.findUniqueOrThrow({ where: { id: res.id } })).resolves.toMatchObject({ billNumber: '2.01' });
    });

    it('should never hand out a number that is already in use, even if the counter lags behind', async () => {
      const member = await createMember();
      mockAuth.mockResolvedValue(member.session as never);
      await db.bill.create({
        data: { projectId: ctx.projectId, submittedByEmail: member.email, date: new Date(), billNumber: '1.05' },
      });
      await db.bill.create({
        data: { projectId: ctx.projectId, submittedByEmail: member.email, date: new Date(), billNumber: 'TG-abc123' },
      });
      await db.billNumberCounter.create({ data: { projectId: ctx.projectId, userEmail: member.email, lastIndex: 2 } });

      const res = await (await billsRoute.POST(await multipartRequest(validBill))).json();

      await expect(db.bill.findUniqueOrThrow({ where: { id: res.id } })).resolves.toMatchObject({ billNumber: '1.06' });
      await expect(
        db.billNumberCounter.findUniqueOrThrow({ where: { projectId_userEmail: { projectId: ctx.projectId, userEmail: member.email } } })
      ).resolves.toMatchObject({ lastIndex: 6 });
    });

    it('should issue distinct numbers to concurrent submissions', async () => {
      const member = await createMember();
      mockAuth.mockResolvedValue(member.session as never);

      const results = await Promise.all(
        Array.from({ length: 4 }, async () => billsRoute.POST(await multipartRequest(validBill)))
      );

      expect(results.map((r) => r.status)).toEqual([200, 200, 200, 200]);
      const bills = await db.bill.findMany({ where: { submittedByEmail: member.email } });
      expect(new Set(bills.map((b) => b.billNumber)).size).toBe(4);
    });

    it('should count the existing bills of a user case-insensitively', async () => {
      const member = await createMember();
      mockAuth.mockResolvedValue(member.session as never);
      await db.bill.create({
        data: { projectId: ctx.projectId, submittedByEmail: member.email.toUpperCase(), date: new Date(), billNumber: '1.01' },
      });

      const res = await (await billsRoute.POST(await multipartRequest(validBill))).json();

      await expect(db.bill.findUniqueOrThrow({ where: { id: res.id } })).resolves.toMatchObject({ billNumber: '1.02' });
    });
  });

  describe('GET /api/uploads (BUG-16)', () => {
    const get = (...segments: string[]) =>
      uploadsRoute.GET(new NextRequest('http://localhost/api/uploads/x'), { params: Promise.resolve({ path: segments }) });

    it.each([
      ['a NUL byte', 'a\u0000b.jpg'],
      ['a control character', 'a\u0001b.jpg'],
      ['a newline', 'a\nb.jpg'],
      ['DEL', 'a\u007fb.jpg'],
    ])('should answer 400 for a path with %s', async (_name, segment) => {
      const res = await get('user', segment);

      expect(res.status).toBe(400);
    });

    it('should still answer 404 for an unknown regular path', async () => {
      const res = await get('nobody', 'missing.jpg');

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/bills amount strings (BUG-17)', () => {
    it.each(['0x10', '1e3', '1E3', '+5', '-0', '1 0', '.5', '5.', '1.234', '1,50', 'Infinity', 'NaN', '0b11', '0o7'])(
      'should reject the amount %j',
      async (amount) => {
        const member = await createMember();
        mockAuth.mockResolvedValue(member.session as never);

        const res = await billsRoute.POST(await multipartRequest({ ...validBill, brutto0: amount }));

        expect(res.status).toBe(400);
      }
    );

    it.each([['12', 12], ['12.5', 12.5], ['12.50', 12.5], ['0', 0], ['007.10', 7.1], [' 3.20 ', 3.2]])(
      'should accept the plain decimal %j',
      async (amount, expected) => {
        const member = await createMember();
        mockAuth.mockResolvedValue(member.session as never);

        const res = await billsRoute.POST(await multipartRequest({ ...validBill, brutto0: amount as string }));

        expect(res.status).toBe(200);
        const { id } = await res.json();
        expect(Number((await db.bill.findUniqueOrThrow({ where: { id } })).brutto0)).toBe(expected);
      }
    );
  });

  describe('bill detail actions match the status API (BUG-20)', () => {
    const statuses = ['draft', 'confirmed', 'pending', 'approved', 'rejected', 'paid'] as const;
    const target = { approve: 'approved', reject: 'rejected', revertToDraft: 'draft' } as const;

    it('should not offer self-approval to the author of a confirmed bill', () => {
      const actions = getBillStatusActions('confirmed', { isAdmin: false, isAuthor: true });

      expect(actions).toEqual({ approve: false, reject: false, revertToDraft: true });
    });

    it('should offer nothing to a viewer who is neither admin nor author', () => {
      expect(getBillStatusActions('confirmed', { isAdmin: false, isAuthor: false })).toEqual({
        approve: false, reject: false, revertToDraft: false,
      });
    });

    it.each(['admin', 'author'] as const)('should only offer actions the API accepts for the %s', async (viewer) => {
      const member = await createMember();
      for (const status of statuses) {
        const actions = getBillStatusActions(status, { isAdmin: viewer === 'admin', isAuthor: viewer === 'author' });
        for (const [action, next] of Object.entries(target) as [keyof typeof target, string][]) {
          if (!actions[action]) continue;
          const bill = await db.bill.create({
            data: { projectId: ctx.projectId, submittedByEmail: member.email, date: new Date(), status, vendor: 'X', brutto19: 5 },
          });
          mockAuth.mockResolvedValue((viewer === 'admin' ? makeSession(ctx, 'admin') : member.session) as never);

          const res = await statusRoute.PATCH(
            jsonReq(`http://localhost/api/bills/${bill.id}/status`, 'PATCH', { status: next }),
            { params: Promise.resolve({ id: bill.id }) }
          );

          expect({ viewer, status, action, http: res.status }).toEqual({ viewer, status, action, http: 200 });
        }
      }
    });

    it('should hide approve and reject for statuses where the API refuses them for admins', () => {
      expect(getBillStatusActions('draft', { isAdmin: true, isAuthor: false }).approve).toBe(false);
      expect(getBillStatusActions('paid', { isAdmin: true, isAuthor: false }).reject).toBe(false);
      expect(getBillStatusActions('approved', { isAdmin: true, isAuthor: false }).approve).toBe(false);
    });
  });
});
