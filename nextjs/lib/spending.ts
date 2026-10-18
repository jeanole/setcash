// ============================================================================
// Spending Overview — Server-Side Data Fetching
//
// Used directly in Server Components (no API route needed).
// All queries are project-scoped and only include "real spending" bills:
// status IN (confirmed, approved, paid). Bills with status draft, pending,
// or rejected do NOT count toward spending or budget calculations.
// ============================================================================

import { db as prisma } from '@/lib/db';
import { BillStatus, Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// Policy constant — single source of truth for "real spending" statuses
// ---------------------------------------------------------------------------

export const SPENDING_BILL_STATUSES = [
  BillStatus.confirmed,
  BillStatus.approved,
  BillStatus.paid,
] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SpendingItem {
  /** null for the "(unallocated)" synthetic row */
  id: string | null;
  name: string;
  budget: number;
  /** Total brutto (brutto19 + brutto7 + brutto0) allocated to this item */
  spent: number;
  /** Netto amount allocated to this item */
  nettoSpent: number;
  remaining: number;
  /** null when budget === 0 (avoid division by zero) */
  percentUsed: number | null;
  status: 'normal' | 'unallocated' | 'deleted';
}

export interface SpendingTotals {
  budget: number;
  spent: number;
  nettoSpent: number;
  remaining: number;
  /** null when total budget === 0 */
  percentUsed: number | null;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Prisma where-fragment used in all spending queries.
 * Policy: a bill counts as "real spending" when its status is one of
 * {confirmed, approved, paid}. Bills with status {draft, pending, rejected}
 * are excluded from all spending and budget calculations.
 *
 * EC-6: Deleted motives/categories are not shown because Prisma CASCADE deletes
 * remove allocation records from BillMotive/BillCategory when a motive/category
 * is deleted. Soft-delete would be needed to support the "(deleted)" row variant.
 */
const CONFIRMED_BILL_FILTER = {
  status: { in: SPENDING_BILL_STATUSES as unknown as BillStatus[] },
} as const;

function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const n = Number(value);
  return isNaN(n) ? 0 : n;
}

/**
 * Round a monetary amount to whole cents. Spending is accumulated in JS numbers
 * (after Decimal→Number conversion) with percentage splits, so intermediate
 * sums can carry IEEE-754 drift; rounding the aggregate to cents keeps reported
 * totals exact to two decimal places.
 */
export function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

function calcPercentUsed(spent: number, budget: number): number | null {
  if (budget === 0) return null;
  return (spent / budget) * 100;
}

/**
 * SQL fragment for "bill is real spending". SPENDING_BILL_STATUSES is a
 * compile-time constant (never user input), so the enum literals are inlined
 * rather than bound as parameters (bound text params cannot be compared to a
 * Postgres enum column).
 */
const SPENDING_STATUS_SQL = Prisma.raw(
  SPENDING_BILL_STATUSES.map((s) => `'${s}'::"BillStatus"`).join(', ')
);

interface AllocationSums {
  brutto: number;
  netto: number;
}

/**
 * Aggregates percentage-weighted spending per allocation target in the
 * database (one GROUP BY row per motive/category) instead of loading every
 * allocation + bill row. Returns exact NUMERIC sums converted to numbers.
 */
async function sumAllocations(
  projectId: string,
  kind: 'motive' | 'category'
): Promise<Map<string, AllocationSums>> {
  const rows = kind === 'motive'
    ? await prisma.$queryRaw<{ id: string; brutto: unknown; netto: unknown }[]>(Prisma.sql`
        SELECT a."motiveId" AS id,
          SUM((b.brutto19 + b.brutto7 + b.brutto0) * a.percentage / 100) AS brutto,
          SUM(b."nettoAmount" * a.percentage / 100) AS netto
        FROM "BillMotive" a
        JOIN "Bill" b ON b.id = a."billId"
        WHERE b."projectId" = ${projectId}
          AND b.status IN (${SPENDING_STATUS_SQL})
        GROUP BY a."motiveId"
      `)
    : await prisma.$queryRaw<{ id: string; brutto: unknown; netto: unknown }[]>(Prisma.sql`
        SELECT a."categoryId" AS id,
          SUM((b.brutto19 + b.brutto7 + b.brutto0) * a.percentage / 100) AS brutto,
          SUM(b."nettoAmount" * a.percentage / 100) AS netto
        FROM "BillCategory" a
        JOIN "Bill" b ON b.id = a."billId"
        WHERE b."projectId" = ${projectId}
          AND b.status IN (${SPENDING_STATUS_SQL})
        GROUP BY a."categoryId"
      `);

  return new Map(
    rows.map((r) => [r.id, { brutto: toNumber(r.brutto), netto: toNumber(r.netto) }])
  );
}

/**
 * Brutto/netto totals of spending bills that have no allocation of the given
 * kind at all. Returned rounded to cents.
 */
async function sumUnallocated(
  projectId: string,
  kind: 'motive' | 'category'
): Promise<AllocationSums> {
  const result = await prisma.bill.aggregate({
    where: {
      projectId,
      ...CONFIRMED_BILL_FILTER,
      ...(kind === 'motive' ? { motives: { none: {} } } : { categories: { none: {} } }),
    },
    _sum: { brutto19: true, brutto7: true, brutto0: true, nettoAmount: true },
  });

  return {
    brutto: roundCents(
      toNumber(result._sum.brutto19) + toNumber(result._sum.brutto7) + toNumber(result._sum.brutto0)
    ),
    netto: roundCents(toNumber(result._sum.nettoAmount)),
  };
}

function buildSpendingItem(
  id: string,
  name: string,
  budget: number,
  spent: number,
  nettoSpent: number,
  itemStatus: 'normal' | 'deleted'
): SpendingItem {
  const roundedSpent = roundCents(spent);
  const roundedNetto = roundCents(nettoSpent);
  const remaining = roundCents(budget - roundedSpent);
  return {
    id,
    name,
    budget,
    spent: roundedSpent,
    nettoSpent: roundedNetto,
    remaining,
    percentUsed: calcPercentUsed(roundedSpent, budget),
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

  // 2. Aggregate spending per motiveId (brutto and netto) in the database
  const spendingByMotiveId = await sumAllocations(projectId, 'motive');

  // 4. Build result rows — one per motive
  const items: SpendingItem[] = motives.map((motive) => {
    // Budget: prefer sum of matrix entries, fall back to motive.budget
    const matrixTotal = motive.budgetMatrix.reduce(
      (sum, entry) => sum + toNumber(entry.amount),
      0
    );
    const budget =
      motive.budgetMatrix.length > 0 ? matrixTotal : toNumber(motive.budget);

    const spent = spendingByMotiveId.get(motive.id)?.brutto ?? 0;
    const nettoSpent = spendingByMotiveId.get(motive.id)?.netto ?? 0;
    return buildSpendingItem(motive.id, motive.name, budget, spent, nettoSpent, 'normal');
  });

  // 5. Unallocated row: bills with NO motive allocations at all
  const { brutto: unallocatedSpent, netto: unallocatedNettoSpent } =
    await sumUnallocated(projectId, 'motive');
  if (unallocatedSpent > 0 || unallocatedNettoSpent > 0) {
    items.push({
      id: null,
      name: '(unallocated)',
      budget: 0,
      spent: unallocatedSpent,
      nettoSpent: unallocatedNettoSpent,
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

  // 2. Aggregate spending per categoryId (brutto and netto) in the database
  const spendingByCategoryId = await sumAllocations(projectId, 'category');

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

    const spent = spendingByCategoryId.get(category.id)?.brutto ?? 0;
    const nettoSpent = spendingByCategoryId.get(category.id)?.netto ?? 0;
    return buildSpendingItem(category.id, category.name, budget, spent, nettoSpent, 'normal');
  });

  // 5. Unallocated row: bills with NO category allocations at all
  const { brutto: unallocatedSpent, netto: unallocatedNettoSpent } =
    await sumUnallocated(projectId, 'category');
  if (unallocatedSpent > 0 || unallocatedNettoSpent > 0) {
    items.push({
      id: null,
      name: '(unallocated)',
      budget: 0,
      spent: unallocatedSpent,
      nettoSpent: unallocatedNettoSpent,
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
  let totalNettoSpent = 0;

  for (const item of items) {
    totalBudget += item.budget;
    totalSpent += item.spent;
    totalNettoSpent += item.nettoSpent;
  }

  totalBudget = roundCents(totalBudget);
  totalSpent = roundCents(totalSpent);
  totalNettoSpent = roundCents(totalNettoSpent);

  const totalRemaining = roundCents(totalBudget - totalSpent);
  const percentUsed = calcPercentUsed(totalSpent, totalBudget);

  return {
    budget: totalBudget,
    spent: totalSpent,
    nettoSpent: totalNettoSpent,
    remaining: totalRemaining,
    percentUsed,
  };
}
