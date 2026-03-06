'use client';

import { useState, useCallback } from 'react';

interface BudgetMatrixCellProps {
  budget: number;
  spent: number;
  isEditing: boolean;
  isAdmin: boolean;
  isModified?: boolean;
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
    return 'bg-zinc-50 text-zinc-400';
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
  isModified = false,
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

  // Truncate large numbers for display
  const formatCurrencyTruncated = (amount: number) => {
    const formatted = formatCurrency(amount);
    // For display purposes, we keep the full number but use CSS truncation
    return formatted;
  };

  if (isEditing) {
    return (
      <div className="p-2 bg-violet-50 border-2 border-[#7C6AF6] rounded">
        <input
          type="number"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          min="0"
          step="0.01"
          autoFocus
          className="w-full px-2 py-1 text-sm border border-zinc-300 rounded focus:outline-none focus:ring-2 focus:ring-[#7C6AF6] font-mono-numbers"
        />
      </div>
    );
  }

  return (
    <div
      onClick={handleClick}
      title={`Budget: ${formatCurrency(budget)}\nSpent: ${formatCurrency(spent)}`}
      className={`
        p-2 rounded cursor-pointer transition-colors relative overflow-hidden
        ${isAdmin ? 'hover:bg-[rgba(124,106,246,0.06)]' : ''}
        ${varianceStyle}
        ${isModified ? 'ring-2 ring-amber-400 ring-inset' : ''}
      `}
    >
      {/* Modified indicator dot */}
      {isModified && (
        <div className="absolute top-1 right-1 w-2 h-2 bg-amber-500 rounded-full" title="Unsaved changes" />
      )}
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium tabular-nums truncate block font-mono-numbers" title={formatCurrency(budget)}>
          {formatCurrencyTruncated(budget)}
        </span>
        <div className="flex items-center justify-between min-w-0">
          <span className="text-xs text-zinc-500 tabular-nums truncate font-mono-numbers" title={formatCurrency(spent)}>
            {formatCurrencyTruncated(spent)}
          </span>
          <span
            className={`
              text-xs font-medium tabular-nums px-1.5 py-0.5 rounded-full shrink-0 ml-1
              ${budget === 0 ? 'bg-zinc-200 text-zinc-500' : ''}
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
