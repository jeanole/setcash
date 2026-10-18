/**
 * Integration tests for V-Geld balance/analysis (real DB).
 *
 * Only confirmed transfers count as received; only bills in
 * SPENDING_BILL_STATUSES (confirmed, approved, paid) count as spent.
 */

import { db } from '@/lib/db';
import { getVgeldBalance, getVgeldAnalysis } from '@/lib/vgeld';
import { createTestContext, cleanupTestContext, TestContext } from '../helpers';

describe('V-Geld aggregation', () => {
  let ctx: TestContext;
  const other = `other-${Date.now()}@example.com`;

  beforeAll(async () => {
    ctx = await createTestContext();
    const { projectId, userEmail } = ctx;
    const date = new Date('2026-01-15');

    await db.vgeld.createMany({
      data: [
        { projectId, date, amount: 500, toUser: userEmail, confirmedBy: 'admin@example.com' },
        { projectId, date, amount: 0.1, toUser: userEmail, confirmedBy: 'admin@example.com' },
        { projectId, date, amount: 0.2, toUser: userEmail, confirmedBy: 'admin@example.com' },
        // Unconfirmed — must not count
        { projectId, date, amount: 1000, toUser: userEmail, confirmedBy: null },
        { projectId, date, amount: 50, toUser: other, confirmedBy: 'admin@example.com' },
      ],
    });

    await db.bill.createMany({
      data: [
        { projectId, date, submittedByEmail: userEmail, status: 'confirmed', brutto19: 100, brutto7: 10, brutto0: 1 },
        { projectId, date, submittedByEmail: userEmail, status: 'approved', brutto19: 20 },
        { projectId, date, submittedByEmail: userEmail, status: 'paid', brutto0: 5.55 },
        // Not real spending — must not count
        { projectId, date, submittedByEmail: userEmail, status: 'pending', brutto19: 300 },
        { projectId, date, submittedByEmail: userEmail, status: 'rejected', brutto19: 300 },
        { projectId, date, submittedByEmail: userEmail, status: 'draft', brutto19: 300 },
      ],
    });
  });

  afterAll(async () => {
    await cleanupTestContext(ctx);
  });

  it('should count only confirmed transfers and spending-status bills in the balance', async () => {
    // received 500.30, spent 111 + 20 + 5.55 = 136.55
    await expect(getVgeldBalance(ctx.projectId, ctx.userEmail)).resolves.toBe(363.75);
  });

  it('should return a zero balance for a user with no activity', async () => {
    await expect(getVgeldBalance(ctx.projectId, 'nobody@example.com')).resolves.toBe(0);
  });

  it('should summarise every user who received or spent, rounded to cents', async () => {
    const analysis = await getVgeldAnalysis(ctx.projectId);

    expect(analysis.map((a) => a.user)).toEqual([ctx.userEmail, other].sort());
    expect(analysis.find((a) => a.user === other)).toEqual(
      { user: other, received: 50, spent: 0, remaining: 50, percentUsed: 0 }
    );
    expect(analysis.find((a) => a.user === ctx.userEmail)).toMatchObject(
      { received: 500.3, spent: 136.55, remaining: 363.75 }
    );
  });
});
