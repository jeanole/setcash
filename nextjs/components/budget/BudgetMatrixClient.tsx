'use client';

import { useState, useCallback, useEffect } from 'react';
import BudgetMatrixTable from './BudgetMatrixTable';
import ConfirmationDialog from '@/components/ui/ConfirmationDialog';
import type { BudgetMatrixResponse, BudgetCellUpdate } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

type AmountMode = 'brutto' | 'netto';

interface BudgetMatrixClientProps extends BudgetMatrixResponse {
  isAdmin: boolean;
  projectId: string;
}

interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error';
  onRetry?: () => void;
  isRetrying?: boolean;
}

interface DeleteConfirm {
  type: 'motive' | 'category';
  id: string;
  name: string;
}

const PENDING_CHANGES_KEY = 'budgetMatrix_pendingChanges';

export default function BudgetMatrixClient({
  motives,
  categories,
  matrix: initialMatrix,
  grandTotal: initialGrandTotal,
  motiveSpending: initialMotiveSpending,
  categorySpending: initialCategorySpending,
  cellSpending: initialCellSpending,
  motiveSpendingBrutto: initialMotiveSpendingBrutto,
  categorySpendingBrutto: initialCategorySpendingBrutto,
  cellSpendingBrutto: initialCellSpendingBrutto,
  isAdmin,
  projectId,
}: BudgetMatrixClientProps) {
  const router = useRouter();
  const [matrix, setMatrix] = useState<Record<string, number>>(initialMatrix);
  const [motiveSpendingNetto] = useState<Record<string, number>>(initialMotiveSpending);
  const [categorySpendingNetto] = useState<Record<string, number>>(initialCategorySpending);
  const [cellSpendingNetto] = useState<Record<string, number>>(initialCellSpending);
  const [motiveSpendingBrutto] = useState<Record<string, number>>(initialMotiveSpendingBrutto);
  const [categorySpendingBrutto] = useState<Record<string, number>>(initialCategorySpendingBrutto);
  const [cellSpendingBrutto] = useState<Record<string, number>>(initialCellSpendingBrutto);
  const [amountMode, setAmountMode] = useState<AmountMode>('brutto');

  const motiveSpending = amountMode === 'brutto' ? motiveSpendingBrutto : motiveSpendingNetto;
  const categorySpending = amountMode === 'brutto' ? categorySpendingBrutto : categorySpendingNetto;
  const cellSpending = amountMode === 'brutto' ? cellSpendingBrutto : cellSpendingNetto;
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [modifiedCells, setModifiedCells] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm | null>(null);
  const [isMutating, setIsMutating] = useState(false);

  // Restore pending changes from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const pendingChanges = localStorage.getItem(PENDING_CHANGES_KEY);
      if (pendingChanges) {
        const { matrix: savedMatrix, modifiedCells: savedModifiedCells, timestamp } = JSON.parse(pendingChanges);

        // Check if changes are recent (within last 24 hours)
        const changeAge = Date.now() - timestamp;
        if (changeAge < 24 * 60 * 60 * 1000) {
          setMatrix(savedMatrix);
          setModifiedCells(new Set(savedModifiedCells));
          showToast('Restored unsaved changes from previous session', 'success');
        }

        // Clear the stored changes
        localStorage.removeItem(PENDING_CHANGES_KEY);
      }
    } catch (e) {
      console.error('Error restoring pending changes:', e);
    }
  }, []);

  const showToast = useCallback((message: string, type: 'success' | 'error', onRetry?: () => void) => {
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [...prev, { id, message, type, onRetry }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, type === 'error' && onRetry ? 10000 : 5000); // Longer timeout for retryable errors
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const getCellKey = useCallback((categoryId: string, motiveId: string): string => {
    return `${categoryId}_${motiveId}`;
  }, []);

  const handleEditStart = useCallback((categoryId: string, motiveId: string) => {
    if (!isAdmin) return;
    const key = getCellKey(categoryId, motiveId);
    setEditingCell(key);
  }, [isAdmin, getCellKey]);

  const handleEditSave = useCallback((categoryId: string, motiveId: string, value: number) => {
    const key = getCellKey(categoryId, motiveId);
    const currentValue = matrix[key] || 0;

    if (value !== currentValue) {
      setMatrix((prev) => ({ ...prev, [key]: value }));
      setModifiedCells((prev) => new Set(prev).add(key));
    }

    setEditingCell(null);
  }, [matrix, getCellKey]);

  const handleEditCancel = useCallback(() => {
    setEditingCell(null);
  }, []);

  const performSave = useCallback(async (updates: BudgetCellUpdate[], retryToastId?: string) => {
    if (!isAdmin || updates.length === 0) return;

    setIsSaving(true);

    // Mark toast as retrying if applicable
    if (retryToastId) {
      setToasts((prev) =>
        prev.map((t) => (t.id === retryToastId ? { ...t, isRetrying: true } : t))
      );
    }

    try {
      const response = await fetch('/api/budget-matrix/bulk-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ updates }),
      });

      if (response.status === 401) {
        // Session expired - save changes to localStorage and redirect to login
        const pendingChanges = {
          matrix,
          modifiedCells: Array.from(modifiedCells),
          timestamp: Date.now(),
        };
        localStorage.setItem(PENDING_CHANGES_KEY, JSON.stringify(pendingChanges));

        // Redirect to login with return URL
        const returnUrl = encodeURIComponent('/budget');
        router.push(`/login?returnUrl=${returnUrl}`);
        return;
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save changes');
      }

      setModifiedCells(new Set());

      // Remove retry toast if it was a retry
      if (retryToastId) {
        dismissToast(retryToastId);
      }

      showToast('Budget matrix saved successfully', 'success');
    } catch (error) {
      console.error('Error saving budget matrix:', error);

      const errorMessage = error instanceof Error ? error.message : 'Failed to save changes';

      // Remove retry toast if it was a retry (we'll show a new one)
      if (retryToastId) {
        dismissToast(retryToastId);
      }

      // Show toast with retry button
      showToast(errorMessage, 'error', () => {
        performSave(updates);
      });
    } finally {
      setIsSaving(false);
      // Clear retrying state from all toasts
      setToasts((prev) =>
        prev.map((t) => ({ ...t, isRetrying: false }))
      );
    }
  }, [isAdmin, matrix, modifiedCells, router, showToast, dismissToast]);

  const handleSave = useCallback(async () => {
    if (!isAdmin || modifiedCells.size === 0) return;

    const updates: BudgetCellUpdate[] = [];

    for (const cellKey of modifiedCells) {
      const [categoryId, motiveId] = cellKey.split('_');
      updates.push({
        categoryId,
        motiveId,
        amount: matrix[cellKey] || 0,
      });
    }

    await performSave(updates);
  }, [isAdmin, modifiedCells, matrix, performSave]);

  const handleRetry = useCallback((toastId: string) => {
    const t = toasts.find((t) => t.id === toastId);
    if (t?.onRetry) {
      t.onRetry();
    }
  }, [toasts]);

  // Motive CRUD handlers
  const handleAddMotive = useCallback(async (name: string) => {
    setIsMutating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/motives`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to add motive');
      }
      toast.success(`Motive "${name}" added`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add motive');
    } finally {
      setIsMutating(false);
    }
  }, [projectId, router]);

  const handleRenameMotive = useCallback(async (id: string, name: string) => {
    setIsMutating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/motives/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to rename motive');
      }
      toast.success(`Motive renamed to "${name}"`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to rename motive');
    } finally {
      setIsMutating(false);
    }
  }, [projectId, router]);

  const handleDeleteMotive = useCallback((id: string, name: string) => {
    setDeleteConfirm({ type: 'motive', id, name });
  }, []);

  // Category CRUD handlers
  const handleAddCategory = useCallback(async (name: string) => {
    setIsMutating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to add category');
      }
      toast.success(`Category "${name}" added`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add category');
    } finally {
      setIsMutating(false);
    }
  }, [projectId, router]);

  const handleRenameCategory = useCallback(async (id: string, name: string) => {
    setIsMutating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to rename category');
      }
      toast.success(`Category renamed to "${name}"`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to rename category');
    } finally {
      setIsMutating(false);
    }
  }, [projectId, router]);

  const handleDeleteCategory = useCallback((id: string, name: string) => {
    setDeleteConfirm({ type: 'category', id, name });
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteConfirm) return;
    const { type, id, name } = deleteConfirm;
    setDeleteConfirm(null);
    setIsMutating(true);
    try {
      const url =
        type === 'motive'
          ? `/api/projects/${projectId}/motives/${id}`
          : `/api/projects/${projectId}/categories/${id}`;
      const res = await fetch(url, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `Failed to delete ${type}`);
      }
      toast.success(`${type === 'motive' ? 'Motive' : 'Category'} "${name}" deleted`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to delete ${type}`);
    } finally {
      setIsMutating(false);
    }
  }, [deleteConfirm, projectId, router]);

  const hasChanges = modifiedCells.size > 0;

  return (
    <div className="space-y-4">
      {/* Header: Save button (admin only) + Brutto/Netto toggle (always, right-aligned) */}
      <div className="flex items-center gap-4">
        {isAdmin && (
          <button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className={`
              px-4 py-2 rounded-lg font-medium text-sm transition-colors
              ${
                hasChanges
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }
            `}
          >
            {isSaving ? (
              <span className="flex items-center gap-2">
                <svg
                  className="animate-spin h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Saving...
              </span>
            ) : (
              `Save Changes${hasChanges ? ` (${modifiedCells.size})` : ''}`
            )}
          </button>
        )}
        <div
          className="ml-auto flex items-center rounded-lg border border-zinc-200 overflow-hidden"
          role="group"
          aria-label="Amount display mode"
        >
          <button
            type="button"
            onClick={() => setAmountMode('brutto')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              amountMode === 'brutto'
                ? 'bg-[#6366f1] text-white'
                : 'bg-white text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700'
            }`}
            aria-pressed={amountMode === 'brutto'}
          >
            Brutto
          </button>
          <button
            type="button"
            onClick={() => setAmountMode('netto')}
            className={`px-3 py-1.5 text-xs font-medium border-l border-zinc-200 transition-colors ${
              amountMode === 'netto'
                ? 'bg-[#6366f1] text-white'
                : 'bg-white text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700'
            }`}
            aria-pressed={amountMode === 'netto'}
          >
            Netto
          </button>
        </div>
      </div>

      {/* Matrix table */}
      <BudgetMatrixTable
        motives={motives}
        categories={categories}
        matrix={matrix}
        motiveSpending={motiveSpending}
        categorySpending={categorySpending}
        cellSpending={cellSpending}
        isAdmin={isAdmin}
        editingCell={editingCell}
        modifiedCells={modifiedCells}
        onEditStart={handleEditStart}
        onEditSave={handleEditSave}
        onEditCancel={handleEditCancel}
        projectId={projectId}
        isMutating={isMutating}
        onAddMotive={handleAddMotive}
        onRenameMotive={handleRenameMotive}
        onDeleteMotive={handleDeleteMotive}
        onAddCategory={handleAddCategory}
        onRenameCategory={handleRenameCategory}
        onDeleteCategory={handleDeleteCategory}
      />

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-400"></div>
          <span className="text-slate-600">≤ 80% spent</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-400"></div>
          <span className="text-slate-600">80-100% spent</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-rose-400"></div>
          <span className="text-slate-600">&gt; 100% spent</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-slate-300"></div>
          <span className="text-slate-600">No budget</span>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-400 ring-2 ring-amber-400"></div>
            <span className="text-slate-600">Unsaved changes</span>
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <ConfirmationDialog
        isOpen={deleteConfirm !== null}
        title={`Delete ${deleteConfirm?.type === 'motive' ? 'Motive' : 'Category'}`}
        message={`Are you sure you want to delete "${deleteConfirm?.name}"? This will remove it from the budget matrix.`}
        confirmText="Delete"
        isDestructive={true}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirm(null)}
      />

      {/* Toasts */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`
              px-4 py-3 rounded-lg shadow-lg text-sm font-medium
              transition-all duration-300 animate-in slide-in-from-bottom-2
              flex items-center gap-3
              ${
                t.type === 'success'
                  ? 'bg-green-100 text-green-800 border border-green-200'
                  : 'bg-rose-100 text-rose-800 border border-rose-200'
              }
            `}
          >
            <span className="flex-1">{t.message}</span>
            {t.type === 'error' && t.onRetry && (
              <button
                onClick={() => handleRetry(t.id)}
                disabled={t.isRetrying}
                className={`
                  px-3 py-1 rounded text-xs font-semibold
                  ${t.isRetrying
                    ? 'bg-rose-200 text-rose-400 cursor-not-allowed'
                    : 'bg-rose-800 text-white hover:bg-rose-900'
                  }
                `}
              >
                {t.isRetrying ? 'Retrying...' : 'Retry'}
              </button>
            )}
            <button
              onClick={() => dismissToast(t.id)}
              className="text-slate-400 hover:text-slate-600 ml-1"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
