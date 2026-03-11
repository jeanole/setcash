// ============================================================================
// Spending Overview — Server-Side Data Fetching
//
// Used directly in Server Components (no API route needed).
// All queries are project-scoped and only include confirmed bills
// (status = 'confirmed'; draft bills are always excluded).
// ============================================================================

import { db as prisma } from '@/lib/db';
import { BillStatus } from '@prisma/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SpendingItem {
  /** null for the "(unallocated)" synthetic row */
  id: string | null;
  name: string;
  budget: number;
  spent: number;
  remaining: number;
  /** null when budget === 0 (avoid division by zero) */
  percentUsed: number | null;
  status: 'normal' | 'unallocated' | 'deleted';
}

export interface SpendingTotals {
  budget: number;
  spent: number;
  remaining: number;
  /** null when total budget === 0 */
  percentUsed: number | null;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * The confirmed-bill status filter used in all spending queries.
 * The Prisma BillStatus enum has no null value; the default is 'confirmed'.
 * The spec says "status IS NULL OR status = 'confirmed'". Since the Bill.status
 * field is non-nullable in the Prisma schema (BillStatus enum, default confirmed),
 * "status IS NULL" can never occur. We therefore match the spec by including
 * only bills with status = 'confirmed'.
 *
 * EC-6: Deleted motives/categories are not shown because Prisma CASCADE deletes
 * remove allocation records from BillMotive/BillCategory when a motive/category
 * is deleted. Soft-delete would be needed to support the "(deleted)" row variant.
 */
const CONFIRMED_BILL_FILTER = {
  status: BillStatus.confirmed,
} as const;

function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const n = Number(value);
  return isNaN(n) ? 0 : n;
}

function calcPercentUsed(spent: number, budget: number): number | null {
  if (budget === 0) return null;
  return (spent / budget) * 100;
}

function buildSpendingItem(
  id: string,
  name: string,
  budget: number,
  spent: number,
  itemStatus: 'normal' | 'deleted'
): SpendingItem {
  const remaining = budget - spent;
  return {
    id,
    name,
    budget,
    spent,
    remaining,
    percentUsed: calcPercentUsed(spent, budget),
    status: itemStatus,
  };
}

// ---------------------------------------------------------------------------
// getSpendingByMotive
// ---------------------------------------------------------------------------

/**
 * Returns spending aggregated by motive for the given project.
 *
 * Budget source priority:
 *   1. Sum of BudgetMatrix.amount for the motive (if any matrix entries exist)
 *   2. Motive.budget fallback
 *
 * Spending = SUM((bill.brutto19 + bill.brutto7 + bill.brutto0) * billMotive.percentage / 100)
 *   over confirmed bills only.
 *
 * An "(unallocated)" row is appended when bills exist with no motive
 * allocations at all.
 */
export async function getSpendingByMotive(projectId: string): Promise<SpendingItem[]> {
  // 1. Fetch all motives for the project
  const motives = await prisma.motive.findMany({
    where: { projectId },
    orderBy: { name: 'asc' },
    include: {
      budgetMatrix: {
        where: { projectId },
        select: { amount: true },
      },
    },
  });

  // 2. Fetch all BillMotive records for confirmed bills in this project
  //    Join through bill to apply project + status filters
  const billMotives = await prisma.billMotive.findMany({
    where: {
      bill: {
        projectId,
        ...CONFIRMED_BILL_FILTER,
      },
    },
    select: {
      motiveId: true,
      percentage: true,
      bill: {
        select: { brutto19: true, brutto7: true, brutto0: true },
      },
    },
  });

  // 3. Aggregate spending per motiveId (using total brutto = brutto19 + brutto7 + brutto0)
  const spendingByMotiveId = new Map<string, number>();
  for (const bm of billMotives) {
    const totalBrutto =
      toNumber(bm.bill.brutto19) + toNumber(bm.bill.brutto7) + toNumber(bm.bill.brutto0);
    const allocated = totalBrutto * toNumber(bm.percentage) / 100;
    spendingByMotiveId.set(
      bm.motiveId,
      (spendingByMotiveId.get(bm.motiveId) ?? 0) + allocated
    );
  }

  // 4. Build result rows — one per motive
  const items: SpendingItem[] = motives.map((motive) => {
    // Budget: prefer sum of matrix entries, fall back to motive.budget
    const matrixTotal = motive.budgetMatrix.reduce(
      (sum, entry) => sum + toNumber(entry.amount),
      0
    );
    const budget =
      motive.budgetMatrix.length > 0 ? matrixTotal : toNumber(motive.budget);

    const spent = spendingByMotiveId.get(motive.id) ?? 0;
    return buildSpendingItem(motive.id, motive.name, budget, spent, 'normal');
  });

  // 5. Unallocated row: bills with NO motive allocations at all
  const unallocatedBills = await prisma.bill.findMany({
    where: {
      projectId,
      ...CONFIRMED_BILL_FILTER,
      motives: { none: {} },
    },
    select: { brutto19: true, brutto7: true, brutto0: true },
  });

  const unallocatedSpent = unallocatedBills.reduce(
    (sum, b) => sum + toNumber(b.brutto19) + toNumber(b.brutto7) + toNumber(b.brutto0),
    0
  );
  if (unallocatedSpent > 0) {
    items.push({
      id: null,
      name: '(unallocated)',
      budget: 0,
      spent: unallocatedSpent,
      remaining: -unallocatedSpent,
      percentUsed: null,
      status: 'unallocated',
    });
  }

  return items;
}

