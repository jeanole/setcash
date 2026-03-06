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
      <div className="text-center py-12 bg-slate-50 rounded-lg border border-slate-200">
        <p className="text-slate-600 mb-2">No motives configured</p>
        <a
          href="/settings/motives"
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          Go to Settings to add motives →
        </a>
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="text-center py-12 bg-slate-50 rounded-lg border border-slate-200">
        <p className="text-slate-600 mb-2">No categories configured</p>
        <a
          href="/settings/categories"
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          Go to Settings to add categories →
        </a>
      </div>
    );
  }

  return (
    <div className="overflow-auto max-h-[calc(100vh-200px)] border border-slate-200 rounded-lg">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-slate-50">
            {/* Corner cell - sticky */}
            <th className="sticky top-0 left-0 z-20 bg-slate-100 p-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-r border-slate-200 min-w-[160px]">
              Category / Motive
            </th>
            {/* Motive columns - sticky header */}
            {motives.map((motive) => (
              <th
                key={motive.id}
                className="sticky top-0 z-10 bg-slate-50 p-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-r border-slate-200 min-w-[140px]"
              >
                <div className="font-semibold text-slate-700">{motive.name}</div>
                <div className="text-slate-400 mt-1">
                  {formatCurrency(calculateMotiveTotal(motive.id))}
                </div>
              </th>
            ))}
            {/* Total column - sticky header and right */}
            <th className="sticky top-0 right-0 z-20 bg-slate-100 p-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-l border-slate-200 min-w-[140px]">
              <div className="font-semibold text-slate-700">Total</div>
              <div className="text-slate-400 mt-1">{formatCurrency(grandTotal)}</div>
            </th>
          </tr>
        </thead>
        <tbody>
          {categories.map((category) => {
            const categoryTotal = calculateCategoryTotal(category.id);
            const categorySpent = calculateCategorySpentTotal(category.id);

            return (
              <tr key={category.id} className="hover:bg-slate-50">
                {/* Category name - sticky first column */}
                <td className="sticky left-0 z-10 bg-white p-3 border-b border-r border-slate-200 font-medium text-sm text-slate-700 min-w-[160px]">
                  <div>{category.name}</div>
                  <div className="text-xs text-slate-400 mt-1">
                    {formatCurrency(categoryTotal)}
                  </div>
                </td>
                {/* Motive cells */}
                {motives.map((motive) => {
                  const cellKey = `${category.id}_${motive.id}`;
                  const budget = matrix[cellKey] || 0;
                  const spent = cellSpending[cellKey] || 0;
                  const isEditing = editingCell === cellKey;

                  return (
                    <td
                      key={motive.id}
                      className="p-2 border-b border-r border-slate-200 min-w-[140px]"
                    >
                      <BudgetMatrixCell
                        budget={budget}
                        spent={spent}
                        isEditing={isEditing}
                        isAdmin={isAdmin}
                        onEditStart={() => onEditStart(category.id, motive.id)}
                        onEditSave={(value) => onEditSave(category.id, motive.id, value)}
                        onEditCancel={onEditCancel}
                      />
                    </td>
                  );
                })}
                {/* Category total cell - sticky right */}
                <td className="sticky right-0 z-10 bg-slate-50 p-3 border-b border-l border-slate-200 min-w-[140px]">
                  <div className="text-sm font-medium text-slate-700 tabular-nums">
                    {formatCurrency(categoryTotal)}
                  </div>
                  <div className="text-xs text-slate-500 tabular-nums mt-1">
                    {formatCurrency(categorySpent)}
                  </div>
                </td>
              </tr>
            );
          })}
          {/* Total row */}
          <tr className="bg-slate-50 font-semibold">
            <td className="sticky left-0 bottom-0 z-20 bg-slate-100 p-3 border-t border-r border-slate-200 text-sm text-slate-700">
              Total
            </td>
            {motives.map((motive) => {
              const motiveTotal = calculateMotiveTotal(motive.id);
              const motiveSpent = calculateMotiveSpentTotal(motive.id);

              return (
                <td
                  key={motive.id}
                  className="sticky bottom-0 z-10 bg-slate-100 p-3 border-t border-r border-slate-200"
                >
                  <div className="text-sm text-slate-700 tabular-nums">
                    {formatCurrency(motiveTotal)}
                  </div>
                  <div className="text-xs text-slate-500 tabular-nums mt-1">
                    {formatCurrency(motiveSpent)}
                  </div>
                </td>
              );
            })}
            {/* Grand total cell - sticky bottom and right */}
            <td className="sticky right-0 bottom-0 z-30 bg-slate-200 p-3 border-t border-l border-slate-300">
              <div className="text-sm font-bold text-slate-800 tabular-nums">
                {formatCurrency(grandTotal)}
              </div>
              <div className="text-xs text-slate-600 tabular-nums mt-1">
                {formatCurrency(grandSpentTotal)}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
