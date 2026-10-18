// ============================================================================
// Shared helpers for the bills API routes
// ============================================================================
// Lives in a private (_-prefixed) folder, so Next.js does not treat it as a route.
// ============================================================================

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { db as prisma } from '@/lib/db';
import { insensitiveEquals } from '@/lib/db-match';

// Small float slack for allocation-sum validation
export const ALLOCATION_SUM_EPSILON = 0.01;

// Max allocations per bill (motives / categories each)
const MAX_ALLOCATIONS = 50;

// Bills in these states are financially locked
export const LOCKED_BILL_STATUSES = ['approved', 'paid'] as const;

// Max images per bill
export const MAX_IMAGES_PER_BILL = 10;

// ---------------------------------------------------------------------------
// Field validation shared by POST /api/bills and PUT /api/bills/[id]
// ---------------------------------------------------------------------------

// Sanity cap for a single brutto amount (EUR)
export const MAX_BRUTTO_AMOUNT = 1_000_000;

// A plain decimal with at most two fraction digits: no sign, hex, exponent or spaces
export const PLAIN_AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;

/** Numeric amount: 0 <= x <= 1e6, whole cents */
export const bruttoAmountSchema = z.number().min(0).max(MAX_BRUTTO_AMOUNT).multipleOf(0.01);

/** Free-text bill fields with their maximum lengths (trimmed where the POST trims) */
export const billTextSchemas = {
  type: z.string().trim().max(100),
  vendor: z.string().trim().max(200),
  item: z.string().trim().max(500),
  comment: z.string().max(2000),
};

// ---------------------------------------------------------------------------
// Allocation validation
// ---------------------------------------------------------------------------

const percentageSchema = z.number().min(0).max(100);

function refineAllocations<T extends { percentage: number }>(
  label: string,
  idOf: (a: T) => string
) {
  return (items: T[], ctx: z.RefinementCtx) => {
    const ids = items.map(idOf);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: 'custom', message: `Duplicate ${label} in allocations` });
    }
    const sum = items.reduce((acc, a) => acc + a.percentage, 0);
    if (sum > 100 + ALLOCATION_SUM_EPSILON) {
      ctx.addIssue({
        code: 'custom',
        message: `${label[0].toUpperCase()}${label.slice(1)} allocations sum to more than 100%`,
      });
    }
  };
}

export const motiveAllocationsSchema = z
  .array(z.object({ motiveId: z.string().min(1).max(100), percentage: percentageSchema }))
  .max(MAX_ALLOCATIONS)
  .superRefine(refineAllocations('motive', (a) => a.motiveId));

export const categoryAllocationsSchema = z
  .array(z.object({ categoryId: z.string().min(1).max(100), percentage: percentageSchema }))
  .max(MAX_ALLOCATIONS)
  .superRefine(refineAllocations('category', (a) => a.categoryId));

/** Thrown when an allocation references a motive/category outside the project. */
export class InvalidAllocationError extends Error {
  constructor() {
    super('Invalid motive/category for this project');
    this.name = 'InvalidAllocationError';
  }
}

// ---------------------------------------------------------------------------
// Authorization helper
// ---------------------------------------------------------------------------

/**
 * DB-backed admin check (superadmin, or project admin/owner) that, unlike
 * verifyAdminRole, has no side effects — it never clears the session cookie.
 * Use it for "is this caller allowed to do the privileged thing?" decisions
 * where a non-admin caller (e.g. the bill's submitter) is a normal case.
 */
export async function isDbVerifiedAdmin(email: string, projectId: string): Promise<boolean> {
  const [user, membership] = await Promise.all([
    prisma.user.findUnique({ where: { email }, select: { isSuperAdmin: true } }),
    prisma.projectMember.findUnique({
      where: { projectId_userEmail: { projectId, userEmail: email } },
      select: { role: true },
    }),
  ]);
  return !!user?.isSuperAdmin || membership?.role === 'admin' || membership?.role === 'owner';
}

/**
 * Receipt images of approved/paid bills are evidence for the approval and must
 * not change afterwards — except by a DB-verified admin. Returns a 403 response
 * when the caller may not modify the images of a bill in `status`, else null.
 */
