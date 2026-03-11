'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import SpendingTable, { SpendingTableSkeleton } from './SpendingTable';
import type { SpendingItem, SpendingTotals } from '@/lib/spending';

// ============================================================================
// Types
// ============================================================================

type Tab = 'motive' | 'category';

interface TabSpendingData {
  items: SpendingItem[];
  totals: SpendingTotals;
}

// ============================================================================
// Tab button
// ============================================================================

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function TabButton({ active, onClick, children }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-4 py-2 text-sm font-medium rounded-lg transition-colors border',
        active
          ? 'bg-[var(--vb-accent)] text-white border-[var(--vb-accent)] shadow-sm'
          : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50 hover:text-zinc-800'
      )}
      aria-current={active ? 'page' : undefined}
    >
      {children}
    </button>
  );
}

// ============================================================================
// Empty state for no bills
// ============================================================================

function NoBillsEmptyState() {
  return (
    <div className="bg-white rounded-xl border border-[var(--vb-card-border)] shadow-[var(--vb-shadow-sm)] p-12 text-center">
      <div className="flex flex-col items-center gap-3 text-zinc-400">
        <svg
          className="w-10 h-10 text-zinc-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <div>
          <p className="text-sm font-medium text-zinc-500">No spending recorded yet</p>
          <p className="text-xs text-zinc-400 mt-1">
            Upload and confirm bills to see spending data here.
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Error state
// ============================================================================

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-center">
      <p className="text-sm text-rose-700 mb-3">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-medium hover:bg-rose-700 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Retry
      </button>
    </div>
  );
}

// ============================================================================
// Main SpendingPageClient
// ============================================================================

interface SpendingPageClientProps {
  initialMotiveData: TabSpendingData;
  initialCategoryData: TabSpendingData;
}

export default function SpendingPageClient({
  initialMotiveData,
  initialCategoryData,
}: SpendingPageClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Determine active tab from URL query param, default to 'motive'
  const tabParam = searchParams.get('tab');
  const activeTab: Tab = tabParam === 'category' ? 'category' : 'motive';

  const [motiveData, setMotiveData] = useState<TabSpendingData>(initialMotiveData);
  const [categoryData, setCategoryData] = useState<TabSpendingData>(initialCategoryData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentData = activeTab === 'motive' ? motiveData : categoryData;

  // Determine if there's truly no data at all (both tabs empty and no spending)
  const hasNoData =
    motiveData.items.length === 0 &&
    categoryData.items.length === 0 &&
    motiveData.totals.spent === 0 &&
    categoryData.totals.spent === 0;

  const switchTab = useCallback(
    (tab: Tab) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tab === 'motive') {
        params.delete('tab');
      } else {
        params.set('tab', tab);
      }
      const query = params.toString();
      router.replace(`${pathname}${query ? `?${query}` : ''}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [motiveRes, categoryRes] = await Promise.all([
        fetch('/api/spending?tab=motive'),
        fetch('/api/spending?tab=category'),
      ]);
      if (!motiveRes.ok || !categoryRes.ok) {
        throw new Error('Failed to load spending data');
      }
      const [motiveJson, categoryJson] = await Promise.all([
        motiveRes.json() as Promise<TabSpendingData>,
        categoryRes.json() as Promise<TabSpendingData>,
      ]);
      setMotiveData(motiveJson);
      setCategoryData(categoryJson);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load spending data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Sync with initial data on mount (handles project switch via SSR re-render)
  useEffect(() => {
    setMotiveData(initialMotiveData);
    setCategoryData(initialCategoryData);
  }, [initialMotiveData, initialCategoryData]);

  return (
    <div className="space-y-6 animate-[vb-rise_0.4s_ease-out]">
      {/* Page header */}
      <div>
        <h1 className="text-[22px] font-semibold text-zinc-800">Spending Overview</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Track budget utilization by motive and category
        </p>
      </div>

      {/* Tab navigation */}
      <div className="flex items-center gap-2" role="tablist" aria-label="Spending view tabs">
        <TabButton
          active={activeTab === 'motive'}
          onClick={() => switchTab('motive')}
        >
          By Motive
        </TabButton>
        <TabButton
          active={activeTab === 'category'}
          onClick={() => switchTab('category')}
        >
          By Category
        </TabButton>
      </div>

      {/* Error state */}
      {error && <ErrorState message={error} onRetry={refetch} />}

      {/* Content */}
      {!error && (
        <div role="tabpanel" aria-label={activeTab === 'motive' ? 'Spending by motive' : 'Spending by category'}>
          {isLoading ? (
            <SpendingTableSkeleton />
          ) : hasNoData && currentData.items.length === 0 ? (
            <NoBillsEmptyState />
          ) : (
            <SpendingTable
              items={currentData.items}
              totals={currentData.totals}
              label={
                activeTab === 'motive'
                  ? 'Spending by motive'
                  : 'Spending by category'
              }
            />
          )}
        </div>
      )}
    </div>
  );
}
