/**
 * Integration tests for SQL-aggregated spending (real DB).
 *
 * Allocation percentages split a bill's brutto/netto across motives and
 * categories; only spending-status bills count; bills with no allocation of
 * a kind land in the "(unallocated)" row.
 */

import { db } from '@/lib/db';
import {
  getSpendingByMotive,
  getSpendingByCategory,
  getSpendingTotals,
  getUserSpendingSummary,
  getBudgetMatrixSpending,
  getGrossOnlySummary,
  grossOnlyNote,
  roundCents,
} from '@/lib/spending';
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

describe('spending: bills that only carry grossAmount (BUG-9)', () => {
  let ctx: TestContext;
  let motiveA: string;
  let motiveB: string;
  let category: string;

  beforeAll(async () => {
    ctx = await createTestContext();
    const { projectId, userEmail } = ctx;
    const date = new Date('2026-02-01');

    motiveA = (await db.motive.create({ data: { projectId, name: 'A', budget: 100 } })).id;
    motiveB = (await db.motive.create({ data: { projectId, name: 'B', budget: 100 } })).id;
    category = (await db.category.create({ data: { projectId, name: 'C', budget: 100 } })).id;

    // OCR "amount" path: grossAmount only, all brutto = 0
    const gross = await db.bill.create({
      data: { projectId, date, submittedByEmail: userEmail, status: 'approved', grossAmount: 50 },
    });
    await db.billMotive.createMany({
      data: [
        { billId: gross.id, motiveId: motiveA, percentage: 60 },
        { billId: gross.id, motiveId: motiveB, percentage: 40 },
      ],
    });
    await db.billCategory.create({ data: { billId: gross.id, categoryId: category, percentage: 100 } });

    // Normal bill: brutto sum wins over a stale grossAmount
    await db.bill.create({
      data: {
        projectId, date, submittedByEmail: userEmail, status: 'confirmed',
        brutto19: 10, brutto7: 5, grossAmount: 999, nettoAmount: 13.3,
      },
    });

    // Unallocated gross-only bill, spending status
    await db.bill.create({
      data: { projectId, date, submittedByEmail: userEmail, status: 'paid', grossAmount: 7.5 },
    });

    // Gross-only but not real spending
    await db.bill.create({
      data: { projectId, date, submittedByEmail: userEmail, status: 'pending', grossAmount: 400 },
    });
  });

  afterAll(async () => {
    await cleanupTestContext(ctx);
  });

  it('should allocate a grossAmount-only bill to motives by percentage', async () => {
    const items = await getSpendingByMotive(ctx.projectId);

    expect(items.find((i) => i.id === motiveA)).toMatchObject({ spent: 30, remaining: 70 });
    expect(items.find((i) => i.id === motiveB)).toMatchObject({ spent: 20, remaining: 80 });
  });

  it('should allocate a grossAmount-only bill to categories', async () => {
    const items = await getSpendingByCategory(ctx.projectId);

    expect(items.find((i) => i.id === category)).toMatchObject({ spent: 50, remaining: 50 });
  });

  it('should include grossAmount-only bills in the unallocated row', async () => {
    const motiveItems = await getSpendingByMotive(ctx.projectId);

    // 7.5 (gross-only paid) + 15 (brutto 10 + 5, no allocation)
    expect(motiveItems.find((i) => i.id === null)).toMatchObject({ spent: 22.5 });
  });

  it('should include grossAmount-only bills in the totals', async () => {
    const motiveItems = await getSpendingByMotive(ctx.projectId);

    // 50 + 15 + 7.5; the pending 400 never counts
    expect(getSpendingTotals(motiveItems).spent).toBe(72.5);
  });

  it('should keep netto as nettoAmount for grossAmount-only bills', async () => {
    const motiveItems = await getSpendingByMotive(ctx.projectId);

    expect(getSpendingTotals(motiveItems).nettoSpent).toBe(13.3);
  });

  it('should summarise a user with the same per-bill total rule', async () => {
    const summary = await getUserSpendingSummary(ctx.projectId, ctx.userEmail.toUpperCase());

    expect(summary).toEqual({
      count: 3,
      brutto19: 10,
      brutto7: 5,
      brutto0: 0,
      total: 72.5,
      unsplit: 57.5,
      unsplitNetto: 0,
    });
  });

  // BUG-29: these bills have netto 0, so netto figures must say they are missing
  describe('getGrossOnlySummary (BUG-29)', () => {
    it('should count spending bills with only a grossAmount and sum their brutto', async () => {
      // 50 (approved) + 7.5 (paid); pending 400 and the normal bill are excluded
      await expect(getGrossOnlySummary(ctx.projectId)).resolves.toEqual({ count: 2, grossSum: 57.5 });
    });

    it('should restrict the summary to one user, matched case-insensitively', async () => {
      await expect(getGrossOnlySummary(ctx.projectId, ctx.userEmail.toUpperCase())).resolves.toEqual({
        count: 2,
        grossSum: 57.5,
      });
      await expect(getGrossOnlySummary(ctx.projectId, 'someone-else@example.com')).resolves.toEqual({
        count: 0,
        grossSum: 0,
      });
    });

    it('should return zero for a project without such bills', async () => {
      const other = await createTestContext();
      try {
        await db.bill.create({
          data: {
            projectId: other.projectId, date: new Date('2026-02-01'), submittedByEmail: other.userEmail,
            status: 'approved', brutto19: 10, grossAmount: 10, nettoAmount: 8.4,
          },
        });
        await expect(getGrossOnlySummary(other.projectId)).resolves.toEqual({ count: 0, grossSum: 0 });
      } finally {
        await cleanupTestContext(other);
      }
    });

    it('should leave netto untouched (0) for these bills in the matrix spending', async () => {
      const spending = await getBudgetMatrixSpending(ctx.projectId);

      expect(spending.grossOnly).toEqual({ count: 2, grossSum: 57.5 });
      // Only the 50.00 bill is allocated to a category: it adds 50.00 brutto but 0.00 netto
      expect(spending.categorySpendingBruttoTotal).toBe(50);
      expect(spending.categorySpendingTotal).toBe(0);
    });

    it('should describe the gross-only bills in an export note, and not at all when there are none', async () => {
      const note = grossOnlyNote({ count: 2, grossSum: 57.5 });

      expect(note).toContain('2 counted bills');
      expect(note).toContain('57.50 EUR brutto');
      expect(grossOnlyNote({ count: 0, grossSum: 0 })).toBeNull();
    });
  });
});

