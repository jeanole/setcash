'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';
import AppShell from '@/components/layout/AppShell';
import BillList from '@/components/bills/BillList';
import BillFilters from '@/components/bills/BillFilters';
import Pagination from '@/components/ui/Pagination';
import { useBills, useFilteredBills } from '@/lib/hooks/useBills';
import { FilterState, SortState, Bill } from '@/lib/types';
import { cn } from '@/lib/utils';

const CinematicButton = dynamic(() => import('@/components/cinematic/CinematicButton'), { ssr: false });

const BILLS_PER_PAGE = 25;

export default function BillsPage() {
  const router = useRouter();
  const { bills, logs, isLoading, error, refetch, deleteBill, bulkDelete } = useBills();

  const [filters, setFilters] = useState<FilterState>({
    person: '',
    motive: '',
    category: '',
    role: '',
    type: '',
    dateFrom: '',
    dateTo: '',
    search: '',
  });

  const [sort, setSort] = useState<SortState>({ column: null, dir: 'asc' });
  const [page, setPage] = useState(1);
  const [resultMessage, setResultMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const filterOptions = useMemo(() => {
    const persons = [...new Set(bills.map((b) => b.email))].sort();
    const roles = [...new Set(bills.map((b) => b.role || 'Misc'))].sort();
    const types = [...new Set(bills.map((b) => b.type || 'Kauf'))].sort();

    const motivesMap = new Map<string, { id: string; name: string }>();
    const categoriesMap = new Map<string, { id: string; name: string }>();

    bills.forEach((bill) => {
      bill.motiveAllocations?.forEach((a) => {
        motivesMap.set(a.motiveId, { id: a.motiveId, name: a.name });
      });
      bill.categoryAllocations?.forEach((a) => {
        categoriesMap.set(a.categoryId, { id: a.categoryId, name: a.name });
      });
    });

    return {
      persons,
      motives: Array.from(motivesMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
      categories: Array.from(categoriesMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
      roles,
      types,
    };
  }, [bills]);

  const { bills: filteredBills, totalItems, totalPages } = useFilteredBills(
    bills,
    filters,
    sort,
    page,
    BILLS_PER_PAGE
  );

  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'admin' || session?.user?.role === 'superadmin';

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this bill?')) return;
    const success = await deleteBill(id);
    if (success) {
      setResultMessage({ type: 'success', text: 'Bill deleted successfully' });
      setTimeout(() => setResultMessage(null), 5000);
    }
  };

  const handleBulkDelete = async (ids: string[]) => {
    if (!confirm(`Delete ${ids.length} selected bills?`)) return;
    const success = await bulkDelete(ids);
    if (success) {
      setResultMessage({ type: 'success', text: `${ids.length} bills deleted` });
      setTimeout(() => setResultMessage(null), 5000);
    }
  };

  const draftCount = bills.filter((b) => b.status === 'draft').length;

  return (
    <div className="space-y-6 animate-[vb-rise_0.4s_ease-out]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-[22px] font-semibold text-zinc-800">Bills</h1>
          {draftCount > 0 && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-700">
              {draftCount} draft
            </span>
          )}
        </div>
        <CinematicButton>
          <button
            onClick={() => router.push('/bills/new')}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[var(--vb-accent)] text-white font-medium rounded-lg hover:bg-[var(--vb-accent-hover)] active:scale-[0.97] transition-all shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Upload New Bill
          </button>
        </CinematicButton>
      </div>

      {/* Result message */}
      {resultMessage && (
        <div
          className={cn(
            'rounded-lg px-4 py-3 text-sm animate-[vb-rise_0.2s_ease-out]',
            resultMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-rose-50 text-rose-700 border border-rose-200'
          )}
        >
          {resultMessage.text}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg px-4 py-3 text-sm text-rose-700">
          <p>{error}</p>
          <button
            onClick={refetch}
            className="mt-2 text-sm font-medium text-rose-700 hover:text-rose-800 underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Filters */}
      <BillFilters filters={filters} onChange={setFilters} options={filterOptions} />

      {/* Stats */}
      <div className="flex items-center justify-between text-sm text-zinc-500">
        <span>
          Showing {filteredBills.length} of {bills.length} bills
          {totalItems !== bills.length && ` (${totalItems} filtered)`}
        </span>
        {isLoading && (
          <span className="flex items-center gap-2">
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Loading...
          </span>
        )}
      </div>

      {/* Bill list */}
      <BillList bills={filteredBills} onDelete={handleDelete} isAdmin={isAdmin} isLoading={isLoading} />

      {/* Pagination */}
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={totalItems}
        pageSize={BILLS_PER_PAGE}
        onPageChange={setPage}
      />
    </div>
  );
}
