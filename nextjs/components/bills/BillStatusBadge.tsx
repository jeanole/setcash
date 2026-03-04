'use client';

import { BillStatus } from '@/lib/types';
import { cn, statusColors } from '@/lib/utils';

interface BillStatusBadgeProps {
  status: BillStatus | string;
  size?: 'sm' | 'md';
  isDraft?: boolean;
}

export default function BillStatusBadge({
  status,
  size = 'md',
  isDraft = false,
}: BillStatusBadgeProps) {
  const sizeClasses = {
    sm: 'text-[0.65rem] px-1.5 py-px',
    md: 'text-xs px-2 py-1',
  };

  // Handle draft as special case (shows alongside status)
  if (isDraft) {
    return (
      <span
        className={cn(
          'inline-flex items-center rounded font-medium',
          'bg-rose-500 text-white',
          sizeClasses[size]
        )}
      >
        Entwurf
      </span>
    );
  }

  const colors = statusColors[status] || statusColors.confirmed;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded font-medium border',
        colors.bg,
        colors.text,
        colors.border,
        sizeClasses[size]
      )}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