describe('spending: totals do not drift by a cent (BUG-12)', () => {
  let ctx: TestContext;
  let motives: string[];
  let category: string;

  beforeAll(async () => {
    ctx = await createTestContext();
    const { projectId, userEmail } = ctx;
    const date = new Date('2026-03-01');

    motives = [];
    for (const name of ['M1', 'M2', 'M3']) {
      motives.push((await db.motive.create({ data: { projectId, name, budget: 0 } })).id);
    }
    category = (await db.category.create({ data: { projectId, name: 'Only', budget: 0 } })).id;

    // 3 x 99.99 split 33.33 / 33.33 / 33.34
    for (let i = 0; i < 3; i++) {
      const bill = await db.bill.create({
        data: {
          projectId, date, submittedByEmail: userEmail, status: 'approved',
          brutto19: 99.99, nettoAmount: 84.03,
        },
      });
      await db.billMotive.createMany({
        data: [
          { billId: bill.id, motiveId: motives[0], percentage: 33.33 },
          { billId: bill.id, motiveId: motives[1], percentage: 33.33 },
          { billId: bill.id, motiveId: motives[2], percentage: 33.34 },
        ],
      });
      await db.billCategory.create({ data: { billId: bill.id, categoryId: category, percentage: 100 } });
    }

    // Half-cent splits: 0.15 / 2 = 0.075 per motive (rounds up per row);
    // netto 0.05 / 2 = 0.025
    const half = await db.bill.create({
      data: {
        projectId, date, submittedByEmail: userEmail, status: 'paid',
        brutto0: 0.15, nettoAmount: 0.05,
      },
    });
    await db.billMotive.createMany({
      data: [
        { billId: half.id, motiveId: motives[0], percentage: 50 },
        { billId: half.id, motiveId: motives[1], percentage: 50 },
      ],
    });
    await db.billCategory.create({ data: { billId: half.id, categoryId: category, percentage: 100 } });
  });

  afterAll(async () => {
    await cleanupTestContext(ctx);
  });

  it('should make motive-tab and category-tab brutto totals equal the sum of the bills', async () => {
    const motiveTotals = getSpendingTotals(await getSpendingByMotive(ctx.projectId));
    const categoryTotals = getSpendingTotals(await getSpendingByCategory(ctx.projectId));

    // 3 x 99.99 + 0.15
    expect(motiveTotals.spent).toBe(300.12);
    expect(categoryTotals.spent).toBe(300.12);
  });

  it('should give the budget matrix a once-rounded grand spent total', async () => {
    const spending = await getBudgetMatrixSpending(ctx.projectId);

    expect(spending.categorySpendingBruttoTotal).toBe(300.12);
    expect(spending.categorySpendingTotal).toBe(252.14);
  });

  it('should make motive-tab and category-tab netto totals equal the sum of the bills', async () => {
    const motiveTotals = getSpendingTotals(await getSpendingByMotive(ctx.projectId));
    const categoryTotals = getSpendingTotals(await getSpendingByCategory(ctx.projectId));

    // 3 x 84.03 + 0.05
    expect(motiveTotals.nettoSpent).toBe(252.14);
    expect(categoryTotals.nettoSpent).toBe(252.14);
  });

  it('should have per-row rounded values that sum to more than the true total (fixture sanity)', async () => {
    const items = await getSpendingByMotive(ctx.projectId);
    const roundedRowSum = roundCents(items.reduce((sum, i) => sum + i.spent, 0));
    const roundedNettoRowSum = roundCents(items.reduce((sum, i) => sum + i.nettoSpent, 0));

    // M1 and M2 each carry a 0.075 share that rounds up on its own row
    expect(roundedRowSum).toBeGreaterThan(300.12);
    expect(roundedNettoRowSum).toBeGreaterThan(252.14);
  });

  it('should round half-cents away from zero in roundCents', () => {
    expect(roundCents(49.995)).toBe(50);
    expect(roundCents(41.685)).toBe(41.69);
    expect(roundCents(1.005)).toBe(1.01);
    expect(roundCents(0.1 + 0.2)).toBe(0.3);
  });

  it('should report remaining from the once-rounded total', async () => {
    const totals = getSpendingTotals(await getSpendingByCategory(ctx.projectId));

    expect(totals.remaining).toBe(-300.12);
  });
});
