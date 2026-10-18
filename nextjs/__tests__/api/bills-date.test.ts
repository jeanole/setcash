/**
 * BUG-26: saving a bill whose date only differs by the time of day must not
 * count as a change (real DB, mocked session).
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

const UPLOADS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'setcash-uploads-'));
process.env.UPLOADS_DIR = UPLOADS_DIR;
const billRoute = require('@/app/api/bills/[id]/route') as typeof import('@/app/api/bills/[id]/route');

function jsonReq(url: string, method: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const put = (id: string, body: unknown) =>
  billRoute.PUT(jsonReq(`http://localhost/api/bills/${id}`, 'PUT', body), { params: Promise.resolve({ id }) });

/** The exact payload the bill detail page sends for an unedited bill */
function uiPayload(day: string, extra: Record<string, unknown> = {}) {
  return {
    date: new Date(day).toISOString(),
    type: 'Kauf',
    vendor: 'Telegram Shop',
    item: 'Item',
    comment: '',
    brutto19: 10,
    brutto7: 0,
    brutto0: 0,
    ...extra,
  };
}

describe('PUT /api/bills/[id] - date handling (BUG-26)', () => {
  let ctx: TestContext;
  const memberEmails: string[] = [];

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  afterAll(async () => {
    await cleanupTestContext(ctx);
    await db.user.deleteMany({ where: { email: { in: memberEmails } } });
    fs.rmSync(UPLOADS_DIR, { recursive: true, force: true });
  });

  async function createOwner() {
    const email = `owner-${Math.random().toString(36).slice(2, 10)}@example.com`;
    const user = await db.user.create({ data: { email, passwordHash: 'x' } });
    await db.projectMember.create({ data: { projectId: ctx.projectId, userEmail: email, role: 'user' } });
    memberEmails.push(email);
    return {
      email,
      session: { user: { ...makeSession(ctx).user, id: user.id, email, role: 'user', currentProjectRole: 'user' } },
    };
  }

  function createBill(ownerEmail: string, status: 'approved' | 'paid', date: Date) {
    return db.bill.create({
      data: {
        projectId: ctx.projectId, submittedByEmail: ownerEmail, date,
        status, vendor: 'Telegram Shop', item: 'Item', type: 'Kauf', brutto19: 10, grossAmount: 10,
      },
    });
  }

  it('should keep an approved bill approved and keep its time of day when the owner saves unchanged', async () => {
    const owner = await createOwner();
    const stored = new Date('2026-10-18T13:54:07.128Z');
    const bill = await createBill(owner.email, 'approved', stored);
    mockAuth.mockResolvedValue(owner.session as never);

    const res = await put(bill.id, uiPayload('2026-10-18'));

    expect(res.status).toBe(200);
    const after = await db.bill.findUniqueOrThrow({ where: { id: bill.id } });
    expect(after.status).toBe('approved');
    expect(after.date.toISOString()).toBe(stored.toISOString());
  });

  it('should not write an EditLog entry for the date when only the time of day differs', async () => {
    const owner = await createOwner();
    const bill = await createBill(owner.email, 'approved', new Date('2026-10-18T13:54:07.128Z'));
    mockAuth.mockResolvedValue(owner.session as never);

    await put(bill.id, uiPayload('2026-10-18'));

    const logs = await db.editLog.findMany({ where: { billId: bill.id } });
    expect(logs.filter((l) => 'date' in ((l.changes as object) ?? {}))).toHaveLength(0);
  });

  it('should compare by UTC day so a bill stored at 23:30Z is not misjudged', async () => {
    const owner = await createOwner();
    const stored = new Date('2026-10-18T23:30:00.000Z');
    const bill = await createBill(owner.email, 'approved', stored);
    mockAuth.mockResolvedValue(owner.session as never);

    // The page shows bill.date.split('T')[0] = 2026-10-18
    const res = await put(bill.id, uiPayload('2026-10-18'));

    expect(res.status).toBe(200);
    const after = await db.bill.findUniqueOrThrow({ where: { id: bill.id } });
    expect(after.status).toBe('approved');
    expect(after.date.toISOString()).toBe(stored.toISOString());
  });

  it('should still reset an approved bill to pending when the owner changes the day', async () => {
    const owner = await createOwner();
    const bill = await createBill(owner.email, 'approved', new Date('2026-10-18T13:54:07.128Z'));
    mockAuth.mockResolvedValue(owner.session as never);

    const res = await put(bill.id, uiPayload('2026-10-19'));

    expect(res.status).toBe(200);
    const after = await db.bill.findUniqueOrThrow({ where: { id: bill.id } });
    expect(after.status).toBe('pending');
    expect(after.date.toISOString()).toBe('2026-10-19T00:00:00.000Z');
  });

  it('should detect a day change at the UTC day boundary', async () => {
    const owner = await createOwner();
    const bill = await createBill(owner.email, 'approved', new Date('2026-10-18T23:59:59.999Z'));
    mockAuth.mockResolvedValue(owner.session as never);

    const res = await put(bill.id, { date: '2026-10-19T00:00:00.000Z' });

    expect(res.status).toBe(200);
    await expect(db.bill.findUniqueOrThrow({ where: { id: bill.id } })).resolves.toMatchObject({ status: 'pending' });
  });

  it('should answer 200 (not 403) for the owner of a paid bill saving with a same-day date and no other change', async () => {
    const owner = await createOwner();
    const stored = new Date('2026-10-18T09:15:00.000Z');
    const bill = await createBill(owner.email, 'paid', stored);
    mockAuth.mockResolvedValue(owner.session as never);

    const res = await put(bill.id, uiPayload('2026-10-18'));

    expect(res.status).toBe(200);
    const after = await db.bill.findUniqueOrThrow({ where: { id: bill.id } });
    expect(after.status).toBe('paid');
    expect(after.date.toISOString()).toBe(stored.toISOString());
  });

  it('should still forbid the owner of a paid bill to change the day', async () => {
    const owner = await createOwner();
    const bill = await createBill(owner.email, 'paid', new Date('2026-10-18T09:15:00.000Z'));
    mockAuth.mockResolvedValue(owner.session as never);

    const res = await put(bill.id, uiPayload('2026-10-20'));

    expect(res.status).toBe(403);
  });
});
