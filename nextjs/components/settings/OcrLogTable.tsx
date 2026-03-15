'use client';

import { useState, useEffect } from 'react';
import { formatDate } from '@/lib/utils';

interface OcrLogEntry {
  id: string;
  timestamp: string;
  provider: string | null;
  status: string | null;
  fieldsWritten: unknown;
  aiResponse: unknown;
  errorDetail: string | null;
  billId: string | null;
}

interface OcrLogResponse {
  logs: OcrLogEntry[];
  total: number;
  page: number;
  limit: number;
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-slate-400 text-xs">—</span>;

  const lower = status.toLowerCase();
  if (lower === 'success' || lower === 'done') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
        {status}
      </span>
    );
  }
  if (lower === 'failed' || lower === 'error') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-100 text-rose-800">
        {status}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
      {status}
    </span>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="border-b border-slate-100">
          {Array.from({ length: 6 }).map((_, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-4 bg-slate-200 rounded animate-pulse" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export default function OcrLogTable() {
  const [data, setData] = useState<OcrLogResponse | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const limit = 20;

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    fetch(`/api/ocr-log?page=${page}&limit=${limit}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load logs');
        return res.json();
      })
      .then((json: OcrLogResponse) => setData(json))
      .catch((err: Error) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [page]);

  const totalPages = data ? Math.ceil(data.total / limit) : 1;

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Timestamp</th>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Bill</th>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Provider</th>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Status</th>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Fields Written</th>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Error</th>
          </tr>
        </thead>
        <tbody>
          {isLoading && <SkeletonRows />}

          {!isLoading && error && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-rose-600">
                {error}
              </td>
            </tr>
          )}

          {!isLoading && !error && data?.logs.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                No AI analysis logs yet
              </td>
            </tr>
          )}

          {!isLoading &&
            !error &&
            data?.logs.map((log) => (
              <>
                <tr
                  key={log.id}
                  onClick={() => toggleExpand(log.id)}
                  className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                    {formatDate(log.timestamp)}
                  </td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs">
                    {log.billId ? log.billId.slice(0, 8) + '…' : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{log.provider ?? '—'}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={log.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {Array.isArray(log.fieldsWritten)
                      ? (log.fieldsWritten as string[]).join(', ') || '—'
                      : log.fieldsWritten
                      ? JSON.stringify(log.fieldsWritten)
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs max-w-xs truncate">
                    {log.errorDetail ?? '—'}
                  </td>
                </tr>
                {expandedId === log.id && (
                  <tr key={`${log.id}-expanded`} className="border-b border-slate-100 bg-slate-50">
                    <td colSpan={6} className="px-4 py-3">
                      <pre className="text-xs text-slate-700 overflow-auto max-h-64 bg-white border border-slate-200 rounded p-3 whitespace-pre-wrap break-all">
                        {log.aiResponse
                          ? JSON.stringify(log.aiResponse, null, 2)
                          : 'No AI response recorded'}
                      </pre>
                    </td>
                  </tr>
                )}
              </>
            ))}
        </tbody>
      </table>

      {/* Pagination */}
      {!isLoading && !error && data && data.total > limit && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
          <span className="text-xs text-slate-500">
            Page {page} of {totalPages} &mdash; {data.total} total
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-xs rounded border border-slate-300 text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 text-xs rounded border border-slate-300 text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
