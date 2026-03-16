'use client';

import { useState, useEffect, useCallback } from 'react';

interface LinkAccountModalProps {
  onClose: () => void;
  onLinked: () => void;
}

export default function LinkAccountModal({ onClose, onLinked }: LinkAccountModalProps) {
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generateCode = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/telegram/link-code');
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to generate code');
      }
      const data = await res.json();
      setCode(data.code);
      setExpiresAt(new Date(data.expires));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate code');
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll link status to detect when linking completes
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/telegram/status');
        if (res.ok) {
          const data = await res.json();
          if (data.linked) {
            onLinked();
          }
        }
      } catch {
        // ignore
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [onLinked]);

  // Generate code on mount
  useEffect(() => {
    generateCode();
  }, [generateCode]);

  // Countdown timer
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const diff = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
      setSecondsLeft(diff);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const formatCountdown = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const copyCommand = async () => {
    if (!code) return;
    await navigator.clipboard.writeText(`/link ${code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Link Telegram Account</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-md">
            <p className="text-sm text-rose-600">{error}</p>
          </div>
        )}

        {loading && !code && (
          <div className="text-center py-8 text-slate-500 text-sm">Generating code…</div>
        )}

        {code && (
          <div className="space-y-4">
            <ol className="text-sm text-slate-600 space-y-1 list-decimal list-inside">
              <li>Open Telegram and find your project's bot.</li>
              <li>Send the command below:</li>
            </ol>

            <div className="bg-slate-100 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
              <code className="text-lg font-mono font-semibold text-slate-900 tracking-widest">
                /link {code}
              </code>
              <button
                onClick={copyCommand}
                className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-md border border-slate-300 text-slate-700 hover:bg-slate-200 transition-colors"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className={secondsLeft < 60 ? 'text-rose-600 font-medium' : 'text-slate-500'}>
                Expires in {formatCountdown(secondsLeft)}
              </span>
              <button
                onClick={generateCode}
                disabled={loading}
                className="text-[var(--vb-accent)] hover:underline disabled:opacity-50 text-sm"
              >
                Generate new code
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-slate-100 text-center">
          <button
            onClick={onClose}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
