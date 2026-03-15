'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { formatCurrency, formatDate, cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface VGeldTransfer {
  id: string;
  date: string;
  amount: number;
  from: string;
  to: string;
  createdBy: string;
  confirmedBy: string | null;
}

interface VGeldAnalysisEntry {
  user: string;
  received: number;
  spent: number;
  remaining: number;
  percentUsed: number;
}

interface ProjectMember {
  id: string;
  email: string;
  role: string;
}

// ============================================================================
// Skeleton loading component
// ============================================================================

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-zinc-200 rounded animate-pulse" />
        </td>
      ))}
    </tr>
  );
}

// ============================================================================
// Add Transfer Modal
// ============================================================================

interface AddTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  projectId: string;
}

function AddTransferModal({ isOpen, onClose, onSuccess, projectId }: AddTransferModalProps) {
  const [amount, setAmount] = useState('');
  const [to, setTo] = useState('');
  const [from, setFrom] = useState('External');
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch members for the dropdown
  useEffect(() => {
    if (!isOpen || !projectId) return;
    fetch(`/api/projects/${projectId}/members`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setMembers(data);
          if (data.length > 0 && !to) {
            setTo(data[0].email);
          }
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, projectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setError('Amount must be a positive number');
      return;
    }
    if (!to) {
      setError('Please select a recipient');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/vgeld', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parsedAmount, to, from }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Failed to create transfer');
      }

      // Reset form and notify parent
      setAmount('');
      setFrom('External');
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setAmount('');
    setFrom('External');
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-transfer-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal panel */}
      <div className="relative z-10 bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 animate-[vb-rise_0.2s_ease-out]">
        <div className="flex items-center justify-between mb-5">
          <h2 id="add-transfer-title" className="text-[17px] font-semibold text-zinc-800">
            Add V-Geld Transfer
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-500 hover:text-zinc-700 transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg px-4 py-3 text-sm bg-rose-50 text-rose-700 border border-rose-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Amount */}
          <div>
            <label htmlFor="transfer-amount" className="block text-sm font-medium text-zinc-700 mb-1">
              Amount (EUR) <span className="text-rose-500">*</span>
            </label>
            <input
              id="transfer-amount"
              type="number"
              min="0.01"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
              placeholder="0.00"
            />
          </div>

          {/* To (recipient) */}
          <div>
            <label htmlFor="transfer-to" className="block text-sm font-medium text-zinc-700 mb-1">
              To (Recipient) <span className="text-rose-500">*</span>
            </label>
            <select
              id="transfer-to"
              required
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent bg-white"
            >
              {members.length === 0 && (
                <option value="" disabled>Loading members...</option>
              )}
              {members.map((m) => (
                <option key={m.id} value={m.email}>
                  {m.email} ({m.role})
                </option>
              ))}
            </select>
          </div>

          {/* From */}
          <div>
            <label htmlFor="transfer-from" className="block text-sm font-medium text-zinc-700 mb-1">
              From
            </label>
            <input
              id="transfer-from"
              type="text"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
              placeholder="External"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 rounded-lg border border-zinc-300 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 rounded-lg bg-[var(--vb-accent)] text-white text-sm font-medium hover:bg-[var(--vb-accent-hover)] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Adding...' : 'Add Transfer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// Main V-Geld Page
// ============================================================================

