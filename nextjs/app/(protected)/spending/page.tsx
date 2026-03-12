// ============================================================================
// Spending Overview Page — PROJ-14
// Server Component: fetches data, passes to SpendingPageClient
// ============================================================================

import { Suspense } from 'react';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import {
  getSpendingByMotive,
  getSpendingByCategory,
  getSpendingTotals,
} from '@/lib/spending';
import SpendingPageClient from '@/components/spending/SpendingPageClient';
import { SpendingTableSkeleton } from '@/components/spending/SpendingTable';

async function SpendingContent() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const projectId = session.user.currentProjectId;

  if (!projectId) {
    // No project selected — show empty state via client
    const emptyData = {
      items: [],
      totals: { budget: 0, spent: 0, nettoSpent: 0, remaining: 0, percentUsed: null },
    };
    return (
      <SpendingPageClient
        initialMotiveData={emptyData}
        initialCategoryData={emptyData}
      />
    );
  }

  // Fetch both tabs in parallel for fast initial render
  const [motiveItems, categoryItems] = await Promise.all([
    getSpendingByMotive(projectId),
    getSpendingByCategory(projectId),
  ]);

  const motiveData = {
    items: motiveItems,
    totals: getSpendingTotals(motiveItems),
  };

  const categoryData = {
    items: categoryItems,
    totals: getSpendingTotals(categoryItems),
  };

  return (
    <SpendingPageClient
      initialMotiveData={motiveData}
      initialCategoryData={categoryData}
    />
  );
}

export default function SpendingPage() {
  return (
    <Suspense fallback={<SpendingPageFallback />}>
      <SpendingContent />
    </Suspense>
  );
}

function SpendingPageFallback() {
  return (
    <div className="space-y-6 animate-[vb-rise_0.4s_ease-out]">
      <div>
        <div className="h-7 w-48 bg-zinc-200 rounded animate-pulse" />
        <div className="h-4 w-72 bg-zinc-100 rounded animate-pulse mt-2" />
      </div>
      <div className="flex gap-2">
        <div className="h-9 w-24 bg-zinc-200 rounded-lg animate-pulse" />
        <div className="h-9 w-28 bg-zinc-100 rounded-lg animate-pulse" />
      </div>
      <SpendingTableSkeleton />
    </div>
  );
}
