'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { AllocationOption, Allocation } from '@/lib/types';
import { formatCurrency, cn } from '@/lib/utils';

interface AllocationWidgetProps {
  type: 'motive' | 'category';
  options: AllocationOption[];
  value: Allocation[];
  onChange: (allocations: Allocation[]) => void;
  totalAmount: number;
  readOnly?: boolean;
}

export default function AllocationWidget({
  type,
  options,
  value,
  onChange,
  totalAmount,
  readOnly = false,
}: AllocationWidgetProps) {
  const defaultName = type === 'motive' ? 'Default' : 'Uncategorized';
  const label = type === 'motive' ? 'Motive' : 'Category';

  // Filter out the default option from selectable options
  const selectableOptions = options.filter((o) => o.name !== defaultName);
  const defaultOpt = options.find((o) => o.name === defaultName);

  // Internal state for the editable rows (excluding default)
  const [rows, setRows] = useState<{ id: string; percentage: number }[]>([]);

  // Ref to prevent the useEffect from overwriting rows when the change originated internally
  const isInternalUpdate = useRef<boolean>(false);

  // Sync with external value — skip when the change was triggered by this component
  useEffect(() => {
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }
    const nonDefaultRows = value
      .filter((a) => a.name !== defaultName)
      .map((a) => ({ id: a.id, percentage: a.percentage }));
    setRows(nonDefaultRows);
  }, [value, defaultName]);

  const calculateRemaining = useCallback(() => {
    const totalPct = rows.reduce((sum, r) => sum + (r.percentage || 0), 0);
    return Math.max(0, 100 - totalPct);
  }, [rows]);

  const remainingPct = calculateRemaining();
  const totalPct = rows.reduce((sum, r) => sum + (r.percentage || 0), 0);
  const isOverAllocated = totalPct > 100;

  const addRow = () => {
    if (readOnly) return;
    isInternalUpdate.current = true;
    setRows([...rows, { id: '', percentage: 0 }]);
  };

  const removeRow = (index: number) => {
    if (readOnly) return;
    const newRows = rows.filter((_, i) => i !== index);
    isInternalUpdate.current = true;
    setRows(newRows);
    updateParent(newRows);
  };

  const updateRow = (index: number, field: 'id' | 'percentage', val: string | number) => {
    if (readOnly) return;
    const newRows = [...rows];
    if (field === 'id') {
      newRows[index].id = val as string;
    } else {
      newRows[index].percentage = Math.max(0, Math.min(100, Math.round(Number(val) || 0)));
    }
    isInternalUpdate.current = true;
    setRows(newRows);
    updateParent(newRows);
  };

  const updateParent = (currentRows: { id: string; percentage: number }[]) => {
    const allocations: Allocation[] = currentRows
      .filter((r) => r.id)
      .map((r) => {
        const opt = options.find((o) => o.id === r.id);
        return { id: r.id, name: opt?.name || '', percentage: r.percentage };
      });

    // Add default allocation for remaining percentage
    const currentTotal = currentRows.reduce((sum, r) => sum + (r.percentage || 0), 0);
    const remaining = Math.max(0, 100 - currentTotal);
    if (remaining > 0 && defaultOpt) {
      allocations.push({ id: defaultOpt.id, name: defaultName, percentage: remaining });
    }

    onChange(allocations);
  };

  // Update amounts when total changes (for display purposes only)
  const getAmount = (percentage: number) => {
    return (totalAmount || 0) * (percentage / 100);
  };

  return (
    <div className="space-y-2">
      {/* Editable rows */}
      {rows.map((row, idx) => {
        const selectedOption = options.find((o) => o.id === row.id);
        return (
          <div key={idx} className="flex items-center gap-2">
            <select
              value={row.id}
              onChange={(e) => updateRow(idx, 'id', e.target.value)}
              disabled={readOnly}
              className="flex-1 max-w-[240px] px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] outline-none transition-colors bg-white disabled:opacity-50"
            >
              <option value="">-- Select {label} --</option>
              {selectableOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.name}
                </option>
              ))}
            </select>

            <input
              type="number"
              min="0"
              max="100"
              step="1"
              value={row.percentage}
              onChange={(e) => updateRow(idx, 'percentage', e.target.value)}
              disabled={readOnly}
              className="w-20 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] outline-none transition-colors disabled:opacity-50"
            />

            <span className="text-sm text-slate-500">%</span>

            <span className="ml-2 text-sm text-slate-400 min-w-[80px]">
              {formatCurrency(getAmount(row.percentage))}
            </span>

            {!readOnly && (
              <button
                type="button"
                onClick={() => removeRow(idx)}
                className="ml-2 text-sm px-2 py-1.5 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors"
                aria-label="Remove row"
              >
                ×
              </button>
            )}
          </div>
        );
      })}

      {/* Default/Uncategorized row (read-only) */}
      {remainingPct > 0 && defaultOpt && (
        <div className="flex items-center gap-2 opacity-60">
          <select disabled className="flex-1 max-w-[240px] px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 cursor-not-allowed">
            <option>{defaultName}</option>
          </select>

          <input
            type="number"
            value={remainingPct}
            readOnly
            className="w-20 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 cursor-not-allowed"
          />

          <span className="text-sm text-slate-500">%</span>

          <span className="ml-2 text-sm text-slate-400 min-w-[80px]">
            {formatCurrency(getAmount(remainingPct))}
          </span>

          {!readOnly && <span className="ml-2 w-8" />}
        </div>
      )}

      {/* Add button */}
      {!readOnly && (
        <button
          type="button"
          onClick={addRow}
          className="text-sm px-3 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors mt-2"
        >
          + Add {label}
        </button>
      )}

      {/* Total indicator */}
      {(rows.length > 0 || remainingPct < 100) && (
        <div
          className={cn(
            'mt-3 text-sm font-medium',
            isOverAllocated ? 'text-rose-600' : 'text-emerald-600'
          )}
        >
          {isOverAllocated
            ? `Total: ${totalPct}% (${totalPct - 100}% over!)`
            : 'Total: 100% allocated'}
        </div>
      )}

      {/* Empty state */}
      {rows.length === 0 && remainingPct === 100 && (
        <p className="text-sm text-slate-400">
          No allocations. All will go to {defaultName}.
        </p>
      )}
    </div>
  );
}
