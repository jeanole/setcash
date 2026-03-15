'use client';

import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  width?: string;
  cell: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  sortable?: boolean;
  sortColumn?: string | null;
  sortDir?: 'asc' | 'desc';
  onSort?: (column: string) => void;
  selectable?: boolean;
  selectedIds?: string[];
  onSelect?: (id: string, selected: boolean) => void;
  onSelectAll?: (selected: boolean) => void;
  keyExtractor: (row: T) => string;
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
}

export default function DataTable<T>({
  columns,
  data,
  sortable = false,
  sortColumn,
  sortDir = 'asc',
  onSort,
  selectable = false,
  selectedIds = [],
  onSelect,
  onSelectAll,
  keyExtractor,
  isLoading = false,
  emptyMessage = 'No data found',
  onRowClick,
}: DataTableProps<T>) {
  const allSelected = data.length > 0 && data.every((row) => selectedIds.includes(keyExtractor(row)));
  const someSelected = selectedIds.length > 0 && !allSelected;

  const handleSort = (column: Column<T>) => {
    if (!sortable || !column.sortable || !onSort) return;
    onSort(column.key);
  };

  const renderSortIndicator = (column: Column<T>) => {
    if (!sortable || !column.sortable) return null;
    if (sortColumn !== column.key) {
      return <span className="ml-1 text-zinc-300 opacity-0 group-hover:opacity-100">↕</span>;
    }
    return (
      <span className="ml-1 text-[var(--accent)]">
        {sortDir === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-[var(--vb-card-border)] shadow-[var(--vb-shadow-sm)] overflow-hidden">
        <div className="animate-pulse">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 border-b border-zinc-100">
              <div className="w-4 h-4 bg-zinc-200 rounded" />
              <div className="flex-1 h-4 bg-zinc-200 rounded" />
              <div className="w-24 h-4 bg-zinc-200 rounded" />
              <div className="w-20 h-4 bg-zinc-200 rounded" />
              <div className="w-16 h-4 bg-zinc-200 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-[var(--vb-card-border)] shadow-[var(--vb-shadow-sm)] p-8 text-center">
        <p className="text-zinc-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-[var(--vb-card-border)] shadow-[var(--vb-shadow-sm)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-zinc-50 border-b border-[var(--vb-card-border)]">
            <tr>
              {selectable && (
                <th className="px-3 py-3 w-10">
                  <input
                    type="checkbox"
                    className="rounded border-zinc-300 text-[var(--accent)] focus:ring-[var(--accent)]"
                    checked={allSelected}
                    ref={(input) => {
                      if (input) input.indeterminate = someSelected;
                    }}
                    onChange={(e) => onSelectAll?.(e.target.checked)}
                    aria-label="Select all rows"
                  />
                </th>
              )}
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    'px-3 py-3 text-left text-[10.5px] font-semibold text-zinc-400 uppercase tracking-[0.1em]',
                    sortable && column.sortable && 'cursor-pointer hover:text-zinc-600 group'
                  )}
                  style={{ width: column.width }}
                  onClick={() => handleSort(column)}
                >
                  <div className="flex items-center">
                    {column.header}
                    {renderSortIndicator(column)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {data.map((row) => {
              const rowId = keyExtractor(row);
              const isSelected = selectedIds.includes(rowId);
              return (
                <tr
                  key={rowId}
                  className={cn(
                    'transition-colors',
                    isSelected && 'bg-indigo-50/40',
                    onRowClick && 'cursor-pointer hover:bg-indigo-50/40'
                  )}
                  onClick={() => onRowClick?.(row)}
                >
                  {selectable && (
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="rounded border-zinc-300 text-[var(--accent)] focus:ring-[var(--accent)]"
                        checked={isSelected}
                        onChange={(e) => onSelect?.(rowId, e.target.checked)}
                        aria-label={`Select row ${rowId}`}
                      />
                    </td>
                  )}
                  {columns.map((column) => (
                    <td key={`${rowId}-${column.key}`} className="px-3 py-3">
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
