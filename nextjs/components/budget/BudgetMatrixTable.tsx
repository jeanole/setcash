'use client';

import BudgetMatrixCell from './BudgetMatrixCell';
import type { Motive, Category } from '@/lib/types';

interface BudgetMatrixTableProps {
  motives: Motive[];
  categories: Category[];
  matrix: Record<string, number>;
  motiveSpending: Record<string, number>;
  categorySpending: Record<string, number>;
  cellSpending: Record<string, number>;
  isAdmin: boolean;
  editingCell: string | null;
  modifiedCells?: Set<string>;
  onEditStart: (categoryId: string, motiveId: string) => void;
  onEditSave: (categoryId: string, motiveId: string, value: number) => void;
  onEditCancel: () => void;
}

// German currency formatter
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
};

export default function BudgetMatrixTable({
  motives,
  categories,
  matrix,
  motiveSpending,
  categorySpending,
  cellSpending,
  isAdmin,
  editingCell,
  modifiedCells = new Set(),
  onEditStart,
  onEditSave,
  onEditCancel,
}: BudgetMatrixTableProps) {
  // Calculate totals
  const calculateMotiveTotal = (motiveId: string): number => {
    return categories.reduce((sum, category) => {
      const key = `${category.id}_${motiveId}`;
      return sum + (matrix[key] || 0);
    }, 0);
  };

  const calculateCategoryTotal = (categoryId: string): number => {
    return motives.reduce((sum, motive) => {
      const key = `${categoryId}_${motive.id}`;
      return sum + (matrix[key] || 0);
    }, 0);
  };

  const calculateGrandTotal = (): number => {
    return categories.reduce((sum, category) => sum + calculateCategoryTotal(category.id), 0);
  };

  const calculateMotiveSpentTotal = (motiveId: string): number => {
    return motiveSpending[motiveId] || 0;
  };

  const calculateCategorySpentTotal = (categoryId: string): number => {
    return categorySpending[categoryId] || 0;
  };

  const calculateGrandSpentTotal = (): number => {
    return Object.values(categorySpending).reduce((sum, spent) => sum + spent, 0);
  };

  const grandTotal = calculateGrandTotal();
  const grandSpentTotal = calculateGrandSpentTotal();

  // Empty states
  if (motives.length === 0) {
    return (
      <div className="text-center py-12 bg-zinc-50 rounded-lg border border-[var(--vb-card-border)]">
        <p className="text-zinc-600 mb-2">No motives configured</p>
        <a
          href="/settings/motives"
          className="text-[#7C6AF6] hover:text-[#6C5CE7] text-sm font-medium"
        >
          Go to Settings to add motives →
        </a>
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="text-center py-12 bg-zinc-50 rounded-lg border border-[var(--vb-card-border)]">
        <p className="text-zinc-600 mb-2">No categories configured</p>
        <a
          href="/settings/categories"
          className="text-[#7C6AF6] hover:text-[#6C5CE7] text-sm font-medium"
        >
          Go to Settings to add categories →
        </a>
      </div>
    );
  }

  return (
    <div className="overflow-auto max-h-[calc(100vh-200px)] border border-[var(--vb-card-border)] rounded-lg">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-zinc-50">
            {/* Corner cell - sticky */}
            <th className="sticky top-0 left-0 z-20 bg-zinc-100 p-3 text-left text-[10.5px] font-semibold text-zinc-400 uppercase tracking-[0.1em] border-b border-r border-[var(--vb-card-border)] min-w-[160px]">
              Category / Motive
            </th>
            {/* Motive columns - sticky header */}
            {motives.map((motive) => (
              <th
                key={motive.id}
                className="sticky top-0 z-10 bg-zinc-50 p-3 text-left text-[10.5px] font-semibold text-zinc-400 uppercase tracking-[0.1em] border-b border-r border-[var(--vb-card-border)] min-w-[140px]"
              >
                <div className="font-semibold text-zinc-700">{motive.name}</div>
                <div className="text-zinc-400 mt-1 font-mono-numbers">
                  {formatCurrency(calculateMotiveTotal(motive.id))}
                </div>
              </th>
            ))}
            {/* Total column - sticky header and right */}
            <th className="sticky top-0 right-0 z-20 bg-zinc-100 p-3 text-left text-[10.5px] font-semibold text-zinc-400 uppercase tracking-[0.1em] border-b border-l border-[var(--vb-card-border)] min-w-[140px]">
              <div className="font-semibold text-zinc-700">Total</div>
              <div className="text-zinc-400 mt-1 font-mono-numbers">{formatCurrency(grandTotal)}</div>
            </th>
          </tr>
        </thead>
        <tbody>
          {categories.map((category) => {
            const categoryTotal = calculateCategoryTotal(category.id);
            const categorySpent = calculateCategorySpentTotal(category.id);

            return (
              <tr key={category.id} className="hover:bg-violet-50/40">
                {/* Category name - sticky first column */}
                <td className="sticky left-0 z-10 bg-white p-3 border-b border-r border-[var(--vb-card-border)] font-medium text-sm text-zinc-700 min-w-[160px]">
                  <div>{category.name}</div>
                  <div className="text-xs text-zinc-400 mt-1 font-mono-numbers">
                    {formatCurrency(categoryTotal)}
                  </div>
                </td>
                {/* Motive cells */}
                {motives.map((motive) => {
                  const cellKey = `${category.id}_${motive.id}`;
                  const budget = matrix[cellKey] || 0;
                  const spent = cellSpending[cellKey] || 0;
                  const isEditing = editingCell === cellKey;

                  const isModified = modifiedCells.has(cellKey);

                  return (
                    <td
                      key={motive.id}
                      className="p-2 border-b border-r border-[var(--vb-card-border)] min-w-[140px]"
                    >
                      <BudgetMatrixCell
                        budget={budget}
                        spent={spent}
                        isEditing={isEditing}
                        isAdmin={isAdmin}
                        isModified={isModified}
                        onEditStart={() => onEditStart(category.id, motive.id)}
                        onEditSave={(value) => onEditSave(category.id, motive.id, value)}
                        onEditCancel={onEditCancel}
                      />
                    </td>
                  );
                })}
                {/* Category total cell - sticky right */}
                <td className="sticky right-0 z-10 bg-zinc-50 p-3 border-b border-l border-[var(--vb-card-border)] min-w-[140px]">
                  <div className="text-sm font-medium text-zinc-700 font-mono-numbers">
                    {formatCurrency(categoryTotal)}
                  </div>
                  <div className="text-xs text-zinc-500 font-mono-numbers mt-1">
                    {formatCurrency(categorySpent)}
                  </div>
                </td>
              </tr>
            );
          })}
          {/* Total row */}
          <tr className="bg-zinc-50 font-semibold">
            <td className="sticky left-0 bottom-0 z-20 bg-zinc-100 p-3 border-t border-r border-[var(--vb-card-border)] text-sm text-zinc-700">
              Total
            </td>
            {motives.map((motive) => {
              const motiveTotal = calculateMotiveTotal(motive.id);
              const motiveSpent = calculateMotiveSpentTotal(motive.id);

              return (
                <td
                  key={motive.id}
                  className="sticky bottom-0 z-10 bg-zinc-100 p-3 border-t border-r border-[var(--vb-card-border)]"
                >
                  <div className="text-sm text-zinc-700 font-mono-numbers">
                    {formatCurrency(motiveTotal)}
                  </div>
                  <div className="text-xs text-zinc-500 font-mono-numbers mt-1">
                    {formatCurrency(motiveSpent)}
                  </div>
                </td>
              );
            })}
            {/* Grand total cell - sticky bottom and right */}
            <td className="sticky right-0 bottom-0 z-30 bg-zinc-200 p-3 border-t border-l border-zinc-300">
              <div className="text-sm font-bold text-zinc-800 font-mono-numbers">
                {formatCurrency(grandTotal)}
              </div>
              <div className="text-xs text-zinc-600 font-mono-numbers mt-1">
                {formatCurrency(grandSpentTotal)}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
