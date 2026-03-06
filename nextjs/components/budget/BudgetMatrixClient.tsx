'use client';

import { useState, useCallback, useEffect } from 'react';
import BudgetMatrixTable from './BudgetMatrixTable';
import type { BudgetMatrixResponse, BudgetCellUpdate } from '@/lib/types';
import { useRouter } from 'next/navigation';

interface BudgetMatrixClientProps extends BudgetMatrixResponse {
  isAdmin: boolean;
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error';
  onRetry?: () => void;
  isRetrying?: boolean;
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
  isAdmin,
}: BudgetMatrixClientProps) {
  const router = useRouter();
  const [matrix, setMatrix] = useState<Record<string, number>>(initialMatrix);
  const [motiveSpending] = useState<Record<string, number>>(initialMotiveSpending);
  const [categorySpending] = useState<Record<string, number>>(initialCategorySpending);
  const [cellSpending] = useState<Record<string, number>>(initialCellSpending);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [modifiedCells, setModifiedCells] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

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
    const toast = toasts.find((t) => t.id === toastId);
    if (toast?.onRetry) {
      toast.onRetry();
    }
  }, [toasts]);

  const hasChanges = modifiedCells.size > 0;

  return (
    <div className="space-y-4">
      {/* Header with save button */}
      {isAdmin && (
        <div className="flex justify-end">
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
        </div>
      )}

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
      />

      {/* Toasts */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`
              px-4 py-3 rounded-lg shadow-lg text-sm font-medium
              transition-all duration-300 animate-in slide-in-from-bottom-2
              flex items-center gap-3
              ${
                toast.type === 'success'
                  ? 'bg-green-100 text-green-800 border border-green-200'
                  : 'bg-rose-100 text-rose-800 border border-rose-200'
              }
            `}
          >
            <span className="flex-1">{toast.message}</span>
            {toast.type === 'error' && toast.onRetry && (
              <button
                onClick={() => handleRetry(toast.id)}
                disabled={toast.isRetrying}
                className={`
                  px-3 py-1 rounded text-xs font-semibold
                  ${toast.isRetrying
                    ? 'bg-rose-200 text-rose-400 cursor-not-allowed'
                    : 'bg-rose-800 text-white hover:bg-rose-900'
                  }
                `}
              >
                {toast.isRetrying ? 'Retrying...' : 'Retry'}
              </button>
            )}
            <button
              onClick={() => dismissToast(toast.id)}
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