export async function imageEditLockResponse(
  status: string,
  email: string,
  projectId: string
): Promise<NextResponse | null> {
  if (!(LOCKED_BILL_STATUSES as readonly string[]).includes(status)) return null;
  if (await isDbVerifiedAdmin(email, projectId)) return null;
  return NextResponse.json(
    { error: `Images of a bill with status '${status}' can only be changed by an admin` },
    { status: 403 }
  );
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

/**
 * Run `fn` in a Serializable transaction, retrying on serialization failures
 * (Prisma P2034) so concurrent requests don't surface as spurious 500s.
 */
export async function runSerializable<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  attempts = 6
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await prisma.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      // Matched by code (not instanceof) so it also works across duplicated module instances
      const isSerializationFailure = (error as { code?: unknown } | null)?.code === 'P2034';
      if (!isSerializationFailure || attempt >= attempts) throw error;
      // Randomised backoff so competing retries don't collide again in lockstep
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 25 * attempt));
    }
  }
}

// ---------------------------------------------------------------------------
// Bill numbers
// ---------------------------------------------------------------------------

/** Ordinal (1-based) of a `G.PP` bill number: 1.01 -> 1, 1.20 -> 20, 2.01 -> 21. Null if not that format. */
export function billNumberOrdinal(billNumber: string | null | undefined): number | null {
  const match = /^(\d{1,6})\.(\d{2})$/.exec(billNumber ?? '');
  if (!match) return null;
  return (Number(match[1]) - 1) * 20 + Number(match[2]);
}

/**
 * Next bill number for a user within a project (1.01-1.20, 2.01-2.20, ...).
 *
 * A persistent per-(project, user) counter hands out the numbers, so deleting a
 * bill — even the one with the highest number — can never free a number that
 * was already issued (it is referenced by audit logs and exports). As a safety
 * net the result is also never lower than the highest number still in use
 * (covers bills created before the counter existed or imported with numbers).
 * Call inside a Serializable transaction to stay unique under concurrency.
 */
