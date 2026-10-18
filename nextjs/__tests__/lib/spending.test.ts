/**
 * Integration tests for SQL-aggregated spending (real DB).
 *
 * Allocation percentages split a bill's brutto/netto across motives and
 * categories; only spending-status bills count; bills with no allocation of
 * a kind land in the "(unallocated)" row.
 */

import { db } from '@/lib/db';
import { getSpendingByMotive, getSpendingByCategory } from '@/lib/spending';
import { createTestContext, cleanupTestContext, TestContext } from '../helpers';

describe('spending aggregation', () => {
  let ctx: TestContext;
  let motiveA: string;
  let motiveB: string;
  let category: string;

  beforeAll(async () => {
    ctx = await createTestContext();
    const { projectId, userEmail } = ctx;
    const date = new Date('2026-02-01');

    motiveA = (await db.motive.create({ data: { projectId, name: 'A', budget: 1000 } })).id;
    motiveB = (await db.motive.create({ data: { projectId, name: 'B', budget: 0 } })).id;
    category = (await db.category.create({ data: { projectId, name: 'C', budget: 500 } })).id;

    const split = await db.bill.create({
      data: { projectId, date, submittedByEmail: userEmail, status: 'approved', brutto19: 100, nettoAmount: 84.03 },
    });
    await db.billMotive.createMany({
      data: [
        { billId: split.id, motiveId: motiveA, percentage: 60 },
        { billId: split.id, motiveId: motiveB, percentage: 40 },
      ],
    });
    await db.billCategory.create({ data: { billId: split.id, categoryId: category, percentage: 100 } });

    // Not real spending — ignored even though allocated
    const pending = await db.bill.create({
      data: { projectId, date, submittedByEmail: userEmail, status: 'pending', brutto19: 999 },
    });
    await db.billMotive.create({ data: { billId: pending.id, motiveId: motiveA, percentage: 100 } });

    // Spending bill with no allocations at all
    await db.bill.create({
      data: { projectId, date, submittedByEmail: userEmail, status: 'paid', brutto0: 12.34, nettoAmount: 12.34 },
    });
  });

  afterAll(async () => {
    await cleanupTestContext(ctx);
  });

  it('should split brutto and netto by motive percentage', async () => {
    const items = await getSpendingByMotive(ctx.projectId);

    expect(items.find((i) => i.id === motiveA)).toMatchObject({ spent: 60, nettoSpent: 50.42, remaining: 940 });
    expect(items.find((i) => i.id === motiveB)).toMatchObject({ spent: 40, nettoSpent: 33.61 });
  });

  it('should report unallocated spending bills in a synthetic row', async () => {
    const items = await getSpendingByMotive(ctx.projectId);

    expect(items.find((i) => i.id === null)).toMatchObject({ spent: 12.34, status: 'unallocated' });
  });

  it('should aggregate by category', async () => {
    const items = await getSpendingByCategory(ctx.projectId);

    expect(items.find((i) => i.id === category)).toMatchObject({ spent: 100, remaining: 400 });
    expect(items.find((i) => i.id === null)).toMatchObject({ spent: 12.34 });
  });
});
