// ============================================================================
// Dashboard Page — CR-20
// Server Component: fetches data, passes to DashboardClient
// ============================================================================

import { Suspense } from 'react';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import {
  getSpendingByMotive,
  getSpendingByCategory,
  getSpendingTotals,
} from '@/lib/spending';
import { getDashboardStats, getRecentBills } from '@/lib/dashboard';
import DashboardClient from '@/components/dashboard/DashboardClient';
import DashboardSkeleton from '@/components/dashboard/DashboardSkeleton';

async function DashboardContent() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const { currentProjectId: projectId, currentProjectRole, currentProjectName } = session.user;
  const userEmail = session.user.email;

  // No project selected — show empty dashboard
  if (!projectId) {
    return (
      <DashboardClient
        projectName={null}
        stats={{ pendingBillsCount: 0, monthlyBillsCount: 0, vgeldBalance: 0 }}
        recentBills={[]}
        motiveItems={[]}
        categoryItems={[]}
        spendingTotals={{ budget: 0, spent: 0, nettoSpent: 0, remaining: 0, percentUsed: null }}
        projectRole={null}
      />
    );
  }

  const [motiveItems, categoryItems, stats, recentBills] = await Promise.all([
    getSpendingByMotive(projectId),
    getSpendingByCategory(projectId),
    getDashboardStats(projectId, userEmail, currentProjectRole),
    getRecentBills(projectId, userEmail, currentProjectRole, 5),
  ]);

  const spendingTotals = getSpendingTotals(motiveItems);

  return (
    <DashboardClient
      projectName={currentProjectName}
      stats={stats}
      recentBills={recentBills}
      motiveItems={motiveItems}
      categoryItems={categoryItems}
      spendingTotals={spendingTotals}
      projectRole={currentProjectRole}
    />
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
