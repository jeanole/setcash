// ============================================================================
// Spending Overview — Server-Side Data Fetching
//
// Used directly in Server Components (no API route needed).
// All queries are project-scoped and only include "real spending" bills:
// status IN (confirmed, approved, paid). Bills with status draft, pending,
// or rejected do NOT count toward spending or budget calculations.
// ============================================================================

import { db as prisma } from '@/lib/db';
import { BillStatus } from '@prisma/client';

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
        select: { brutto19: true, brutto7: true, brutto0: true, nettoAmount: true },
      },
    },
  });

  // 3. Aggregate spending per motiveId (brutto and netto)
  const bruttoByMotiveId = new Map<string, number>();
  const nettoByMotiveId = new Map<string, number>();
  for (const bm of billMotives) {
    const pct = toNumber(bm.percentage);
    const totalBrutto =
      toNumber(bm.bill.brutto19) + toNumber(bm.bill.brutto7) + toNumber(bm.bill.brutto0);
    bruttoByMotiveId.set(bm.motiveId, (bruttoByMotiveId.get(bm.motiveId) ?? 0) + totalBrutto * pct / 100);
    nettoByMotiveId.set(bm.motiveId, (nettoByMotiveId.get(bm.motiveId) ?? 0) + toNumber(bm.bill.nettoAmount) * pct / 100);
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

    const spent = bruttoByMotiveId.get(motive.id) ?? 0;
    const nettoSpent = nettoByMotiveId.get(motive.id) ?? 0;
    return buildSpendingItem(motive.id, motive.name, budget, spent, nettoSpent, 'normal');
  });

  // 5. Unallocated row: bills with NO motive allocations at all
  const unallocatedBills = await prisma.bill.findMany({
    where: {
      projectId,
      ...CONFIRMED_BILL_FILTER,
      motives: { none: {} },
    },
    select: { brutto19: true, brutto7: true, brutto0: true, nettoAmount: true },
  });

  const unallocatedSpent = roundCents(unallocatedBills.reduce(
    (sum, b) => sum + toNumber(b.brutto19) + toNumber(b.brutto7) + toNumber(b.brutto0), 0
  ));
  const unallocatedNettoSpent = roundCents(unallocatedBills.reduce(
    (sum, b) => sum + toNumber(b.nettoAmount), 0
  ));
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
        select: { brutto19: true, brutto7: true, brutto0: true, nettoAmount: true },
      },
    },
  });

  // 3. Aggregate spending per categoryId (brutto and netto)
  const bruttoByCategoryId = new Map<string, number>();
  const nettoByCategoryId = new Map<string, number>();
  for (const bc of billCategories) {
    const pct = toNumber(bc.percentage);
    const totalBrutto =
      toNumber(bc.bill.brutto19) + toNumber(bc.bill.brutto7) + toNumber(bc.bill.brutto0);
    bruttoByCategoryId.set(bc.categoryId, (bruttoByCategoryId.get(bc.categoryId) ?? 0) + totalBrutto * pct / 100);
    nettoByCategoryId.set(bc.categoryId, (nettoByCategoryId.get(bc.categoryId) ?? 0) + toNumber(bc.bill.nettoAmount) * pct / 100);
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

    const spent = bruttoByCategoryId.get(category.id) ?? 0;
    const nettoSpent = nettoByCategoryId.get(category.id) ?? 0;
    return buildSpendingItem(category.id, category.name, budget, spent, nettoSpent, 'normal');
  });

  // 5. Unallocated row: bills with NO category allocations at all
  const unallocatedBills = await prisma.bill.findMany({
    where: {
      projectId,
      ...CONFIRMED_BILL_FILTER,
      categories: { none: {} },
    },
    select: { brutto19: true, brutto7: true, brutto0: true, nettoAmount: true },
  });

  const unallocatedSpent = roundCents(unallocatedBills.reduce(
    (sum, b) => sum + toNumber(b.brutto19) + toNumber(b.brutto7) + toNumber(b.brutto0), 0
  ));
  const unallocatedNettoSpent = roundCents(unallocatedBills.reduce(
    (sum, b) => sum + toNumber(b.nettoAmount), 0
  ));
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

  const totalRemaining = totalBudget - totalSpent;
  const percentUsed = calcPercentUsed(totalSpent, totalBudget);

  return {
    budget: totalBudget,
    spent: totalSpent,
    nettoSpent: totalNettoSpent,
    remaining: totalRemaining,
    percentUsed,
  };
}
