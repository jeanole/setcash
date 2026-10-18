import { formatCurrency } from '@/lib/utils';
import type { GrossOnlySummary } from '@/lib/types';

interface GrossOnlyNoticeProps {
  grossOnly?: GrossOnlySummary;
}

/**
 * Shown next to netto figures: bills that only have a gross amount (no VAT
 * breakdown) count as 0 netto, so they are not part of these numbers.
 */
export default function GrossOnlyNotice({ grossOnly }: GrossOnlyNoticeProps) {
  if (!grossOnly || grossOnly.count <= 0) return null;

  const bills = grossOnly.count === 1 ? '1 bill' : `${grossOnly.count} bills`;

  return (
    <p
      role="note"
      className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
    >
      {bills} without a VAT breakdown ({formatCurrency(grossOnly.grossSum)} brutto) {grossOnly.count === 1 ? 'is' : 'are'} not
      included in the netto figures.
    </p>
  );
}
