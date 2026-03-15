'use client';

import { useRouter } from 'next/navigation';
import { Bill } from '@/lib/types';
import { formatDate, formatCurrency, calculateTotal, cn } from '@/lib/utils';
import BillStatusBadge from './BillStatusBadge';

interface BillDetailHeaderProps {
  bill: Bill;
  onApprove: () => void;
  onReject: () => void;
  onDelete: () => void;
  onAnalyse: () => void;
  onRevertDraft: () => void;
  isAdmin: boolean;
  canDelete: boolean;
  canSelfApprove?: boolean;
  hasOcrEnabled: boolean;
  isAnalysing: boolean;
}

const STATUS_ACCENT: Record<string, string> = {
  draft:     'border-l-rose-400',
  confirmed: 'border-l-slate-300',
  approved:  'border-l-emerald-500',
  rejected:  'border-l-rose-500',
  paid:      'border-l-indigo-500',
};

const Spinner = () => (
  <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" aria-hidden="true">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

export default function BillDetailHeader({
  bill,
  onApprove,
  onReject,
  onDelete,
  onAnalyse,
  onRevertDraft,
  isAdmin,
  canDelete,
  canSelfApprove,
  hasOcrEnabled,
  isAnalysing,
}: BillDetailHeaderProps) {
  const router = useRouter();
  const total = calculateTotal(bill.brutto19, bill.brutto7, bill.brutto0);
  const isDraft = bill.status === 'draft' || !bill.vendor || total === 0;
  const hasImages = bill.images && bill.images.length > 0;
  const canAnalyse = hasOcrEnabled && hasImages && bill.ocrStatus !== 'pending';

  const statusKey = isDraft ? 'draft' : bill.status;
  const accentClass = STATUS_ACCENT[statusKey] || STATUS_ACCENT.confirmed;

  return (
    <div className="space-y-3">
      {/* Back navigation */}
      <button
        onClick={() => router.push('/bills')}
        className="group inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
      >
        <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Bills
      </button>

      {/* Header document card */}
      <div className={cn(
        'bg-white rounded-xl border border-slate-200 shadow-sm border-l-4 overflow-hidden',
        accentClass
      )}>
        {/* Main body */}
        <div className="p-6 flex flex-col lg:flex-row lg:items-start gap-6">

          {/* Left — document identity */}
          <div className="flex-1 min-w-0 space-y-3">
            {/* Bill number + badges row */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest font-mono">
                {bill.billNumber ?? `#${bill.id.slice(0, 8)}`}
              </span>
              {isDraft && <BillStatusBadge status="draft" isDraft />}
              {bill.status !== 'draft' && <BillStatusBadge status={bill.status} />}
              {bill.ocrStatus === 'done' && (bill.ocrFields?.length ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  AI check
                </span>
              )}
              {bill.ocrStatus === 'failed' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-600 border border-rose-200">
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Analysis failed
                </span>
              )}
            </div>

            {/* Vendor name — the headline */}
            <div>
              <h1 className="text-xl font-bold text-slate-900 leading-tight">
                {bill.vendor || <span className="text-slate-400 italic font-normal">No vendor</span>}
              </h1>
              {bill.item && (
                <p className="text-sm text-slate-500 mt-0.5">{bill.item}</p>
              )}
            </div>

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
              <span className="font-mono-numbers">{formatDate(bill.date)}</span>
              <span>·</span>
              <span>{bill.email}</span>
              <span>·</span>
              <span className="capitalize">{bill.type || 'Kauf'}</span>
            </div>

            {/* Comment */}
            {bill.comment && (
              <p className="text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100 italic">
                &ldquo;{bill.comment}&rdquo;
              </p>
            )}
          </div>

          {/* Right — amount display */}
          <div className="lg:text-right shrink-0">
            <p className="text-3xl font-bold text-slate-900 font-mono-numbers tracking-tight">
              {formatCurrency(total)}
            </p>
            <p className="text-xs text-slate-400 mt-0.5 uppercase tracking-wider">brutto gesamt</p>
            {bill.nettoAmount != null && bill.nettoAmount !== total && (
              <p className="text-sm text-slate-500 font-mono-numbers mt-1">
                {formatCurrency(bill.nettoAmount)}{' '}
                <span className="text-slate-400">netto</span>
              </p>
            )}
          </div>
        </div>

        {/* Actions strip */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/60 flex flex-wrap items-center gap-2">
          {canAnalyse && (
            <button
              onClick={onAnalyse}
              disabled={isAnalysing}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                bill.ocrStatus === 'done'
                  ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                  : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100',
                isAnalysing && 'opacity-60 cursor-not-allowed'
              )}
            >
              {isAnalysing ? <Spinner /> : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              )}
              {isAnalysing ? 'Analysing…' : (bill.ocrStatus === 'done' ? 'Re-analyse' : 'AI Analyse')}
            </button>
          )}

          {isAdmin && (
            <>
              {bill.status !== 'approved' && bill.status !== 'paid' && (
                <button
                  onClick={onApprove}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold hover:bg-emerald-100 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Approve
                </button>
              )}
              {bill.status !== 'rejected' && (
                <button
                  onClick={onReject}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-xs font-semibold hover:bg-rose-100 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Reject
                </button>
              )}
            </>
          )}

          {canSelfApprove && (
            <>
              <button
                onClick={onApprove}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold hover:bg-emerald-100 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Approve
              </button>
              <button
                onClick={onRevertDraft}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-xs font-semibold hover:bg-slate-200 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
                Revert to Draft
              </button>
            </>
          )}

          {/* Spacer */}
          <span className="flex-1" />

          {canDelete && (
            <button
              onClick={onDelete}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