export default function VGeldPage() {
  const { data: session } = useSession();
  const projectRole = session?.user?.currentProjectRole;
  const isAdmin =
    projectRole === 'admin' ||
    projectRole === 'owner' ||
    session?.user?.role === 'superadmin';
  const currentUserEmail = session?.user?.email ?? '';
  const projectId = session?.user?.currentProjectId ?? '';

  const [transfers, setTransfers] = useState<VGeldTransfer[]>([]);
  const [analysis, setAnalysis] = useState<VGeldAnalysisEntry[]>([]);
  const [isLoadingTransfers, setIsLoadingTransfers] = useState(true);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchTransfers = useCallback(async () => {
    setIsLoadingTransfers(true);
    setError(null);
    try {
      const res = await fetch('/api/vgeld');
      if (!res.ok) throw new Error('Failed to load transfers');
      const data = await res.json();
      setTransfers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transfers');
    } finally {
      setIsLoadingTransfers(false);
    }
  }, []);

  const fetchAnalysis = useCallback(async () => {
    if (!isAdmin) return;
    setIsLoadingAnalysis(true);
    try {
      const res = await fetch('/api/vgeld/analysis');
      if (!res.ok) throw new Error('Failed to load analysis');
      const data = await res.json();
      setAnalysis(Array.isArray(data) ? data : []);
    } catch {
      // Analysis failure is non-critical; silently ignore
    } finally {
      setIsLoadingAnalysis(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchTransfers();
  }, [fetchTransfers]);

  useEffect(() => {
    fetchAnalysis();
  }, [fetchAnalysis]);

  const handleModalSuccess = () => {
    setIsModalOpen(false);
    fetchTransfers();
    fetchAnalysis();
  };

  const handleConfirm = async (id: string) => {
    try {
      const res = await fetch(`/api/vgeld/${id}/confirm`, { method: 'PATCH' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? 'Failed to confirm transfer');
        return;
      }
      fetchTransfers();
      fetchAnalysis();
    } catch {
      alert('Failed to confirm transfer');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this V-Geld transfer?')) return;
    try {
      const res = await fetch(`/api/vgeld/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? 'Failed to delete transfer');
        return;
      }
      fetchTransfers();
      fetchAnalysis();
    } catch {
      alert('Failed to delete transfer');
    }
  };

  // Filter transfers to current user's received transfers (for non-admins)
  // Admins see all transfers
  const displayedTransfers = isAdmin
    ? transfers
    : transfers.filter((t) => t.to === currentUserEmail);

  return (
    <div className="space-y-6 animate-[vb-rise_0.4s_ease-out]">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-[22px] font-semibold text-zinc-800">V-Geld</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[var(--vb-accent)] text-white font-medium rounded-lg hover:bg-[var(--vb-accent-hover)] active:scale-[0.97] transition-all shadow-sm text-sm"
          aria-label="Add V-Geld transfer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add V-Geld Transfer
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg px-4 py-3 text-sm text-rose-700 flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={fetchTransfers}
            className="ml-4 font-medium underline hover:text-rose-800"
          >
            Retry
          </button>
        </div>
      )}

      {/* Transfers table */}
      <section aria-labelledby="transfers-heading">
        <h2 id="transfers-heading" className="text-[15px] font-semibold text-zinc-700 mb-3">
          {isAdmin ? 'All Transfers' : 'Your Received Transfers'}
        </h2>
        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="V-Geld transfers">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">From</th>
                  {isAdmin && (
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">To</th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Created By</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Confirmed By</th>
                  {isAdmin && (
                    <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wider">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {isLoadingTransfers ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <SkeletonRow key={i} cols={isAdmin ? 7 : 5} />
                  ))
                ) : displayedTransfers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isAdmin ? 7 : 5}
                      className="px-4 py-12 text-center text-zinc-400"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <svg className="w-8 h-8 text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                        <span className="text-sm">No V-Geld transfers recorded</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  displayedTransfers.map((transfer) => (
                    <tr key={transfer.id} className="hover:bg-zinc-50 transition-colors">
                      <td className="px-4 py-3 text-zinc-700 font-mono text-xs">
                        {formatDate(transfer.date)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold font-mono text-zinc-800">
                        {formatCurrency(transfer.amount)}
                      </td>
                      <td className="px-4 py-3 text-zinc-600">{transfer.from}</td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-zinc-600">{transfer.to}</td>
                      )}
                      <td className="px-4 py-3 text-zinc-500 text-xs">{transfer.createdBy}</td>
                      <td className="px-4 py-3 text-xs">
                        {transfer.confirmedBy ? (
                          <span className="text-zinc-500">{transfer.confirmedBy}</span>
                        ) : isAdmin ? (
                          <button
                            onClick={() => handleConfirm(transfer.id)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 border border-transparent hover:border-emerald-200 rounded px-2.5 py-1 transition-colors"
                            aria-label={`Confirm transfer from ${transfer.from} on ${formatDate(transfer.date)}`}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Confirm
                          </button>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleDelete(transfer.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium text-rose-600 hover:bg-rose-50 hover:text-rose-700 border border-transparent hover:border-rose-200 transition-colors"
                            aria-label={`Delete transfer from ${transfer.from} on ${formatDate(transfer.date)}`}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Admin: All Users Summary */}
      {isAdmin && (
        <section aria-labelledby="summary-heading">
          <h2 id="summary-heading" className="text-[15px] font-semibold text-zinc-700 mb-3">
            All Users Summary
          </h2>
          <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" aria-label="V-Geld user summary">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">User</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wider">Received</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wider">Spent</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wider">Remaining</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wider">% Used</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {isLoadingAnalysis ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <SkeletonRow key={i} cols={5} />
                    ))
                  ) : analysis.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-zinc-400 text-sm">
                        No data available
                      </td>
                    </tr>
                  ) : (
                    analysis.map((entry) => (
                      <tr key={entry.user} className="hover:bg-zinc-50 transition-colors">
                        <td className="px-4 py-3 text-zinc-700 font-medium">{entry.user}</td>
                        <td className="px-4 py-3 text-right font-mono text-zinc-700">
                          {formatCurrency(entry.received)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-zinc-700">
                          {formatCurrency(entry.spent)}
                        </td>
                        <td className={cn(
                          'px-4 py-3 text-right font-mono font-semibold',
                          entry.remaining < 0 ? 'text-rose-600' : 'text-zinc-800'
                        )}>
                          {formatCurrency(entry.remaining)}
                        </td>
                        <td className={cn(
                          'px-4 py-3 text-right font-mono font-semibold',
                          entry.percentUsed > 100
                            ? 'text-rose-600'
                            : entry.percentUsed > 80
                            ? 'text-amber-500'
                            : 'text-zinc-700'
                        )}>
                          {entry.percentUsed.toFixed(1)}%
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Add Transfer Modal */}
      <AddTransferModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleModalSuccess}
        projectId={projectId}
      />
    </div>
  );
}
