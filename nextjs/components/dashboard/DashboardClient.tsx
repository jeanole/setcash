'use client';

import dynamic from 'next/dynamic';
import KpiCard from '@/components/dashboard/KpiCard';
import RecentBillsList from '@/components/dashboard/RecentBillsList';
import QuickActions from '@/components/dashboard/QuickActions';
import type { DashboardStats, RecentBill } from '@/lib/dashboard';
import type { SpendingItem, SpendingTotals } from '@/lib/spending';
import { formatCurrency } from '@/lib/utils';
import {
  Receipt,
  Clock,
  Wallet,
  CalendarDays,
} from 'lucide-react';

// Lazy-load chart components to keep initial bundle small
const SpendingByMotiveChart = dynamic(
  () => import('@/components/dashboard/SpendingByMotiveChart'),
  { ssr: false }
);
const SpendingByCategoryChart = dynamic(
  () => import('@/components/dashboard/SpendingByCategoryChart'),
  { ssr: false }
);

interface DashboardClientProps {
  projectName: string | null;
  stats: DashboardStats;
  recentBills: RecentBill[];
  motiveItems: SpendingItem[];
  categoryItems: SpendingItem[];
  spendingTotals: SpendingTotals;
  projectRole: 'user' | 'admin' | 'owner' | null;
}

export default function DashboardClient({
  projectName,
  stats,
  recentBills,
  motiveItems,
  categoryItems,
  spendingTotals,
  projectRole,
}: DashboardClientProps) {
  const isAdminOrOwner = projectRole === 'admin' || projectRole === 'owner';
  const pendingLabel = isAdminOrOwner ? 'Pending Approvals' : 'My Open Bills';

  const budgetPercent = spendingTotals.percentUsed ?? 0;
  const barColor =
    budgetPercent >= 90 ? 'red' : budgetPercent >= 70 ? 'amber' : 'green';

  return (
    <div className="space-y-6 animate-[vb-rise_0.4s_ease-out]">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-slate-800">Dashboard</h1>
        {projectName && (
          <p className="text-sm text-slate-400 mt-0.5">{projectName}</p>
        )}
      </div>

      {/* KPI cards */}
      <section aria-label="Key metrics">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Budget Spent"
            value={formatCurrency(spendingTotals.spent)}
            subtitle={
              spendingTotals.budget > 0
                ? `of ${formatCurrency(spendingTotals.budget)} total`
                : 'No budget set'
            }
            icon={<Receipt className="w-4 h-4" />}
            percentBar={
              spendingTotals.budget > 0
                ? { percent: budgetPercent, color: barColor }
                : undefined
            }
            href="/spending"
          />

          <KpiCard
            title={pendingLabel}
            value={String(stats.pendingBillsCount)}
            subtitle={isAdminOrOwner ? 'Awaiting review' : 'Pending or draft'}
            icon={<Clock className="w-4 h-4" />}
            href="/bills"
          />

          <KpiCard
            title="V-Geld Balance"
            value={formatCurrency(stats.vgeldBalance)}
            subtitle={
              stats.vgeldBalance >= 0 ? 'Available balance' : 'Overspent'
            }
            icon={<Wallet className="w-4 h-4" />}
            href="/vgeld"
          />

          <KpiCard
            title="Bills This Month"
            value={String(stats.monthlyBillsCount)}
            subtitle={isAdminOrOwner ? 'Project-wide' : 'Submitted by you'}
            icon={<CalendarDays className="w-4 h-4" />}
          />
        </div>
      </section>

      {/* Charts */}
      <section aria-label="Spending charts">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">
              Spending by Motive
            </h2>
            <SpendingByMotiveChart items={motiveItems} />
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">
              Spending by Category
            </h2>
            <SpendingByCategoryChart items={categoryItems} />
          </div>
        </div>
      </section>

      {/* Recent bills + quick actions */}
      <section aria-label="Recent activity and shortcuts">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <RecentBillsList bills={recentBills} />
          <QuickActions />
        </div>
      </section>
    </div>
  );
}
