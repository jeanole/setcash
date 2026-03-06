'use client';

import { useState, useCallback } from 'react';

interface BudgetMatrixCellProps {
  budget: number;
  spent: number;
  isEditing: boolean;
  isAdmin: boolean;
  onEditStart: () => void;
  onEditSave: (value: number) => void;
  onEditCancel: () => void;
}

// German currency formatter
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
};

// Get variance color based on spent vs budget
const getVarianceStyle = (budget: number, spent: number): string => {
  if (budget === 0) {
    return 'bg-slate-50 text-slate-400';
  }

  const percentUsed = (spent / budget) * 100;

  if (percentUsed > 100) {
    return 'bg-rose-50 text-rose-800 border-l-4 border-rose-400';
  } else if (percentUsed > 80) {
    return 'bg-amber-50 text-amber-800 border-l-4 border-amber-400';
  } else {
    return 'bg-green-50 text-green-800 border-l-4 border-green-400';
  }
};

// Get variance indicator text
const getVarianceIndicator = (budget: number, spent: number): string => {
  if (budget === 0) {
    return '—';
  }

  const percentUsed = Math.round((spent / budget) * 100);

  if (percentUsed > 100) {
    return `${percentUsed}%`;
  } else if (percentUsed > 80) {
    return `${percentUsed}%`;
  } else {
    return `${percentUsed}%`;
  }
};

export default function BudgetMatrixCell({
  budget,
  spent,
  isEditing,
  isAdmin,
  onEditStart,
  onEditSave,
  onEditCancel,
}: BudgetMatrixCellProps) {
  const [editValue, setEditValue] = useState<string>(budget.toString());

  const handleClick = useCallback(() => {
    if (isAdmin && !isEditing) {
      setEditValue(budget.toString());
      onEditStart();
    }
  }, [isAdmin, isEditing, budget, onEditStart]);

  const handleSave = useCallback(() => {
    const value = parseFloat(editValue);
    if (!isNaN(value) && value >= 0) {
      onEditSave(value);
    } else {
      onEditCancel();
    }
  }, [editValue, onEditSave, onEditCancel]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleSave();
      } else if (e.key === 'Escape') {
        onEditCancel();
      }
    },
    [handleSave, onEditCancel]
  );

  const handleBlur = useCallback(() => {
    handleSave();
  }, [handleSave]);

  const varianceStyle = getVarianceStyle(budget, spent);
  const varianceIndicator = getVarianceIndicator(budget, spent);

  if (isEditing) {
    return (
      <div className="p-2 bg-blue-50 border-2 border-blue-400 rounded">
        <input
          type="number"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          min="0"
          step="0.01"
          autoFocus
          className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    );
  }

  return (
    <div
      onClick={handleClick}
      className={`
        p-2 rounded cursor-pointer transition-colors
        ${isAdmin ? 'hover:bg-slate-100' : ''}
        ${varianceStyle}
      `}
    >
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium tabular-nums">
          {formatCurrency(budget)}
        </span>
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500 tabular-nums">
            {formatCurrency(spent)}
          </span>
          <span
            className={`
              text-xs font-medium tabular-nums px-1.5 py-0.5 rounded-full
              ${budget === 0 ? 'bg-slate-200 text-slate-500' : ''}
              ${budget > 0 && spent <= budget * 0.8 ? 'bg-green-200 text-green-700' : ''}
              ${budget > 0 && spent > budget * 0.8 && spent <= budget ? 'bg-amber-200 text-amber-700' : ''}
              ${budget > 0 && spent > budget ? 'bg-rose-200 text-rose-700' : ''}
            `}
          >
            {varianceIndicator}
          </span>
        </div>
      </div>
    </div>
  );
}
