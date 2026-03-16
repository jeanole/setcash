'use client';

import { cn } from '@/lib/utils';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize = 25,
  onPageChange,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const pgBase =
    'px-2.5 py-1 text-sm rounded-md min-w-[34px] text-center border transition-colors';
  const pgNormal = `${pgBase} bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300`;
  const pgActive = `${pgBase} bg-[var(--vb-accent)] text-white border-[var(--vb-accent)]`;
  const pgDisabled = `${pgBase} bg-slate-50 text-slate-300 border-slate-200 cursor-default`;

  // Calculate visible page range
  const maxVisible = 7;
  let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let end = Math.min(totalPages, start + maxVisible - 1);
  if (end - start < maxVisible - 1) {
    start = Math.max(1, end - maxVisible + 1);
  }

  const pages: (number | string)[] = [];
  if (start > 1) {
    pages.push(1);
    if (start > 2) pages.push('...');
  }
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }
  if (end < totalPages) {
    if (end < totalPages - 1) pages.push('...');
    pages.push(totalPages);
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4">
      <span className="text-sm text-slate-500">
        {startItem}–{endItem} of {totalItems} items
      </span>

      <div className="flex items-center gap-1">
        {/* Previous button */}
        <button
          className={cn(pgNormal, currentPage <= 1 && pgDisabled)}
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="Previous page"
        >
          ‹
        </button>

        {/* Page numbers */}
        {pages.map((page, idx) =>
          page === '...' ? (
            <span key={`ellipsis-${idx}`} className="px-1 text-slate-400">
              …
            </span>
          ) : (
            <button
              key={page}
              className={cn(
                currentPage === page ? pgActive : pgNormal
              )}
              onClick={() => onPageChange(page as number)}
              aria-label={`Page ${page}`}
              aria-current={currentPage === page ? 'page' : undefined}
            >
              {page}
            </button>
          )
        )}

        {/* Next button */}
        <button
          className={cn(pgNormal, currentPage >= totalPages && pgDisabled)}
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Next page"
        >
          ›
        </button>
      </div>
    </div>
  );
}
