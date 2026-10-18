// ============================================================================
// V-Geld — Server-Side Balance Aggregation
//
// Single source of truth for "received vs. spent" so the dashboard, sidebar
// balance, analysis table and reports all agree:
//   received = confirmed V-Geld transfers (confirmedBy IS NOT NULL)
//   spent    = bill total of bills in SPENDING_BILL_STATUSES, where the bill
//              total follows calculateTotal(): brutto19 + brutto7 + brutto0, or
//              grossAmount when that sum is 0 (e.g. OCR without VAT breakdown)
// Sums are computed in the database (exact NUMERIC); only the final aggregates
// are rounded to cents.
// ============================================================================

import { db as prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { SPENDING_STATUS_SQL, BILL_TOTAL_SQL, roundCents } from '@/lib/spending';

export interface VgeldUserSummary {
  user: string;
  received: number;
  spent: number;
  remaining: number;
  percentUsed: number;
}

function dec(value: unknown): Prisma.Decimal {
  if (value === null || value === undefined) return new Prisma.Decimal(0);
  return new Prisma.Decimal(value as Prisma.Decimal.Value);
}

/**
 * Current V-Geld balance (received − spent) of one user in one project.
 */
export async function getVgeldBalance(projectId: string, userEmail: string): Promise<number> {
  const [received, spentRows] = await Promise.all([
    prisma.vgeld.aggregate({
      where: { projectId, toUser: userEmail, confirmedBy: { not: null } },
      _sum: { amount: true },
    }),
    prisma.$queryRaw<{ spent: unknown }[]>(Prisma.sql`
      SELECT COALESCE(SUM(${BILL_TOTAL_SQL}), 0) AS spent
      FROM "Bill" b
      WHERE b."projectId" = ${projectId}
        AND b."submittedByEmail" = ${userEmail}
        AND b.status IN (${SPENDING_STATUS_SQL})
    `),
  ]);

  return roundCents(Number(dec(received._sum.amount).minus(dec(spentRows[0]?.spent))));
}

/**
 * Per-user V-Geld summary for a whole project, sorted by email.
 */
export async function getVgeldAnalysis(projectId: string): Promise<VgeldUserSummary[]> {
  const [vgeldGroups, billGroups] = await Promise.all([
    prisma.vgeld.groupBy({
      by: ['toUser'],
      where: { projectId, confirmedBy: { not: null } },
      _sum: { amount: true },
    }),
    prisma.$queryRaw<{ email: string; spent: unknown }[]>(Prisma.sql`
      SELECT b."submittedByEmail" AS email, SUM(${BILL_TOTAL_SQL}) AS spent
      FROM "Bill" b
      WHERE b."projectId" = ${projectId}
        AND b.status IN (${SPENDING_STATUS_SQL})
      GROUP BY b."submittedByEmail"
    `),
  ]);

  const receivedMap = new Map<string, Prisma.Decimal>(
    vgeldGroups.map((g) => [g.toUser, dec(g._sum.amount)])
  );
  const spentMap = new Map<string, Prisma.Decimal>(
    billGroups.map((g) => [g.email, dec(g.spent)])
  );

  const allUsers = new Set<string>([...receivedMap.keys(), ...spentMap.keys()]);
  const zero = new Prisma.Decimal(0);

  return Array.from(allUsers)
    .map((user) => {
      const receivedExact = receivedMap.get(user) ?? zero;
      const spentExact = spentMap.get(user) ?? zero;
      const received = roundCents(Number(receivedExact));
      const spent = roundCents(Number(spentExact));
      return {
        user,
        received,
        spent,
        remaining: roundCents(Number(receivedExact.minus(spentExact))),
        percentUsed: received > 0 ? (spent / received) * 100 : 0,
      };
    })
    .sort((a, b) => a.user.localeCompare(b.user));
}
