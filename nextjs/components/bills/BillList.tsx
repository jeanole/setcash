'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Bill, SortState } from '@/lib/types';
import {
  formatCurrency,
  formatDate,
  formatAllocations,
  cn,
} from '@/lib/utils';
import BillStatusBadge from './BillStatusBadge';

interface BillListProps {
  bills: Bill[];
  onDelete: (id: string) => void;
  isAdmin: boolean;
  isLoading?: boolean;
}

export default function BillList({
  bills,
  onDelete,
  isAdmin,
  isLoading = false,
}: BillListProps) {
  const router = useRouter();
  const [sort, setSort] = useState<SortState>({ column: null, dir: 'asc' });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const handleSort = (column: string) => {
    setSort((prev) => ({
      column,
      dir: prev.column === column && prev.dir === 'asc' ? 'desc' : 'asc',
    }));
  };

  const sortedBills = useMemo(() => {
    if (!sort.column) return bills;

    return [...bills].sort((a, b) => {
      let va: number | string = 0;
      let vb: number | string = 0;

      switch (sort.column) {
        case 'date':
          va = new Date(a.date || 0).getTime();
          vb = new Date(b.date || 0).getTime();
          break;
        case 'total':
          va = calculateTotal(a);
          vb = calculateTotal(b);
          break;
        case 'netto':
          va = a.nettoAmount || 0;
          vb = b.nettoAmount || 0;
          break;
        case 'brutto19':
          va = a.brutto19 || 0;
          vb = b.brutto19 || 0;
          break;
        case 'brutto7':
          va = a.brutto7 || 0;
          vb = b.brutto7 || 0;
          break;
        case 'brutto0':
          va = a.brutto0 || 0;
          vb = b.brutto0 || 0;
          break;
        case 'vendor':
          va = a.vendor || '';
          vb = b.vendor || '';
          break;
        case 'billNumber':
          va = a.billNumber || '';
          vb = b.billNumber || '';
          break;
        default:
          va = (a[sort.column as keyof Bill] as string) || '';
          vb = (b[sort.column as keyof Bill] as string) || '';
      }

      if (typeof va === 'string') {
        va = va.toLowerCase();
        vb = (vb as string).toLowerCase();
      }

      if (va < vb) return sort.dir === 'asc' ? -1 : 1;
      if (va > vb) return sort.dir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [bills, sort]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === sortedBills.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(sortedBills.map((b) => b.id));
    }
  };

  const calculateTotal = (bill: Bill) => {
    return (bill.brutto19 || 0) + (bill.brutto7 || 0) + (bill.brutto0 || 0);
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sort.column !== column) {
      return <span className="ml-1 text-slate-300 opacity-0 group-hover:opacity-100">↕</span>;
    }
    return (
      <span className="ml-1 text-indigo-600">
        {sort.dir === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="animate-pulse">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 p-4 border-b border-slate-100"
            >
              <div className="w-4 h-4 bg-slate-200 rounded" />
              <div className="flex-1 h-4 bg-slate-200 rounded" />
              <div className="w-24 h-4 bg-slate-200 rounded" />
              <div className="w-20 h-4 bg-slate-200 rounded" />
              <div className="w-16 h-4 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (bills.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center animate-[vb-rise_0.4s_ease-out]">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-slate-900 mb-1">No bills yet</h3>
        <p className="text-sm text-slate-500 mb-4">
          Upload your first bill to get started
        </p>
        <button
          onClick={() => router.push('/bills/new')}
          className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Upload New Bill
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Desktop table */}
      <div className="hidden lg:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {isAdmin && (
                  <th className="px-3 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === sortedBills.length}
                      ref={(el) => {
                        if (el)
                          el.indeterminate =
                            selectedIds.length > 0 &&
                            selectedIds.length < sortedBills.length;
                      }}
                      onChange={toggleSelectAll}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </th>
                )}
                <th
                  className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 group"
                  onClick={() => handleSort('billNumber')}
                >
                  <div className="flex items-center">
                    Bill #
                    <SortIcon column="billNumber" />
                  </div>
                </th>
                <th
                  className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 group"
                  onClick={() => handleSort('date')}
                >
                  <div className="flex items-center">
                    Date
                    <SortIcon column="date" />
                  </div>
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Person
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Vendor
                </th>
                <th
                  className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 group"
                  onClick={() => handleSort('total')}
                >
                  <div className="flex items-center">
                    Total
                    <SortIcon column="total" />
                  </div>
                </th>
                <th
                  className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 group"
                  onClick={() => handleSort('netto')}
                >
                  <div className="flex items-center">
                    Netto
                    <SortIcon column="netto" />
                  </div>
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Allocations
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedBills.map((bill) => {
                const total = calculateTotal(bill);
                const isSelected = selectedIds.includes(bill.id);
                const isDraft = bill.status === 'draft' || !bill.vendor || total === 0;

                return (
                  <tr
                    key={bill.id}
                    className={cn(
                      'transition-colors hover:bg-slate-50',
                      isSelected && 'bg-indigo-50/50',
                      isDraft && 'bg-rose-50/30'
                    )}
                  >
                    {isAdmin && (
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(bill.id)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>
                    )}
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">
                          {bill.billNumber || '-'}
                        </span>
                        {isDraft && <BillStatusBadge status="draft" size="sm" isDraft />}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {formatDate(bill.date)}
                    </td>
                    <td className="px-3 py-3 text-slate-900">{bill.email}</td>
                    <td className="px-3 py-3 text-slate-600">
                      {bill.vendor || '-'}
                    </td>
                    <td className="px-3 py-3 tabular-nums font-medium text-slate-900">
                      {formatCurrency(total)}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-slate-600">
                      {formatCurrency(bill.nettoAmount)}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500 max-w-[200px] truncate">
                      {formatAllocations(bill.motiveAllocations)}
                      {bill.categoryAllocations?.length > 0 && (
                        <div className="text-slate-400 mt-0.5">
                          {formatAllocations(bill.categoryAllocations)}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <BillStatusBadge status={bill.status} size="sm" />
                    </td>
                    <td className="px-3 py-3">
                      <button
                        onClick={() => router.push(`/bills/${bill.id}`)}
                        className="text-sm px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="lg:hidden space-y-3">
        {sortedBills.map((bill) => {
          const total = calculateTotal(bill);
          const isSelected = selectedIds.includes(bill.id);
          const isDraft = bill.status === 'draft' || !bill.vendor || total === 0;

          return (
            <div
              key={bill.id}
              className={cn(
                'bg-white rounded-xl border border-slate-200 shadow-sm p-4 transition-colors',
                isSelected && 'ring-2 ring-indigo-500',
                isDraft && 'border-rose-200'
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {isAdmin && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(bill.id)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">
                        {bill.billNumber || '-'}
                      </span>
                      {isDraft && <BillStatusBadge status="draft" size="sm" isDraft />}
                    </div>
                    <p className="text-xs text-slate-500">{formatDate(bill.date)}</p>
                  </div>
                </div>
                <BillStatusBadge status={bill.status} size="sm" />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-slate-500">Person:</span>
                  <span className="ml-1 text-slate-900">{bill.email}</span>
                </div>
                <div>
                  <span className="text-slate-500">Vendor:</span>
                  <span className="ml-1 text-slate-900">{bill.vendor || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500">Total:</span>
                  <span className="ml-1 font-medium text-slate-900">
                    {formatCurrency(total)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Netto:</span>
                  <span className="ml-1 text-slate-900">
                    {formatCurrency(bill.nettoAmount)}
                  </span>
                </div>
              </div>

              {(bill.motiveAllocations?.length > 0 ||
                bill.categoryAllocations?.length > 0) && (
                <div className="mt-2 text-xs text-slate-500">
                  {formatAllocations(bill.motiveAllocations)}
                  {bill.categoryAllocations?.length > 0 && (
                    <div className="text-slate-400">
                      {formatAllocations(bill.categoryAllocations)}
                    </div>
                  )}
                </div>
              )}

              <div className="mt-3">
                <button
                  onClick={() => router.push(`/bills/${bill.id}`)}
                  className="w-full text-sm px-3 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
                >
                  View Details
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bulk actions */}
      {isAdmin && selectedIds.length > 0 && (
        <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-lg p-4 animate-[vb-rise_0.2s_ease-out]">
          <span className="text-sm text-indigo-700">
            {selectedIds.length} bill(s) selected
          </span>
          <button
            onClick={() => {
              if (confirm(`Delete ${selectedIds.length} selected bill(s)?`)) {
                selectedIds.forEach((id) => onDelete(id));
                setSelectedIds([]);
              }
            }}
            className="text-sm px-4 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors"
          >
            Delete Selected
          </button>
        </div>
      )}
    </div>
  );
}
