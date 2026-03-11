'use client';

import { cn } from '@/lib/utils';
import type { SpendingItem, SpendingTotals } from '@/lib/spending';

// ============================================================================
// Currency & percentage formatters
// ============================================================================

const currencyFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
});

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

function formatPercent(value: number): string {
  return value.toFixed(1) + '%';
}

// ============================================================================
// Percent indicator dot
// ============================================================================

interface PercentIndicatorProps {
  percentUsed: number | null;
  budget: number;
  spent: number;
}

function PercentIndicator({ percentUsed, budget, spent }: PercentIndicatorProps) {
  // Budget = 0 but spending > 0: infinity symbol in red
  if (budget === 0 && spent > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-rose-600 font-semibold">
        <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" aria-hidden="true" />
        ∞
      </span>
    );
  }

  // No budget, no spending: dash
  if (percentUsed === null) {
    return <span className="text-zinc-400 font-mono">—</span>;
  }

  let dotClass: string;
  if (percentUsed >= 100) {
    dotClass = 'bg-rose-500';
  } else if (percentUsed >= 80) {
    dotClass = 'bg-amber-500';
  } else {
    dotClass = 'bg-emerald-500';
  }

  const textClass = percentUsed >= 100
    ? 'text-rose-600'
    : percentUsed >= 80
    ? 'text-amber-600'
    : 'text-zinc-700';

  return (
    <span className={cn('inline-flex items-center gap-1.5 font-mono font-semibold', textClass)}>
      <span className={cn('w-2 h-2 rounded-full shrink-0', dotClass)} aria-hidden="true" />
      {formatPercent(percentUsed)}
    </span>
  );
}

// ============================================================================
// Skeleton loading state
// ============================================================================

