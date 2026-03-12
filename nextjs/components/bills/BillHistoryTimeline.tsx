'use client';

import { EditLog } from '@/lib/types';
import { cn } from '@/lib/utils';

interface BillHistoryTimelineProps {
  logs: EditLog[];
}

function formatChanges(changes: EditLog['changes']): string {
  if (!changes) return '';
  if (changes._event === 'created') return 'Bill created';
  if (changes._event === 'verified') return `Verified: ${changes.field}`;
  return Object.entries(changes)
    .filter(([key]) => key !== '_event')
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ');
}

type EventKind = 'created' | 'verified' | 'ai' | 'edit';

function getEventKind(log: EditLog): EventKind {
  if (log.changes?._event === 'created') return 'created';
  if (log.changes?._event === 'verified') return 'verified';
  if (log.source === 'ai') return 'ai';
  return 'edit';
}

const EVENT_STYLES: Record<EventKind, { dot: string; label: string; labelClass: string }> = {
  created:  { dot: 'bg-emerald-400 border-emerald-200', label: 'Created', labelClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  verified: { dot: 'bg-amber-400 border-amber-200',    label: '✓ Verified', labelClass: 'bg-amber-50 text-amber-700 border-amber-200' },
  ai:       { dot: 'bg-indigo-400 border-indigo-200',  label: 'AI',         labelClass: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  edit:     { dot: 'bg-slate-300 border-slate-200',    label: 'Edited',     labelClass: 'bg-slate-100 text-slate-600 border-slate-200' },
};

function formatTimestamp(ts: string) {
  const d = new Date(ts);
  return {
    date: d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
  };
}

export default function BillHistoryTimeline({ logs }: BillHistoryTimelineProps) {
  if (!logs || logs.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">Audit Trail</h3>
        <p className="text-sm text-slate-400 py-3 text-center">No history recorded yet</p>
      </div>
    );
  }

  const sorted = [...logs].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wider">Audit Trail</h3>

      <ol className="relative" aria-label="Bill history">
        {sorted.map((log, i) => {
          const kind = getEventKind(log);
          const style = EVENT_STYLES[kind];
          const { date, time } = formatTimestamp(log.timestamp);
          const isLast = i === sorted.length - 1;

          return (
            <li key={log.id} className={cn('relative flex gap-3 pb-5', isLast && 'pb-0')}>
              {/* Vertical line */}
              {!isLast && (
                <div className="absolute left-[5px] top-4 bottom-0 w-px bg-slate-100" aria-hidden="true" />
              )}

              {/* Dot */}
              <div className={cn(
                'relative z-10 mt-0.5 w-3 h-3 rounded-full border-2 shrink-0',
                style.dot
              )} />

              {/* Content */}
              <div className="flex-1 min-w-0 -mt-0.5">
                <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                  <span className={cn(
                    'inline-flex items-center px-1.5 py-px rounded text-[10px] font-semibold border',
                    style.labelClass
                  )}>
                    {style.label}
                  </span>
                  <time className="text-[11px] text-slate-400 font-mono">
                    {date} {time}
                  </time>
                </div>

                <p className="text-xs font-medium text-slate-700">{log.user}</p>

                {log.changes && log.changes._event !== 'created' && log.changes._event !== 'verified' && (
                  <p className="text-[11px] text-slate-500 mt-1 font-mono leading-relaxed">
                    {formatChanges(log.changes)}
                  </p>
                )}

                {log.changes?._event === 'verified' && (
                  <p className="text-[11px] text-amber-600 mt-0.5">
                    &ldquo;{String(log.changes.field)}&rdquo; marked as correct
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
