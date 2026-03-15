'use client';

import { useState } from 'react';
import { Pencil, X, Plus } from 'lucide-react';
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
  projectId: string;
  isMutating?: boolean;
  onAddMotive?: (name: string) => Promise<void>;
  onRenameMotive?: (id: string, newName: string) => Promise<void>;
  onDeleteMotive?: (id: string, name: string) => void;
  onAddCategory?: (name: string) => Promise<void>;
  onRenameCategory?: (id: string, newName: string) => Promise<void>;
  onDeleteCategory?: (id: string, name: string) => void;
}

// German currency formatter
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
};

// Cell background color based on spent vs budget ratio
function getCellBgClass(budget: number, spent: number): string {
  if (budget === 0 && spent > 0) return 'bg-zinc-100';
  if (budget === 0) return '';
  const pct = spent / budget;
  if (pct >= 1.0) return 'bg-rose-50';
  if (pct >= 0.8) return 'bg-amber-50';
  if (spent > 0) return 'bg-emerald-50';
  return '';
}

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
  isMutating,
  onAddMotive,
  onRenameMotive,
  onDeleteMotive,
  onAddCategory,
  onRenameCategory,
  onDeleteCategory,
}: BudgetMatrixTableProps) {
  const [renamingMotive, setRenamingMotive] = useState<{ id: string; value: string } | null>(null);
  const [renamingCategory, setRenamingCategory] = useState<{ id: string; value: string } | null>(null);
  const [addMotiveValue, setAddMotiveValue] = useState('');
  const [addCategoryValue, setAddCategoryValue] = useState('');
  const [isAddingMotive, setIsAddingMotive] = useState(false);
  const [isAddingCategory, setIsAddingCategory] = useState(false);

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
        {isAdmin ? (
          <p className="text-zinc-400 text-sm">Use the &quot;+ Add motive&quot; button in the matrix header to add one.</p>
        ) : (
          <a
            href="/settings/motives"
            className="text-[var(--vb-accent)] hover:text-[var(--vb-accent-hover)] text-sm font-medium"
          >
            Go to Settings to add motives →
          </a>
        )}
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="text-center py-12 bg-zinc-50 rounded-lg border border-[var(--vb-card-border)]">
        <p className="text-zinc-600 mb-2">No categories configured</p>
        {isAdmin ? (
          <p className="text-zinc-400 text-sm">Use the &quot;+ Add category&quot; button in the matrix to add one.</p>
        ) : (
          <a
            href="/settings/categories"
            className="text-[var(--vb-accent)] hover:text-[var(--vb-accent-hover)] text-sm font-medium"
          >
            Go to Settings to add categories →
          </a>
        )}
      </div>
    );
  }

  return (
    <div className={`overflow-auto max-h-[calc(100vh-200px)] border border-[var(--vb-card-border)] rounded-lg${isMutating ? ' opacity-70 pointer-events-none' : ''}`}>
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
                className="group sticky top-0 z-10 bg-zinc-50 p-0 border-b border-r border-[var(--vb-card-border)] min-w-[140px]"
              >
                {renamingMotive?.id === motive.id ? (
                  <div className="p-2">
                    <input
                      type="text"
                      value={renamingMotive.value}
                      autoFocus
                      onChange={(e) => setRenamingMotive({ id: motive.id, value: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && renamingMotive.value.trim()) {
                          onRenameMotive?.(motive.id, renamingMotive.value.trim());
                          setRenamingMotive(null);
                        } else if (e.key === 'Escape') {
                          setRenamingMotive(null);
                        }
                      }}
                      onBlur={() => setRenamingMotive(null)}
                      className="w-full px-2 py-1 text-sm border border-[var(--vb-accent)] rounded focus:outline-none bg-indigo-50"
                    />
                  </div>
                ) : (
                  <div className="p-3">
                    <div className="flex items-center gap-1">
                      <span className="font-semibold text-zinc-700 text-sm truncate flex-1">{motive.name}</span>
                      {isAdmin && motive.name !== 'Default' && (
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => setRenamingMotive({ id: motive.id, value: motive.name })}
                            className="p-0.5 text-zinc-400 hover:text-zinc-600 rounded"
                            title="Rename motive"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteMotive?.(motive.id, motive.name)}
                            className="p-0.5 text-zinc-400 hover:text-rose-500 rounded"
                            title="Delete motive"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      )}
                    </div>
                    <div
                      className="text-[10.5px] text-zinc-400 uppercase tracking-[0.1em] mt-1"
                      title={`Budget: ${formatCurrency(calculateMotiveTotal(motive.id))}\nAusgaben: ${formatCurrency(calculateMotiveSpentTotal(motive.id))}\nVerbleibend: ${formatCurrency(calculateMotiveTotal(motive.id) - calculateMotiveSpentTotal(motive.id))}\nVerbraucht: ${calculateMotiveTotal(motive.id) > 0 ? Math.round((calculateMotiveSpentTotal(motive.id) / calculateMotiveTotal(motive.id)) * 100) : 0}%`}
                    >
                      <div className="font-mono-numbers">{formatCurrency(calculateMotiveTotal(motive.id))}</div>
                      <div className="font-mono-numbers text-zinc-400">{formatCurrency(calculateMotiveSpentTotal(motive.id))}</div>
                    </div>
                  </div>
                )}
              </th>
            ))}
            {/* Add motive column header (admin only) */}
            {isAdmin && (
              <th className="sticky top-0 z-10 bg-zinc-50 p-2 border-b border-r border-[var(--vb-card-border)] min-w-[120px]">
                {isAddingMotive ? (
                  <input
                    type="text"
                    value={addMotiveValue}
                    autoFocus
                    placeholder="Motive name..."
                    onChange={(e) => setAddMotiveValue(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter' && addMotiveValue.trim()) {
                        await onAddMotive?.(addMotiveValue.trim());
                        setAddMotiveValue('');
                        setIsAddingMotive(false);
                      } else if (e.key === 'Escape') {
                        setAddMotiveValue('');
                        setIsAddingMotive(false);
                      }
                    }}
                    onBlur={() => { setAddMotiveValue(''); setIsAddingMotive(false); }}
                    className="w-full px-2 py-1 text-xs border border-[var(--vb-accent)] rounded focus:outline-none bg-indigo-50"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsAddingMotive(true)}
                    className="flex items-center gap-1 text-xs text-zinc-400 hover:text-[var(--vb-accent)] transition-colors"
                    title="Add motive"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add motive
                  </button>
                )}
              </th>
            )}
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
            const categoryRemaining = categoryTotal - categorySpent;
            const categoryPct = categoryTotal > 0 ? Math.round((categorySpent / categoryTotal) * 100) : 0;

            return (
              <tr key={category.id} className="hover:bg-indigo-50/40">
                {/* Category name - sticky first column */}
                <td className="group sticky left-0 z-10 bg-white p-3 border-b border-r border-[var(--vb-card-border)] min-w-[160px]">
                  {renamingCategory?.id === category.id ? (
                    <input
                      type="text"
                      value={renamingCategory.value}
                      autoFocus
                      onChange={(e) => setRenamingCategory({ id: category.id, value: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && renamingCategory.value.trim()) {
                          onRenameCategory?.(category.id, renamingCategory.value.trim());
                          setRenamingCategory(null);
                        } else if (e.key === 'Escape') {
                          setRenamingCategory(null);
                        }
                      }}
                      onBlur={() => setRenamingCategory(null)}
                      className="w-full px-2 py-1 text-sm border border-[var(--vb-accent)] rounded focus:outline-none bg-indigo-50"
                    />
                  ) : (
                    <>
                      <div className="flex items-center gap-1">
                        <span className="font-medium text-sm text-zinc-700 truncate flex-1">{category.name}</span>
                        {isAdmin && category.name !== 'Uncategorized' && (
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => setRenamingCategory({ id: category.id, value: category.name })}
                              className="p-0.5 text-zinc-400 hover:text-zinc-600 rounded"
                              title="Rename"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteCategory?.(category.id, category.name)}
                              className="p-0.5 text-zinc-400 hover:text-rose-500 rounded"
                              title="Delete"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-400 mt-1 font-mono-numbers">{formatCurrency(categoryTotal)}</div>
                    </>
                  )}
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
                      className={`p-2 border-b border-r border-[var(--vb-card-border)] min-w-[140px] ${getCellBgClass(budget, spent)}`}
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
                {/* Empty cell for "Add motive" column */}
                {isAdmin && <td className="border-b border-r border-[var(--vb-card-border)]" />}
                {/* Category total cell - sticky right */}
                <td
                  className="sticky right-0 z-10 bg-zinc-50 p-3 border-b border-l border-[var(--vb-card-border)] min-w-[140px]"
                  title={`Budget: ${formatCurrency(categoryTotal)}\nAusgaben: ${formatCurrency(categorySpent)}\nVerbleibend: ${formatCurrency(categoryRemaining)}\nVerbraucht: ${categoryPct}%`}
                >
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
          {/* Add category row (admin only) */}
          {isAdmin && (
            <tr>
              <td className="sticky left-0 z-10 bg-white p-2 border-b border-r border-[var(--vb-card-border)]">
                {isAddingCategory ? (
                  <input
                    type="text"
                    value={addCategoryValue}
                    autoFocus
                    placeholder="Category name..."
                    onChange={(e) => setAddCategoryValue(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter' && addCategoryValue.trim()) {
                        await onAddCategory?.(addCategoryValue.trim());
                        setAddCategoryValue('');
                        setIsAddingCategory(false);
                      } else if (e.key === 'Escape') {
                        setAddCategoryValue('');
                        setIsAddingCategory(false);
                      }
                    }}
                    onBlur={() => { setAddCategoryValue(''); setIsAddingCategory(false); }}
                    className="w-full px-2 py-1 text-xs border border-[var(--vb-accent)] rounded focus:outline-none bg-indigo-50"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsAddingCategory(true)}
                    className="flex items-center gap-1 text-xs text-zinc-400 hover:text-[var(--vb-accent)]"
                    title="Add category"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add category
                  </button>
                )}
              </td>
              {motives.map((m) => (
                <td key={m.id} className="border-b border-r border-[var(--vb-card-border)]" />
              ))}
              {/* Empty cell for "Add motive" column */}
              <td className="border-b border-r border-[var(--vb-card-border)]" />
              <td className="sticky right-0 bg-zinc-50 border-b border-l border-[var(--vb-card-border)]" />
            </tr>
          )}
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
            {/* Empty cell for "Add motive" column in totals row */}
            {isAdmin && (
              <td className="sticky bottom-0 z-10 bg-zinc-100 border-t border-r border-[var(--vb-card-border)]" />
            )}
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