export function SpendingTableSkeleton() {
  return (
    <div
      className="bg-white rounded-xl border border-[var(--vb-card-border)] shadow-[var(--vb-shadow-sm)] overflow-hidden"
      aria-label="Loading spending data"
      aria-busy="true"
    >
      <div className="overflow-x-auto">
        <table className="w-full" aria-hidden="true">
          <thead className="bg-zinc-50 border-b border-[var(--vb-card-border)]">
            <tr>
              {['Name', 'Budget', 'Spent', 'Remaining', '% Used'].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-[10.5px] font-semibold text-zinc-400 uppercase tracking-[0.1em]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 animate-pulse">
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                <td className="px-4 py-3">
                  <div className="h-4 bg-zinc-200 rounded w-32" />
                </td>
                <td className="px-4 py-3">
                  <div className="h-4 bg-zinc-200 rounded w-24 ml-auto" />
                </td>
                <td className="px-4 py-3">
                  <div className="h-4 bg-zinc-200 rounded w-24 ml-auto" />
                </td>
                <td className="px-4 py-3">
                  <div className="h-4 bg-zinc-200 rounded w-24 ml-auto" />
                </td>
                <td className="px-4 py-3">
                  <div className="h-4 bg-zinc-200 rounded w-16 ml-auto" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// Main SpendingTable component
// ============================================================================

type AmountMode = 'brutto' | 'netto';

interface SpendingTableProps {
  items: SpendingItem[];
  totals: SpendingTotals;
  label: string;
  amountMode: AmountMode;
}

export default function SpendingTable({ items, totals, label, amountMode }: SpendingTableProps) {
  const getSpent = (item: SpendingItem) =>
    amountMode === 'netto' ? item.nettoSpent : item.spent;
  const getRemaining = (item: SpendingItem) => item.budget - getSpent(item);
  const getPercentUsed = (item: SpendingItem): number | null => {
    if (item.budget === 0) return null;
    return (getSpent(item) / item.budget) * 100;
  };
  const activeTotalSpent = amountMode === 'netto' ? totals.nettoSpent : totals.spent;
  const activeTotalRemaining = totals.budget - activeTotalSpent;
  const activeTotalPercent = totals.budget === 0 ? null : (activeTotalSpent / totals.budget) * 100;
  if (items.length === 0) {
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
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z"
            />
          </svg>
          <div>
            <p className="text-sm font-medium text-zinc-500">No budget items configured</p>
            <p className="text-xs text-zinc-400 mt-1">
              <a
                href="/settings/motives"
                className="text-[var(--vb-accent)] hover:text-[var(--vb-accent-hover)] underline underline-offset-2"
              >
                Go to Settings
              </a>
              {' '}to add motives and categories.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="bg-white rounded-xl border border-[var(--vb-card-border)] shadow-[var(--vb-shadow-sm)] overflow-hidden"
      role="region"
      aria-label={label}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 border-b border-[var(--vb-card-border)]">
            <tr>
              <th className="px-4 py-3 text-left text-[10.5px] font-semibold text-zinc-400 uppercase tracking-[0.1em]">
                Name
              </th>
              <th className="px-4 py-3 text-right text-[10.5px] font-semibold text-zinc-400 uppercase tracking-[0.1em]">
                Budget
              </th>
              <th className="px-4 py-3 text-right text-[10.5px] font-semibold text-zinc-400 uppercase tracking-[0.1em]">
                Spent
              </th>
              <th className="px-4 py-3 text-right text-[10.5px] font-semibold text-zinc-400 uppercase tracking-[0.1em]">
                Remaining
              </th>
              <th className="px-4 py-3 text-right text-[10.5px] font-semibold text-zinc-400 uppercase tracking-[0.1em]">
                % Used
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {items.map((item, index) => {
              const isSpecialRow = item.status === 'unallocated' || item.status === 'deleted';
              return (
                <tr
                  key={item.id ?? `special-${index}`}
                  className="hover:bg-zinc-50/60 transition-colors"
                >
                  {/* Name */}
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'text-zinc-800',
                        isSpecialRow && 'italic text-zinc-400'
                      )}
                    >
                      {item.name}
                    </span>
                  </td>

                  {/* Budget */}
                  <td
                    className={cn(
                      'px-4 py-3 text-right font-mono-numbers',
                      isSpecialRow ? 'text-zinc-400' : 'text-zinc-700'
                    )}
                  >
                    {formatCurrency(item.budget)}
                  </td>

                  {/* Spent */}
                  <td className="px-4 py-3 text-right font-mono-numbers text-zinc-700">
                    {formatCurrency(getSpent(item))}
                  </td>

                  {/* Remaining */}
                  <td
                    className={cn(
                      'px-4 py-3 text-right font-mono-numbers font-semibold',
                      getRemaining(item) < 0 ? 'text-rose-600' : 'text-zinc-700'
                    )}
                  >
                    {formatCurrency(getRemaining(item))}
                  </td>

                  {/* % Used */}
                  <td className="px-4 py-3 text-right">
                    {isSpecialRow ? (
                      <span className="text-zinc-400 font-mono">—</span>
                    ) : (
                      <PercentIndicator
                        percentUsed={getPercentUsed(item)}
                        budget={item.budget}
                        spent={getSpent(item)}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Grand Totals Row */}
          <tfoot>
            <tr className="bg-zinc-50 border-t-2 border-zinc-200">
              <td className="px-4 py-3 font-bold text-zinc-800 text-sm">
                TOTAL
              </td>
              <td className="px-4 py-3 text-right font-mono-numbers font-bold text-zinc-800">
                {formatCurrency(totals.budget)}
              </td>
              <td className="px-4 py-3 text-right font-mono-numbers font-bold text-zinc-800">
                {formatCurrency(activeTotalSpent)}
              </td>
              <td
                className={cn(
                  'px-4 py-3 text-right font-mono-numbers font-bold',
                  activeTotalRemaining < 0 ? 'text-rose-600' : 'text-zinc-800'
                )}
              >
                {formatCurrency(activeTotalRemaining)}
              </td>
              <td className="px-4 py-3 text-right">
                <PercentIndicator
                  percentUsed={activeTotalPercent}
                  budget={totals.budget}
                  spent={activeTotalSpent}
                />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