// ---------------------------------------------------------------------------
// getSpendingByCategory
// ---------------------------------------------------------------------------

/**
 * Returns spending aggregated by category for the given project.
 *
 * Budget source priority:
 *   1. Sum of BudgetMatrix.amount for the category (if any matrix entries exist)
 *   2. Category.budget fallback
 *
 * Spending = SUM((bill.brutto19 + bill.brutto7 + bill.brutto0) * billCategory.percentage / 100)
 *   over confirmed bills only.
 *
 * An "(unallocated)" row is appended when bills exist with no category
 * allocations at all.
 */
export async function getSpendingByCategory(projectId: string): Promise<SpendingItem[]> {
  // 1. Fetch all categories for the project
  const categories = await prisma.category.findMany({
    where: { projectId },
    orderBy: { name: 'asc' },
    include: {
      budgetMatrix: {
        where: { projectId },
        select: { amount: true },
      },
    },
  });

  // 2. Fetch all BillCategory records for confirmed bills in this project
  const billCategories = await prisma.billCategory.findMany({
    where: {
      bill: {
        projectId,
        ...CONFIRMED_BILL_FILTER,
      },
    },
    select: {
      categoryId: true,
      percentage: true,
      bill: {
        select: { brutto19: true, brutto7: true, brutto0: true },
      },
    },
  });

  // 3. Aggregate spending per categoryId (using total brutto = brutto19 + brutto7 + brutto0)
  const spendingByCategoryId = new Map<string, number>();
  for (const bc of billCategories) {
    const totalBrutto =
      toNumber(bc.bill.brutto19) + toNumber(bc.bill.brutto7) + toNumber(bc.bill.brutto0);
    const allocated = totalBrutto * toNumber(bc.percentage) / 100;
    spendingByCategoryId.set(
      bc.categoryId,
      (spendingByCategoryId.get(bc.categoryId) ?? 0) + allocated
    );
  }

  // 4. Build result rows — one per category
  const items: SpendingItem[] = categories.map((category) => {
    // Budget: prefer sum of matrix entries, fall back to category.budget
    const matrixTotal = category.budgetMatrix.reduce(
      (sum, entry) => sum + toNumber(entry.amount),
      0
    );
    const budget =
      category.budgetMatrix.length > 0
        ? matrixTotal
        : toNumber(category.budget);

    const spent = spendingByCategoryId.get(category.id) ?? 0;
    return buildSpendingItem(
      category.id,
      category.name,
      budget,
      spent,
      'normal'
    );
  });

  // 5. Unallocated row: bills with NO category allocations at all
  const unallocatedBills = await prisma.bill.findMany({
    where: {
      projectId,
      ...CONFIRMED_BILL_FILTER,
      categories: { none: {} },
    },
    select: { brutto19: true, brutto7: true, brutto0: true },
  });

  const unallocatedSpent = unallocatedBills.reduce(
    (sum, b) => sum + toNumber(b.brutto19) + toNumber(b.brutto7) + toNumber(b.brutto0),
    0
  );
  if (unallocatedSpent > 0) {
    items.push({
      id: null,
      name: '(unallocated)',
      budget: 0,
      spent: unallocatedSpent,
      remaining: -unallocatedSpent,
      percentUsed: null,
      status: 'unallocated',
    });
  }

  return items;
}

// ---------------------------------------------------------------------------
// getSpendingTotals
// ---------------------------------------------------------------------------

/**
 * Computes grand totals from an array of SpendingItems.
 * Sums budget, spent, and remaining; derives overall percentUsed.
 */
export function getSpendingTotals(items: SpendingItem[]): SpendingTotals {
  let totalBudget = 0;
  let totalSpent = 0;

  for (const item of items) {
    totalBudget += item.budget;
    totalSpent += item.spent;
  }

  const totalRemaining = totalBudget - totalSpent;
  const percentUsed = calcPercentUsed(totalSpent, totalBudget);

  return {
    budget: totalBudget,
    spent: totalSpent,
    remaining: totalRemaining,
    percentUsed,
  };
}
