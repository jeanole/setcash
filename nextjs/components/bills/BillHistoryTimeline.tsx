'use client';

import { useState } from 'react';
import { EditLog } from '@/lib/types';
import { editComment, deleteComment } from '@/lib/api/bills';
import { cn } from '@/lib/utils';

interface BillHistoryTimelineProps {
  logs: EditLog[];
  currentUserEmail?: string;
  isAdmin?: boolean;
  billId?: string;
  onLogsChanged?: () => void;
  children?: React.ReactNode;
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

type EventKind = 'created' | 'verified' | 'ai' | 'edit' | 'comment';

function getEventKind(log: EditLog): EventKind {
  if (log.source === 'comment') return 'comment';
  if (log.changes?._event === 'created') return 'created';
  if (log.changes?._event === 'verified') return 'verified';
  if (log.source === 'ai') return 'ai';
  return 'edit';
}

const EVENT_STYLES: Record<EventKind, { dot: string; label: string; labelClass: string }> = {
  created:  { dot: 'bg-emerald-400 border-emerald-200', label: 'Created',    labelClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  verified: { dot: 'bg-amber-400 border-amber-200',    label: '✓ Verified', labelClass: 'bg-amber-50 text-amber-700 border-amber-200' },
  ai:       { dot: 'bg-indigo-400 border-indigo-200',  label: 'AI',         labelClass: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  edit:     { dot: 'bg-slate-300 border-slate-200',    label: 'Edited',     labelClass: 'bg-slate-100 text-slate-600 border-slate-200' },
  comment:  { dot: 'bg-sky-400 border-sky-200',        label: 'Comment',    labelClass: 'bg-sky-50 text-sky-700 border-sky-200' },
};

function formatTimestamp(ts: string) {
  const d = new Date(ts);
  return {
    date: d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
  };
}

/** Highlight @mentions in comment text */
function renderCommentText(text: string): React.ReactNode {
  const parts = text.split(/(@\S+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      return (
        <span
          key={i}
          className="bg-sky-100 text-sky-700 rounded px-0.5 text-xs font-medium"
        >
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

interface CommentRowProps {
  log: EditLog;
  billId: string;
  isOwn: boolean;
  isAdmin: boolean;
  onChanged: () => void;
}

function CommentRow({ log, billId, isOwn, isAdmin, onChanged }: CommentRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const commentText = typeof log.changes?.text === 'string' ? log.changes.text : '';
  const editedAt = log.changes?.editedAt as string | undefined;

  const handleStartEdit = () => {
    setEditText(commentText);
    setEditError(null);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditText('');
    setEditError(null);
  };

  const handleSaveEdit = async () => {
    const trimmed = editText.trim();
    if (!trimmed || isSaving) return;
    setIsSaving(true);
    setEditError(null);
    try {
      await editComment(billId, log.id, trimmed);
      setIsEditing(false);
      onChanged();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this comment?')) return;
    try {
      await deleteComment(billId, log.id);
      onChanged();
    } catch {
      // silently ignore — UI will be stale until next refetch
    }
  };

  return (
    <div className="flex-1 min-w-0 -mt-0.5">
      <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
        <span className={cn(
          'inline-flex items-center px-1.5 py-px rounded text-[10px] font-semibold border',
          EVENT_STYLES.comment.labelClass
        )}>
          {EVENT_STYLES.comment.label}
        </span>
        <time className="text-[11px] text-slate-400 font-mono">
          {formatTimestamp(log.timestamp).date} {formatTimestamp(log.timestamp).time}
        </time>
        {editedAt && (
          <span className="text-[10px] text-slate-400 italic">(edited)</span>
        )}
        {/* Edit / Delete controls — visible on hover of parent li */}
        <span className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {isOwn && (
            <button
              onClick={handleStartEdit}
              title="Edit comment"
              aria-label="Edit comment"
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              {/* Pencil icon */}
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2.414a2 2 0 01.586-1.414z" />
              </svg>
            </button>
          )}
          {(isOwn || isAdmin) && (
            <button
              onClick={handleDelete}
              title="Delete comment"
              aria-label="Delete comment"
              className="text-slate-400 hover:text-rose-500 transition-colors"
            >
              {/* Trash icon */}
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m-7 0a1 1 0 011-1h4a1 1 0 011 1m-6 0h6" />
              </svg>
            </button>
          )}
        </span>
      </div>

      <p className="text-xs font-medium text-slate-700">{log.user}</p>

      {isEditing ? (
        <div className="mt-1.5 space-y-1.5">
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value.slice(0, 2000))}
            rows={3}
            autoFocus
            aria-label="Edit comment text"
            className={cn(
              'w-full px-3 py-2 border rounded-lg text-sm bg-white resize-none',
              'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
              editError ? 'border-rose-300' : 'border-slate-200'
            )}
          />
          {editError && <p className="text-xs text-rose-600">{editError}</p>}
          <div className="flex gap-2 justify-end">
            <button
              onClick={handleCancelEdit}
              className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={!editText.trim() || isSaving}
              className={cn(
                'text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg px-3 py-1',
                'transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                'flex items-center gap-1'
              )}
            >
              {isSaving ? (
                <>
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving…
                </>
              ) : (
                'Save'
              )}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-700 mt-1 leading-relaxed break-words">
          {renderCommentText(commentText)}
        </p>
      )}
    </div>
  );
}

export default function BillHistoryTimeline({
  logs,
  currentUserEmail,
  isAdmin = false,
  billId,
  onLogsChanged,
  children,
}: BillHistoryTimelineProps) {
  if (!logs || logs.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">Audit Trail</h3>
        <p className="text-sm text-slate-400 py-3 text-center">No history recorded yet</p>
        {children}
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
          const isCommentKind = kind === 'comment';
          const isOwn = !!currentUserEmail && log.user === currentUserEmail;

          return (
            <li
              key={log.id}
              className={cn('relative flex gap-3 pb-5 group', isLast && 'pb-0')}
            >
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
              {isCommentKind && billId && onLogsChanged ? (
                <CommentRow
                  log={log}
                  billId={billId}
                  isOwn={isOwn}
                  isAdmin={isAdmin}
                  onChanged={onLogsChanged}
                />
              ) : (
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
              )}
            </li>
          );
        })}
      </ol>

      {children}
    </div>
  );
}
