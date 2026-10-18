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
import type { GrossOnlySummary } from '@/lib/types';

type Dec = Prisma.Decimal;

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

/*
 * Policy: a bill counts as "real spending" when its status is one of
 * {confirmed, approved, paid}. Bills with status {draft, pending, rejected}
 * are excluded from all spending and budget calculations.
 *
 * EC-6: Deleted motives/categories are not shown because Prisma CASCADE deletes
 * remove allocation records from BillMotive/BillCategory when a motive/category
 * is deleted. Soft-delete would be needed to support the "(deleted)" row variant.
 */

function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const n = Number(value);
  return isNaN(n) ? 0 : n;
}

/** Converts a DB value (Decimal / string / number / null) to an exact Decimal. */
function toDec(value: unknown): Dec {
  if (value === null || value === undefined) return new Prisma.Decimal(0);
  try {
    const d = new Prisma.Decimal(value as Prisma.Decimal.Value);
    return d.isFinite() ? d : new Prisma.Decimal(0);
  } catch {
    return new Prisma.Decimal(0);
  }
}

/** Rounds an exact amount to whole cents (half away from zero). */
function roundDec(value: Dec): number {
  return Number(value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP));
}

/**
 * Round a monetary amount to whole cents (half away from zero). The number is
 * rounded through its shortest decimal representation, so 49.995 becomes 50.00
 * and 1.005 becomes 1.01 instead of drifting with IEEE-754 (`x * 100`).
 * Callers that add several amounts should sum first and round once.
 */
