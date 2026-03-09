'use client';

import { useRouter } from 'next/navigation';
import { Bill } from '@/lib/types';
import { formatDate, formatCurrency, calculateTotal, cn } from '@/lib/utils';
import BillStatusBadge from './BillStatusBadge';

interface BillDetailHeaderProps {
  bill: Bill;
  onApprove: () => void;
  onReject: () => void;
  onMarkPaid: () => void;
  onDelete: () => void;
  onAnalyse: () => void;
  isAdmin: boolean;
  hasOcrEnabled: boolean;
  isAnalysing: boolean;
}

export default function BillDetailHeader({
  bill,
  onApprove,
  onReject,
  onMarkPaid,
  onDelete,
  onAnalyse,
  isAdmin,
  hasOcrEnabled,
  isAnalysing,
}: BillDetailHeaderProps) {
  const router = useRouter();
  const total = calculateTotal(bill.brutto19, bill.brutto7, bill.brutto0);
  const isDraft = bill.status === 'draft' || !bill.vendor || total === 0;
  const hasImages = bill.images && bill.images.length > 0;
  const canAnalyse = hasOcrEnabled && hasImages && bill.ocrStatus !== 'pending';

  return (
    <div className="space-y-4">
      {/* Back button */}
      <button
        onClick={() => router.push('/bills')}
        className="inline-flex items-center text-sm text-zinc-600 hover:text-zinc-900 transition-colors"
      >
        <svg
          className="w-4 h-4 mr-1"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Back to Bills
      </button>

      {/* Header card */}
      <div className="bg-white rounded-xl border border-[var(--vb-card-border)] shadow-[var(--vb-shadow-sm)] p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          {/* Left side - Info */}
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-zinc-900 font-mono-numbers">
                Bill {bill.billNumber || `#${bill.id}`}
              </h1>
              {isDraft && <BillStatusBadge status="draft" isDraft />}
              <BillStatusBadge status={bill.status} />

              {/* OCR status badges */}
              {bill.ocrStatus === 'done' && (bill.ocrFields?.length ?? 0) > 0 && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200"
                  aria-label="AI analysis complete — unverified fields present"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  AI check
                </span>
              )}
              {bill.ocrStatus === 'failed' && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-700 border border-rose-200"
                  aria-label="AI analysis failed"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Analysis failed
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-600">
              <span className="font-mono-numbers">{formatDate(bill.date)}</span>
              <span className="text-zinc-300">•</span>
              <span>{bill.email}</span>
              <span className="text-zinc-300">•</span>
              <span>{bill.type || 'Kauf'}</span>
            </div>

            <div className="pt-2">
              <p className="text-zinc-900 font-medium">{bill.vendor || 'No vendor'}</p>
              {bill.item && <p className="text-zinc-600">{bill.item}</p>}
            </div>

            {/* Amount summary */}
            <div className="flex items-baseline gap-2 pt-2">
              <span className="text-2xl font-bold text-zinc-900 font-mono-numbers">
                {formatCurrency(total)}
              </span>
              <span className="text-zinc-500">brutto</span>
              <span className="text-zinc-300">|</span>
              <span className="text-zinc-600 font-mono-numbers">
                {formatCurrency(bill.nettoAmount)} netto
              </span>
            </div>
          </div>

          {/* Right side - Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Analysis button */}
            {canAnalyse && (
              <button
                onClick={onAnalyse}
                disabled={isAnalysing}
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors',
                  bill.ocrStatus === 'done'
                    ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                    : 'bg-violet-50 text-[#7C6AF6] border border-violet-200 hover:bg-violet-100',
                  isAnalysing && 'opacity-50 cursor-not-allowed'
                )}
              >
                {isAnalysing ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
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
                    Analysing...
                  </>
                ) : (
                  <>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                    {bill.ocrStatus === 'done' || bill.ocrFields?.length
                      ? 'Re-analyse'
                      : 'Analyse'}
                  </>
                )}
              </button>
            )}

            {/* Admin actions */}
            {isAdmin && (
              <>
                {bill.status !== 'approved' && bill.status !== 'paid' && (
                  <button
                    onClick={onApprove}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-medium text-sm hover:bg-emerald-100 transition-colors"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    Approve
                  </button>
                )}

                {bill.status !== 'rejected' && (
                  <button
                    onClick={onReject}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg font-medium text-sm hover:bg-rose-100 transition-colors"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                    Reject
                  </button>
                )}

                {bill.status !== 'paid' && (
                  <button
                    onClick={onMarkPaid}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg font-medium text-sm hover:bg-blue-100 transition-colors"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    Mark Paid
                  </button>
                )}
              </>
            )}

            {/* Delete button */}
            <button
              onClick={onDelete}
              className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-100 text-zinc-700 rounded-lg font-medium text-sm hover:bg-zinc-200 transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              Delete
            </button>
          </div>
        </div>

        {/* Comment */}
        {bill.comment && (
          <div className="mt-4 pt-4 border-t border-zinc-100">
            <p className="text-sm text-zinc-600">
              <span className="font-medium text-zinc-700">Comment:</span>{' '}
              {bill.comment}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