export async function nextBillNumber(
  tx: Prisma.TransactionClient,
  userEmail: string,
  projectId: string
): Promise<string> {
  const counterEmail = userEmail.toLowerCase();

  const existing = await tx.bill.findMany({
    where: {
      submittedByEmail: insensitiveEquals(userEmail),
      projectId,
      billNumber: { not: null },
    },
    select: { billNumber: true },
  });

  let maxInUse = 0;
  for (const { billNumber } of existing) {
    const ordinal = billNumberOrdinal(billNumber);
    if (ordinal !== null && ordinal > maxInUse) maxInUse = ordinal;
  }

  // Atomic increment (creates the counter row on first use)
  const counter = await tx.billNumberCounter.upsert({
    where: { projectId_userEmail: { projectId, userEmail: counterEmail } },
    create: { projectId, userEmail: counterEmail, lastIndex: maxInUse + 1 },
    update: { lastIndex: { increment: 1 } },
    select: { lastIndex: true },
  });

  let ordinal = counter.lastIndex;
  if (ordinal <= maxInUse) {
    ordinal = maxInUse + 1;
    await tx.billNumberCounter.update({
      where: { projectId_userEmail: { projectId, userEmail: counterEmail } },
      data: { lastIndex: ordinal },
    });
  }

  const group = Math.floor((ordinal - 1) / 20) + 1;
  const position = ((ordinal - 1) % 20) + 1;
  return `${group}.${position.toString().padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Allocations
// ---------------------------------------------------------------------------

interface AllocationRow {
  id: string;
  name: string;
  percentage: number;
}

// Merge the explicit allocations and top up with the default entry so the total is 100
function buildRows(
  allocations: { id: string; percentage: number }[],
  names: Map<string, string>,
  fallback: { id: string; name: string } | null
): AllocationRow[] {
  const rows = new Map<string, number>();
  let total = 0;
  for (const a of allocations) {
    if (a.percentage > 0) {
      rows.set(a.id, (rows.get(a.id) ?? 0) + a.percentage);
      total += a.percentage;
    }
  }

  if (fallback) {
    if (allocations.length === 0) {
      // No allocations: 100% to the default
      rows.set(fallback.id, 100);
    } else {
      const remainder = Math.round((100 - total) * 100) / 100;
      if (remainder > 0) {
        rows.set(fallback.id, (rows.get(fallback.id) ?? 0) + remainder);
      }
    }
  }

  return [...rows.entries()].map(([id, percentage]) => ({
    id,
    name: names.get(id) ?? fallback?.name ?? '',
    percentage,
  }));
}

/**
 * Replace a bill's motive/category allocations. Runs on the given client so the
 * caller can make it part of a transaction.
 *
 * Throws InvalidAllocationError if any motiveId/categoryId does not belong to
 * the project (tampering or a client bug — must not be silently dropped).
 * Returns the legacy motive display string for `Bill.motiveLegacy`.
 */
export async function saveAllocations(
  tx: Prisma.TransactionClient,
  billId: string,
  motiveAllocations: { motiveId: string; percentage: number }[],
  categoryAllocations: { categoryId: string; percentage: number }[],
  projectId: string
): Promise<string> {
  // Cross-project injection guard: batch-fetch the referenced rows scoped to this project
  const distinctMotiveIds = [...new Set(motiveAllocations.map((a) => a.motiveId))];
  const distinctCategoryIds = [...new Set(categoryAllocations.map((a) => a.categoryId))];

  const [motives, categories, uncatMotive, uncatCategory] = await Promise.all([
    distinctMotiveIds.length > 0
      ? tx.motive.findMany({
          where: { id: { in: distinctMotiveIds }, projectId },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    distinctCategoryIds.length > 0
      ? tx.category.findMany({
          where: { id: { in: distinctCategoryIds }, projectId },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    tx.motive.findFirst({ where: { name: 'Default', projectId }, select: { id: true, name: true } }),
    tx.category.findFirst({
      where: { name: 'Uncategorized', projectId },
      select: { id: true, name: true },
    }),
  ]);

  if (motives.length !== distinctMotiveIds.length || categories.length !== distinctCategoryIds.length) {
    throw new InvalidAllocationError();
  }

  const motiveRows = buildRows(
    motiveAllocations.map((a) => ({ id: a.motiveId, percentage: a.percentage })),
    new Map(motives.map((m) => [m.id, m.name])),
    uncatMotive
  );
  const categoryRows = buildRows(
    categoryAllocations.map((a) => ({ id: a.categoryId, percentage: a.percentage })),
    new Map(categories.map((c) => [c.id, c.name])),
    uncatCategory
  );

  await tx.billMotive.deleteMany({ where: { billId } });
  await tx.billCategory.deleteMany({ where: { billId } });

  if (motiveRows.length > 0) {
    await tx.billMotive.createMany({
      data: motiveRows.map((r) => ({ billId, motiveId: r.id, percentage: r.percentage })),
    });
  }
  if (categoryRows.length > 0) {
    await tx.billCategory.createMany({
      data: categoryRows.map((r) => ({ billId, categoryId: r.id, percentage: r.percentage })),
    });
  }

  if (motiveRows.length === 0) return '';
  if (motiveRows.length === 1 && motiveRows[0].percentage === 100) return motiveRows[0].name;
  return motiveRows.map((r) => `${r.name} (${r.percentage}%)`).join(', ');
}

/**
 * Canonical string of a bill's effective allocations, for "did the allocations
 * really change?" comparisons. The Default motive / Uncategorized category rows
 * are left out: saveAllocations derives them as the remainder up to 100%, so
 * they carry no information of their own.
 */
export async function readAllocationSnapshot(
  tx: Prisma.TransactionClient,
  billId: string
): Promise<string> {
  const [motives, categories] = await Promise.all([
    tx.billMotive.findMany({
      where: { billId },
      select: { motiveId: true, percentage: true, motive: { select: { name: true } } },
    }),
    tx.billCategory.findMany({
      where: { billId },
      select: { categoryId: true, percentage: true, category: { select: { name: true } } },
    }),
  ]);
  const m = motives
    .filter((r) => r.motive.name !== 'Default')
    .map((r) => `${r.motiveId}=${Number(r.percentage)}`)
    .sort();
  const c = categories
    .filter((r) => r.category.name !== 'Uncategorized')
    .map((r) => `${r.categoryId}=${Number(r.percentage)}`)
    .sort();
  return JSON.stringify([m, c]);
}

// ---------------------------------------------------------------------------
// Legacy columns
// ---------------------------------------------------------------------------

/**
 * Sync legacy bills.filename with the first image. The value written is the
 * server-generated storage path, never the client-supplied original filename:
 * the uploads route's legacy fallback authorizes file access via this column.
 */
export async function syncLegacyImageColumns(tx: Prisma.TransactionClient, billId: string) {
  const firstImage = await tx.billImage.findFirst({
    where: { billId },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    select: { filePath: true },
  });

  await tx.bill.update({
    where: { id: billId },
    data: { filename: firstImage?.filePath ?? '' },
  });
}
