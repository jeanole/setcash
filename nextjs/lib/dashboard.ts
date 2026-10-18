// ============================================================================
// Dashboard — Server-Side Data Aggregation
//
// Used directly in Server Components (no API route needed).
// Role-aware: admin/owner see project-wide data; user sees own data only.
// ============================================================================

import { db as prisma } from '@/lib/db';
import { getVgeldBalance } from '@/lib/vgeld';
import { roundCents } from '@/lib/spending';
import { calculateTotal } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DashboardStats {
  /** Admin/owner: all pending project bills. User: own pending + draft bills. */
  pendingBillsCount: number;
  /** Bills created this calendar month (role-scoped). */
  monthlyBillsCount: number;
  /** V-Geld balance: confirmed transfers received − spent (see lib/vgeld.ts). */
  vgeldBalance: number;
}

export interface RecentBill {
  id: string;
  date: string;
  vendor: string | null;
  brutto19: number;
  brutto7: number;
  brutto0: number;
  /** Bill total per calculateTotal(): brutto sum, or grossAmount when that sum is 0. */
  total: number;
  status: string;
}

// ---------------------------------------------------------------------------
// getDashboardStats
// ---------------------------------------------------------------------------

export async function getDashboardStats(
  projectId: string,
  userEmail: string,
  projectRole: 'user' | 'admin' | 'owner' | null
): Promise<DashboardStats> {
  const isAdminOrOwner = projectRole === 'admin' || projectRole === 'owner';

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [pendingBillsCount, monthlyBillsCount, vgeldBalance] =
    await Promise.all([
      // Pending count — role-scoped
      prisma.bill.count({
        where: isAdminOrOwner
          ? { projectId, status: 'pending' }
          : {
              projectId,
              submittedByEmail: userEmail,
              status: { in: ['pending', 'draft'] },
            },
      }),

      // Monthly count — role-scoped
      prisma.bill.count({
        where: isAdminOrOwner
          ? { projectId, createdAt: { gte: startOfMonth } }
          : {
              projectId,
              submittedByEmail: userEmail,
              createdAt: { gte: startOfMonth },
            },
      }),

      // Same balance calculation as /api/vgeld/balance
      getVgeldBalance(projectId, userEmail),
    ]);

  return {
    pendingBillsCount,
    monthlyBillsCount,
    vgeldBalance,
  };
}

// ---------------------------------------------------------------------------
// getRecentBills
// ---------------------------------------------------------------------------

export async function getRecentBills(
  projectId: string,
  userEmail: string,
  projectRole: 'user' | 'admin' | 'owner' | null,
  limit: number
): Promise<RecentBill[]> {
  const isAdminOrOwner = projectRole === 'admin' || projectRole === 'owner';

  const bills = await prisma.bill.findMany({
    where: isAdminOrOwner
      ? { projectId }
      : { projectId, submittedByEmail: userEmail },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      date: true,
      vendor: true,
      brutto19: true,
      brutto7: true,
      brutto0: true,
      grossAmount: true,
      status: true,
    },
  });

  return bills.map((b) => ({
    id: b.id,
    date: b.date.toISOString(),
    vendor: b.vendor,
    brutto19: Number(b.brutto19),
    brutto7: Number(b.brutto7),
    brutto0: Number(b.brutto0),
    total: roundCents(
      calculateTotal(Number(b.brutto19), Number(b.brutto7), Number(b.brutto0), Number(b.grossAmount))
    ),
    status: b.status,
  }));
}
