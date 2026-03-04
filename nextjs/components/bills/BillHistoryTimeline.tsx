'use client';

import { EditLog } from '@/lib/types';
import { formatDate, cn } from '@/lib/utils';

interface BillHistoryTimelineProps {
  logs: EditLog[];
}

function formatChanges(changes: EditLog['changes']): string {
  if (!changes) return '';

  // Special event types
  if (changes._event === 'created') {
    return 'Bill created';
  }
  if (changes._event === 'verified') {
    return `Verified: ${changes.field}`;
  }

  // Regular field changes
  return Object.entries(changes)
    .filter(([key]) => key !== '_event')
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ');
}

function getEventBadge(changes: EditLog['changes'], source: string) {
  if (!changes) return null;

  // Created event
  if (changes._event === 'created') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
        Created
      </span>
    );
  }

  // Verified event
  if (changes._event === 'verified') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
        ✓ Verified
      </span>
    );
  }

  // AI source
  if (source === 'ai') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
        AI
      </span>
    );
  }

  // Regular edit
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
      Edited
    </span>
  );
}

export default function BillHistoryTimeline({ logs }: BillHistoryTimelineProps) {
  if (!logs || logs.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">History</h3>
        <p className="text-slate-500 text-center py-4">No history yet</p>
      </div>
    );
  }

  // Sort by timestamp descending (newest first)
  const sortedLogs = [...logs].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">History</h3>

      <div className="space-y-0">
        {sortedLogs.map((log, index) => {
          const badge = getEventBadge(log.changes, log.source);
          const isFirst = index === 0;

          return (
            <div
              key={log.id}
              className={cn(
                'relative pl-6 pb-6',
                !isFirst && 'border-l-2 border-slate-100 ml-2',
                isFirst && 'ml-2'
              )}
            >
              {/* Timeline dot */}
              <div
                className={cn(
                  'absolute left-0 top-0 w-4 h-4 rounded-full border-2',
                  log.source === 'ai'
                    ? 'bg-indigo-100 border-indigo-400'
                    : log.changes?._event === 'created'
                    ? 'bg-emerald-100 border-emerald-400'
                    : log.changes?._event === 'verified'
                    ? 'bg-amber-100 border-amber-400'
                    : 'bg-slate-100 border-slate-300'
                )}
              />

              {/* Content */}
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  {badge}
                  <span className="text-sm text-slate-500">
                    {formatDate(log.timestamp)} at{' '}
                    {new Date(log.timestamp).toLocaleTimeString('de-DE', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                <p className="text-sm font-medium text-slate-900">{log.user}</p>

                {log.changes && log.changes._event !== 'created' && log.changes._event !== 'verified' && (
                  <div className="text-sm text-slate-600 bg-slate-50 rounded-lg p-2 mt-1">
                    <span className="font-medium">Changes:</span>{' '}
                    {formatChanges(log.changes)}
                  </div>
                )}

                {log.changes?._event === 'verified' && (
                  <p className="text-sm text-amber-700">
                    Field &quot;{String(log.changes.field)}&quot; verified
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
