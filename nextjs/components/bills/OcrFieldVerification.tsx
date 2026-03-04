'use client';

import { useState } from 'react';
import { cn, formatCurrency } from '@/lib/utils';

interface OcrField {
  name: string;
  value: string | number;
  confidence?: number;
}

interface OcrFieldVerificationProps {
  fields: string[]; // Field names that need verification
  billData: {
    date?: string;
    vendor?: string;
    item?: string;
    type?: string;
    brutto19?: number;
    brutto7?: number;
    brutto0?: number;
    comment?: string;
  };
  verifiedFields: string[];
  onVerify: (fieldName: string) => void;
  onReject: (fieldName: string) => void;
}

const fieldLabels: Record<string, string> = {
  date: 'Date',
  vendor: 'Vendor',
  item: 'Item',
  type: 'Type',
  brutto19: '19% VAT (Brutto)',
  brutto7: '7% VAT (Brutto)',
  brutto0: '0% VAT (Brutto)',
  comment: 'Comment',
};

const fieldFormatters: Record<string, (val: unknown) => string> = {
  date: (val) => {
    if (!val) return '-';
    const date = new Date(val as string);
    return date.toLocaleDateString('de-DE');
  },
  brutto19: (val) => formatCurrency(val as number),
  brutto7: (val) => formatCurrency(val as number),
  brutto0: (val) => formatCurrency(val as number),
};

export default function OcrFieldVerification({
  fields,
  billData,
  verifiedFields,
  onVerify,
  onReject,
}: OcrFieldVerificationProps) {
  const [expanded, setExpanded] = useState(true);

  if (!fields || fields.length === 0) return null;

  const unverifiedFields = fields.filter((f) => !verifiedFields.includes(f));

  if (unverifiedFields.length === 0) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-amber-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-amber-900">AI Verification Needed</h3>
            <p className="text-sm text-amber-700">
              {unverifiedFields.length} field{unverifiedFields.length !== 1 ? 's' : ''} extracted by AI need verification
            </p>
          </div>
        </div>
        <svg
          className={cn(
            'w-5 h-5 text-amber-600 transition-transform',
            expanded && 'rotate-180'
          )}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Fields list */}
      {expanded && (
        <div className="px-4 pb-4">
          <div className="bg-white rounded-lg border border-amber-200 divide-y divide-amber-100">
            {unverifiedFields.map((fieldName) => {
              const rawValue = billData[fieldName as keyof typeof billData];
              const formatter = fieldFormatters[fieldName];
              const displayValue = formatter ? formatter(rawValue) : String(rawValue || '-');

              return (
                <div
                  key={fieldName}
                  className="p-4 flex items-center justify-between gap-4"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                        AI
                      </span>
                      <span className="font-medium text-slate-700">
                        {fieldLabels[fieldName] || fieldName}
                      </span>
                    </div>
                    <p className="mt-1 text-slate-900 font-medium">{displayValue}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onReject(fieldName)}
                      className="px-3 py-1.5 text-sm text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => onVerify(fieldName)}
                      className="px-3 py-1.5 text-sm bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg transition-colors"
                    >
                      ✓ Verified
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
