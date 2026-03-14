import type { ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface PercentBar {
  percent: number;
  color: 'green' | 'amber' | 'red';
}

interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: ReactNode;
  percentBar?: PercentBar;
  href?: string;
}

const barColors: Record<PercentBar['color'], string> = {
  green: 'bg-emerald-500',
  amber: 'bg-amber-400',
  red: 'bg-rose-500',
};

export default function KpiCard({
  title,
  value,
  subtitle,
  icon,
  percentBar,
  href,
}: KpiCardProps) {
  const content = (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col gap-3 h-full">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-[0.1em] leading-tight">
          {title}
        </p>
        <div
          className="shrink-0 w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400"
          aria-hidden="true"
        >
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-800 font-mono leading-none">{value}</p>
      {subtitle && (
        <p className="text-xs text-slate-400 leading-snug">{subtitle}</p>
      )}
      {percentBar && (
        <div className="mt-auto">
          <div
            className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden"
            role="progressbar"
            aria-valuenow={Math.min(percentBar.percent, 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${Math.round(percentBar.percent)}% used`}
          >
            <div
              className={cn('h-full rounded-full transition-all', barColors[percentBar.color])}
              style={{ width: `${Math.min(percentBar.percent, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-xl">
        {content}
      </Link>
    );
  }

  return content;
}
