// ============================================================================
// V-Geld — Server-Side Balance Aggregation
//
// Single source of truth for "received vs. spent" so the dashboard, sidebar
// balance, analysis table and reports all agree:
//   received = confirmed V-Geld transfers (confirmedBy IS NOT NULL)
//   spent    = brutto19 + brutto7 + brutto0 of bills in SPENDING_BILL_STATUSES
// Sums are computed in the database; only the aggregates are converted to
// numbers and rounded to cents.
// ============================================================================

import { db as prisma } from '@/lib/db';
import { BillStatus } from '@prisma/client';
import { SPENDING_BILL_STATUSES, roundCents } from '@/lib/spending';

const SPENDING_STATUS_FILTER = {
  in: SPENDING_BILL_STATUSES as unknown as BillStatus[],
};

export interface VgeldUserSummary {
  user: string;
  received: number;
  spent: number;
  remaining: number;
  percentUsed: number;
}

function sumBrutto(sum: { brutto19: unknown; brutto7: unknown; brutto0: unknown }): number {
  return Number(sum.brutto19 ?? 0) + Number(sum.brutto7 ?? 0) + Number(sum.brutto0 ?? 0);
}

/**
 * Current V-Geld balance (received − spent) of one user in one project.
 */
export async function getVgeldBalance(projectId: string, userEmail: string): Promise<number> {
  const [received, spent] = await Promise.all([
    prisma.vgeld.aggregate({
      where: { projectId, toUser: userEmail, confirmedBy: { not: null } },
      _sum: { amount: true },
    }),
    prisma.bill.aggregate({
      where: { projectId, submittedByEmail: userEmail, status: SPENDING_STATUS_FILTER },
      _sum: { brutto19: true, brutto7: true, brutto0: true },
    }),
  ]);

  return roundCents(Number(received._sum.amount ?? 0) - sumBrutto(spent._sum));
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
    prisma.bill.groupBy({
      by: ['submittedByEmail'],
      where: { projectId, status: SPENDING_STATUS_FILTER },
      _sum: { brutto19: true, brutto7: true, brutto0: true },
    }),
  ]);

  const receivedMap = new Map<string, number>(
    vgeldGroups.map((g) => [g.toUser, Number(g._sum.amount ?? 0)])
  );
  const spentMap = new Map<string, number>(
    billGroups.map((g) => [g.submittedByEmail, sumBrutto(g._sum)])
  );

  const allUsers = new Set<string>([...receivedMap.keys(), ...spentMap.keys()]);

  return Array.from(allUsers)
    .map((user) => {
      const received = roundCents(receivedMap.get(user) ?? 0);
      const spent = roundCents(spentMap.get(user) ?? 0);
      return {
        user,
        received,
        spent,
        remaining: roundCents(received - spent),
        percentUsed: received > 0 ? (spent / received) * 100 : 0,
      };
    })
    .sort((a, b) => a.user.localeCompare(b.user));
}