export function roundCents(value: number): number {
  if (!Number.isFinite(value)) return value;
  return roundDec(new Prisma.Decimal(value));
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
export const SPENDING_STATUS_SQL = Prisma.raw(
  SPENDING_BILL_STATUSES.map((s) => `'${s}'::"BillStatus"`).join(', ')
);

/**
 * SQL equivalent of `calculateTotal(brutto19, brutto7, brutto0, grossAmount)`
 * from lib/utils.ts: the brutto sum if it is > 0, otherwise `grossAmount`
 * (what OCR writes for receipts without a VAT breakdown). The bill table must
 * be aliased `b`. Netto always stays `b."nettoAmount"`.
 */
export const BILL_TOTAL_SQL = Prisma.raw(
  `CASE WHEN b.brutto19 + b.brutto7 + b.brutto0 > 0 ` +
    `THEN b.brutto19 + b.brutto7 + b.brutto0 ELSE b."grossAmount" END`
);

/**
 * Spending bills that only carry `grossAmount` (all brutto fields 0, e.g. OCR
 * receipts without a VAT breakdown). Their `nettoAmount` is 0, so they add
 * nothing to any netto figure. We do NOT invent a netto value; screens and
 * exports that show netto figures use this to say how many bills (and how much
 * brutto) are not included.
 *
 * Counts bills with a spending status (see SPENDING_BILL_STATUSES) whose
 * brutto19 + brutto7 + brutto0 = 0 and grossAmount > 0. `grossSum` is the exact
 * sum of their grossAmount, rounded once to cents. With `userEmail` only that
 * user's bills are counted (matched case-insensitively, like
 * getUserSpendingSummary).
 */
export async function getGrossOnlySummary(
  projectId: string,
  userEmail?: string
): Promise<GrossOnlySummary> {
  const rows = await prisma.$queryRaw<{ count: unknown; gross_sum: unknown }[]>(Prisma.sql`
    SELECT COUNT(*) AS count, COALESCE(SUM(b."grossAmount"), 0) AS gross_sum
    FROM "Bill" b
    WHERE b."projectId" = ${projectId}
      AND b.status IN (${SPENDING_STATUS_SQL})
      AND b.brutto19 + b.brutto7 + b.brutto0 = 0
      AND b."grossAmount" > 0
      ${userEmail !== undefined ? Prisma.sql`AND LOWER(b."submittedByEmail") = LOWER(${userEmail})` : Prisma.empty}
  `);
  return {
    count: toNumber(rows[0]?.count),
    grossSum: roundDec(toDec(rows[0]?.gross_sum)),
  };
}

/**
 * One-line note for exports that show netto figures, or null when no such
 * bills exist. Plain text (no leading formula characters).
 */
export function grossOnlyNote(summary: GrossOnlySummary): string | null {
  if (summary.count <= 0) return null;
  const bills = summary.count === 1 ? '1 counted bill has' : `${summary.count} counted bills have`;
  return (
    `Note: ${bills} no VAT breakdown (only a gross amount, ${summary.grossSum.toFixed(2)} EUR brutto). ` +
    'Netto is 0 for these bills, so they are not included in the netto figures.'
  );
}

interface AllocationSums {
  brutto: Dec;
  netto: Dec;
}

/**
 * Unrounded sums behind each SpendingItem, so getSpendingTotals() can add the
 * exact values and round once instead of adding already-rounded rows (which
 * drifts by a cent, e.g. 49.995 -> 50.00 per row). Keyed by item object; not
 * part of the serialised item.
 */
const exactSums = new WeakMap<SpendingItem, AllocationSums>();

/**
 * Aggregates percentage-weighted spending per allocation target in the
 * database (one GROUP BY row per motive/category) instead of loading every
 * allocation + bill row. Returns exact NUMERIC sums.
 */
async function sumAllocations(
  projectId: string,
  kind: 'motive' | 'category'
): Promise<Map<string, AllocationSums>> {
  const rows = kind === 'motive'
    ? await prisma.$queryRaw<{ id: string; brutto: unknown; netto: unknown }[]>(Prisma.sql`
        SELECT a."motiveId" AS id,
          SUM((${BILL_TOTAL_SQL}) * a.percentage / 100) AS brutto,
          SUM(b."nettoAmount" * a.percentage / 100) AS netto
        FROM "BillMotive" a
        JOIN "Bill" b ON b.id = a."billId"
        WHERE b."projectId" = ${projectId}
          AND b.status IN (${SPENDING_STATUS_SQL})
        GROUP BY a."motiveId"
      `)
    : await prisma.$queryRaw<{ id: string; brutto: unknown; netto: unknown }[]>(Prisma.sql`
        SELECT a."categoryId" AS id,
          SUM((${BILL_TOTAL_SQL}) * a.percentage / 100) AS brutto,
          SUM(b."nettoAmount" * a.percentage / 100) AS netto
        FROM "BillCategory" a
        JOIN "Bill" b ON b.id = a."billId"
        WHERE b."projectId" = ${projectId}
          AND b.status IN (${SPENDING_STATUS_SQL})
        GROUP BY a."categoryId"
      `);

  return new Map(
    rows.map((r) => [r.id, { brutto: toDec(r.brutto), netto: toDec(r.netto) }])
  );
}

/**
 * Brutto/netto totals of spending bills that have no allocation of the given
 * kind at all (unrounded).
 */
async function sumUnallocated(
  projectId: string,
  kind: 'motive' | 'category'
): Promise<AllocationSums> {
  const rows = kind === 'motive'
    ? await prisma.$queryRaw<{ brutto: unknown; netto: unknown }[]>(Prisma.sql`
        SELECT SUM(${BILL_TOTAL_SQL}) AS brutto, SUM(b."nettoAmount") AS netto
        FROM "Bill" b
        WHERE b."projectId" = ${projectId}
          AND b.status IN (${SPENDING_STATUS_SQL})
          AND NOT EXISTS (SELECT 1 FROM "BillMotive" a WHERE a."billId" = b.id)
      `)
    : await prisma.$queryRaw<{ brutto: unknown; netto: unknown }[]>(Prisma.sql`
        SELECT SUM(${BILL_TOTAL_SQL}) AS brutto, SUM(b."nettoAmount") AS netto
        FROM "Bill" b
        WHERE b."projectId" = ${projectId}
          AND b.status IN (${SPENDING_STATUS_SQL})
          AND NOT EXISTS (SELECT 1 FROM "BillCategory" a WHERE a."billId" = b.id)
      `);

  return { brutto: toDec(rows[0]?.brutto), netto: toDec(rows[0]?.netto) };
}

/** Sum of the budget-matrix cells of one motive/category (exact, in cents). */
function sumBudget(amounts: unknown[]): number {
  return roundDec(amounts.reduce<Dec>((sum, a) => sum.plus(toDec(a)), new Prisma.Decimal(0)));
}

function buildSpendingItem(
  id: string,
  name: string,
  budget: number,
  sums: AllocationSums,
  itemStatus: 'normal' | 'deleted'
): SpendingItem {
  const spent = roundDec(sums.brutto);
  const item: SpendingItem = {
    id,
    name,
    budget,
    spent,
    nettoSpent: roundDec(sums.netto),
    remaining: roundCents(budget - spent),
    percentUsed: calcPercentUsed(spent, budget),
    status: itemStatus,
  };
  exactSums.set(item, sums);
  return item;
}

function buildUnallocatedItem(sums: AllocationSums): SpendingItem | null {
  const spent = roundDec(sums.brutto);
  const nettoSpent = roundDec(sums.netto);
  if (spent <= 0 && nettoSpent <= 0) return null;
  const item: SpendingItem = {
    id: null,
    name: '(unallocated)',
    budget: 0,
    spent,
    nettoSpent,
    remaining: 0 - spent,
    percentUsed: null,
    status: 'unallocated',
  };
  exactSums.set(item, sums);
  return item;
}

interface BudgetTarget {
  id: string;
  name: string;
  budget: unknown;
  budgetMatrix: { amount: unknown }[];
}

function buildItems(
  targets: BudgetTarget[],
  spending: Map<string, AllocationSums>,
  unallocated: AllocationSums
): SpendingItem[] {
  const zero = { brutto: new Prisma.Decimal(0), netto: new Prisma.Decimal(0) };
  const items = targets.map((t) => {
    // Budget: prefer sum of matrix entries, fall back to the item's own budget
    const budget =
      t.budgetMatrix.length > 0
        ? sumBudget(t.budgetMatrix.map((e) => e.amount))
        : roundCents(toNumber(t.budget));
    return buildSpendingItem(t.id, t.name, budget, spending.get(t.id) ?? zero, 'normal');
  });

  // Unallocated row: bills with NO allocations of this kind at all
  const unallocatedItem = buildUnallocatedItem(unallocated);
  if (unallocatedItem) items.push(unallocatedItem);
  return items;
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
 * Spending = SUM(billTotal * billMotive.percentage / 100) over bills with a
 * spending status, where billTotal is the calculateTotal() rule: the brutto
 * sum, or grossAmount when the brutto sum is 0 (see BILL_TOTAL_SQL).
 *
 * An "(unallocated)" row is appended when bills exist with no motive
 * allocations at all.
 */
export async function getSpendingByMotive(projectId: string): Promise<SpendingItem[]> {
  const [motives, spending, unallocated] = await Promise.all([
    prisma.motive.findMany({
      where: { projectId },
      orderBy: { name: 'asc' },
      include: { budgetMatrix: { where: { projectId }, select: { amount: true } } },
    }),
    sumAllocations(projectId, 'motive'),
    sumUnallocated(projectId, 'motive'),
  ]);

  return buildItems(motives, spending, unallocated);
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
 * Spending = SUM(billTotal * billCategory.percentage / 100), same billTotal
 * rule as getSpendingByMotive.
 *
 * An "(unallocated)" row is appended when bills exist with no category
 * allocations at all.
 */
export async function getSpendingByCategory(projectId: string): Promise<SpendingItem[]> {
  const [categories, spending, unallocated] = await Promise.all([
    prisma.category.findMany({
      where: { projectId },
      orderBy: { name: 'asc' },
      include: { budgetMatrix: { where: { projectId }, select: { amount: true } } },
    }),
    sumAllocations(projectId, 'category'),
    sumUnallocated(projectId, 'category'),
  ]);

  return buildItems(categories, spending, unallocated);
}

// ---------------------------------------------------------------------------
// getSpendingTotals
// ---------------------------------------------------------------------------

/**
 * Computes grand totals from an array of SpendingItems returned by
 * getSpendingByMotive/getSpendingByCategory.
 *
 * Spent/netto totals are added from the unrounded per-item sums and rounded
 * once, so they never drift from the true sum by summing per-row rounded
 * values. (Items that did not come from this module fall back to their
 * rounded values.)
 */
export function getSpendingTotals(items: SpendingItem[]): SpendingTotals {
  let totalBudget = new Prisma.Decimal(0);
  let totalSpent = new Prisma.Decimal(0);
  let totalNettoSpent = new Prisma.Decimal(0);

  for (const item of items) {
    const exact = exactSums.get(item);
    totalBudget = totalBudget.plus(toDec(item.budget));
    totalSpent = totalSpent.plus(exact ? exact.brutto : toDec(item.spent));
    totalNettoSpent = totalNettoSpent.plus(exact ? exact.netto : toDec(item.nettoSpent));
  }

  const budget = roundDec(totalBudget);
  const spent = roundDec(totalSpent);
  const nettoSpent = roundDec(totalNettoSpent);

  return {
    budget,
    spent,
    nettoSpent,
    remaining: roundCents(budget - spent),
    percentUsed: calcPercentUsed(spent, budget),
  };
}

// ---------------------------------------------------------------------------
// getBudgetMatrixSpending — budget page / GET /api/budget-matrix
// ---------------------------------------------------------------------------

/**
 * Per-motive / per-category / per-cell spending for the budget matrix, in
 * netto (`nettoAmount`) and brutto (calculateTotal rule). Cell keys are
 * `${categoryId}_${motiveId}`. Values are rounded to cents once per entry.
 */
export interface BudgetMatrixSpending {
  motiveSpending: Record<string, number>;
  categorySpending: Record<string, number>;
  cellSpending: Record<string, number>;
  motiveSpendingBrutto: Record<string, number>;
  categorySpendingBrutto: Record<string, number>;
  cellSpendingBrutto: Record<string, number>;
  /** Sum over all categories, rounded once (no per-row rounding drift) */
  categorySpendingTotal: number;
  categorySpendingBruttoTotal: number;
  /** Bills that are missing from every netto figure (gross-only, no VAT breakdown) */
  grossOnly: GrossOnlySummary;
}

export async function getBudgetMatrixSpending(projectId: string): Promise<BudgetMatrixSpending> {
  type Row = { motiveId?: string; categoryId?: string; netto: unknown; brutto: unknown };

  const [motiveRows, categoryRows, cellRows, grossOnly] = await Promise.all([
    prisma.$queryRaw<Row[]>(Prisma.sql`
      SELECT a."motiveId",
        SUM(b."nettoAmount" * a.percentage / 100) AS netto,
        SUM((${BILL_TOTAL_SQL}) * a.percentage / 100) AS brutto
      FROM "BillMotive" a
      JOIN "Bill" b ON b.id = a."billId"
      WHERE b."projectId" = ${projectId}
        AND b.status IN (${SPENDING_STATUS_SQL})
      GROUP BY a."motiveId"
    `),
    prisma.$queryRaw<Row[]>(Prisma.sql`
      SELECT a."categoryId",
        SUM(b."nettoAmount" * a.percentage / 100) AS netto,
        SUM((${BILL_TOTAL_SQL}) * a.percentage / 100) AS brutto
      FROM "BillCategory" a
      JOIN "Bill" b ON b.id = a."billId"
      WHERE b."projectId" = ${projectId}
        AND b.status IN (${SPENDING_STATUS_SQL})
      GROUP BY a."categoryId"
    `),
    prisma.$queryRaw<Row[]>(Prisma.sql`
      SELECT bm."motiveId", bc."categoryId",
        SUM(b."nettoAmount" * bm.percentage / 100 * bc.percentage / 100) AS netto,
        SUM((${BILL_TOTAL_SQL}) * bm.percentage / 100 * bc.percentage / 100) AS brutto
      FROM "BillMotive" bm
      JOIN "BillCategory" bc ON bc."billId" = bm."billId"
      JOIN "Bill" b ON b.id = bm."billId"
      WHERE b."projectId" = ${projectId}
        AND b.status IN (${SPENDING_STATUS_SQL})
      GROUP BY bm."motiveId", bc."categoryId"
    `),
    getGrossOnlySummary(projectId),
  ]);

  const result: BudgetMatrixSpending = {
    motiveSpending: {},
    categorySpending: {},
    cellSpending: {},
    motiveSpendingBrutto: {},
    categorySpendingBrutto: {},
    cellSpendingBrutto: {},
    categorySpendingTotal: 0,
    categorySpendingBruttoTotal: 0,
    grossOnly,
  };
  for (const r of motiveRows) {
    result.motiveSpending[r.motiveId!] = roundDec(toDec(r.netto));
    result.motiveSpendingBrutto[r.motiveId!] = roundDec(toDec(r.brutto));
  }
  let categoryNettoSum = new Prisma.Decimal(0);
  let categoryBruttoSum = new Prisma.Decimal(0);
  for (const r of categoryRows) {
    result.categorySpending[r.categoryId!] = roundDec(toDec(r.netto));
    result.categorySpendingBrutto[r.categoryId!] = roundDec(toDec(r.brutto));
    categoryNettoSum = categoryNettoSum.plus(toDec(r.netto));
    categoryBruttoSum = categoryBruttoSum.plus(toDec(r.brutto));
  }
  result.categorySpendingTotal = roundDec(categoryNettoSum);
  result.categorySpendingBruttoTotal = roundDec(categoryBruttoSum);
  for (const r of cellRows) {
    const key = `${r.categoryId}_${r.motiveId}`;
    result.cellSpending[key] = roundDec(toDec(r.netto));
    result.cellSpendingBrutto[key] = roundDec(toDec(r.brutto));
  }
  return result;
}

// ---------------------------------------------------------------------------
// getUserSpendingSummary — user PDF report summary
// ---------------------------------------------------------------------------

export interface UserSpendingSummary {
  /** Number of counted (spending-status) bills */
  count: number;
  brutto19: number;
  brutto7: number;
  brutto0: number;
  /** Sum of every counted bill's total (calculateTotal rule), rounded once */
  total: number;
  /** Part of `total` that has no VAT breakdown (bills with only grossAmount) */
  unsplit: number;
  /** nettoAmount of the bills without a VAT breakdown */
  unsplitNetto: number;
}

/**
 * Summary of one user's counted bills (status in SPENDING_BILL_STATUSES),
 * computed in the database. The user email is matched case-insensitively.
 */
export async function getUserSpendingSummary(
  projectId: string,
  userEmail: string
): Promise<UserSpendingSummary> {
  const rows = await prisma.$queryRaw<
    {
      count: unknown;
      b19: unknown;
      b7: unknown;
      b0: unknown;
      total: unknown;
      unsplit_netto: unknown;
    }[]
  >(Prisma.sql`
    SELECT COUNT(*) AS count,
      COALESCE(SUM(b.brutto19), 0) AS b19,
      COALESCE(SUM(b.brutto7), 0) AS b7,
      COALESCE(SUM(b.brutto0), 0) AS b0,
      COALESCE(SUM(${BILL_TOTAL_SQL}), 0) AS total,
      COALESCE(SUM(b."nettoAmount") FILTER (WHERE b.brutto19 + b.brutto7 + b.brutto0 <= 0), 0)
        AS unsplit_netto
    FROM "Bill" b
    WHERE b."projectId" = ${projectId}
      AND LOWER(b."submittedByEmail") = LOWER(${userEmail})
      AND b.status IN (${SPENDING_STATUS_SQL})
  `);

  const row = rows[0];
  const b19 = toDec(row?.b19);
  const b7 = toDec(row?.b7);
  const b0 = toDec(row?.b0);
  const total = toDec(row?.total);
  return {
    count: toNumber(row?.count),
    brutto19: roundDec(b19),
    brutto7: roundDec(b7),
    brutto0: roundDec(b0),
    total: roundDec(total),
    unsplit: roundDec(total.minus(b19).minus(b7).minus(b0)),
    unsplitNetto: roundDec(toDec(row?.unsplit_netto)),
  };
}

// ---------------------------------------------------------------------------
// getBudgetMatrixExportRows — Excel / Google-Sheets "Budget Matrix" tab
// ---------------------------------------------------------------------------

/**
 * Rows of the exported "Budget Matrix" sheet:
 *   header, one row per category, [(unallocated) row], Total row, Spent row.
 * The Spent column/row are BRUTTO and come from getSpendingByCategory /
 * getSpendingByMotive, so they equal /api/spending and the spending page
 * (status confirmed/approved/paid, calculateTotal rule, rounded to cents).
 * The grand "Spent" figure is the category-tab total of /api/spending.
 */
export async function getBudgetMatrixExportRows(
  projectId: string
): Promise<(string | number)[][]> {
  const [motivesRaw, categoriesRaw, matrixCells, motiveItems, categoryItems] = await Promise.all([
    prisma.motive.findMany({ where: { projectId }, select: { id: true, name: true }, orderBy: { id: 'asc' } }),
    prisma.category.findMany({ where: { projectId }, select: { id: true, name: true }, orderBy: { id: 'asc' } }),
    prisma.budgetMatrix.findMany({
      where: { projectId },
      select: { motiveId: true, categoryId: true, amount: true },
    }),
    getSpendingByMotive(projectId),
    getSpendingByCategory(projectId),
  ]);

  const motives = [...motivesRaw].sort((a, b) => {
    if (a.name === 'Default') return -1;
    if (b.name === 'Default') return 1;
    return 0;
  });
  const categories = [...categoriesRaw].sort((a, b) => {
    if (a.name === 'Uncategorized') return -1;
    if (b.name === 'Uncategorized') return 1;
    return 0;
  });

  const matrix = new Map<string, Dec>();
  for (const cell of matrixCells) {
    matrix.set(`${cell.categoryId}_${cell.motiveId}`, toDec(cell.amount));
  }
  const cell = (categoryId: string, motiveId: string): Dec =>
    matrix.get(`${categoryId}_${motiveId}`) ?? new Prisma.Decimal(0);

  const motiveSpent = new Map(motiveItems.filter((i) => i.id).map((i) => [i.id as string, i.spent]));
  const categorySpent = new Map(categoryItems.filter((i) => i.id).map((i) => [i.id as string, i.spent]));
  const unallocatedCategory = categoryItems.find((i) => i.id === null);

  const rows: (string | number)[][] = [
    ['Category \\ Motive', ...motives.map((m) => m.name), 'Total Budget', 'Spent (brutto)'],
  ];

  let grandBudget = new Prisma.Decimal(0);
  for (const cat of categories) {
    let rowTotal = new Prisma.Decimal(0);
    const row: (string | number)[] = [cat.name];
    for (const mot of motives) {
      const val = cell(cat.id, mot.id);
      row.push(roundDec(val));
      rowTotal = rowTotal.plus(val);
    }
    grandBudget = grandBudget.plus(rowTotal);
    row.push(roundDec(rowTotal), categorySpent.get(cat.id) ?? 0);
    rows.push(row);
  }

  if (unallocatedCategory) {
    rows.push([
      unallocatedCategory.name,
      ...motives.map(() => 0),
      0,
      unallocatedCategory.spent,
    ]);
  }

  const grandSpent = getSpendingTotals(categoryItems).spent;

  const totalRow: (string | number)[] = ['Total'];
  for (const mot of motives) {
    let colTotal = new Prisma.Decimal(0);
    for (const cat of categories) colTotal = colTotal.plus(cell(cat.id, mot.id));
    totalRow.push(roundDec(colTotal));
  }
  totalRow.push(roundDec(grandBudget), grandSpent);
  rows.push(totalRow);

  const spentRow: (string | number)[] = ['Spent (brutto)'];
  for (const mot of motives) spentRow.push(motiveSpent.get(mot.id) ?? 0);
  spentRow.push(grandSpent, '');
  rows.push(spentRow);

  return rows;
}
