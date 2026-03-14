import Link from 'next/link';
import type { RecentBill } from '@/lib/dashboard';
import BillStatusBadge from '@/components/bills/BillStatusBadge';
import { formatDate, formatCurrency } from '@/lib/utils';

interface RecentBillsListProps {
  bills: RecentBill[];
}

export default function RecentBillsList({ bills }: RecentBillsListProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-700">Recent Bills</h2>
        <Link
          href="/bills"
          className="text-xs text-indigo-600 hover:text-indigo-800 transition-colors font-medium"
          aria-label="View all bills"
        >
          View all →
        </Link>
      </div>

      {bills.length === 0 ? (
        <p className="text-sm text-slate-400 py-6 text-center">No bills yet</p>
      ) : (
        <ul className="divide-y divide-slate-100" aria-label="Recent bills">
          {bills.map((bill) => {
            const total = bill.brutto19 + bill.brutto7 + bill.brutto0;
            return (
              <li key={bill.id} className="flex items-center justify-between py-2.5 gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">
                    {bill.vendor || '—'}
                  </p>
                  <p className="text-xs text-slate-400">{formatDate(bill.date)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-mono text-slate-600">{formatCurrency(total)}</span>
                  <BillStatusBadge status={bill.status} size="sm" />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
