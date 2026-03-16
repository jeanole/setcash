'use client';

import { useState, useEffect, useCallback } from 'react';

interface TelegramInviteModalProps {
  userEmail: string;
  onClose: () => void;
}

export default function TelegramInviteModal({ userEmail, onClose }: TelegramInviteModalProps) {
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [expires, setExpires] = useState<Date | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generateLink = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/telegram/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to generate invite link');
      }
      const data = await res.json();
      setDeepLink(data.deepLink);
      setExpires(new Date(data.expires));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate invite link');
    } finally {
      setLoading(false);
    }
  }, [userEmail]);

  // Generate link on mount
  useEffect(() => {
    generateLink();
  }, [generateLink]);

  // Countdown timer
  useEffect(() => {
    if (!expires) return;
    const tick = () => {
      const diff = Math.max(0, Math.floor((expires.getTime() - Date.now()) / 1000));
      setSecondsLeft(diff);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expires]);

  const formatCountdown = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const copyLink = async () => {
    if (!deepLink) return;
    await navigator.clipboard.writeText(deepLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Invite to Telegram</h3>
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

        {loading && !deepLink && (
          <div className="text-center py-8 text-slate-500 text-sm">Generating invite link…</div>
        )}

        {deepLink && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Share this link with{' '}
              <span className="font-medium text-slate-800">{userEmail}</span> — clicking it opens
              Telegram and links their account automatically.
            </p>

            <div className="bg-slate-100 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
              <code className="text-xs font-mono text-slate-900 break-all">{deepLink}</code>
              <button
                onClick={copyLink}
                className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-md border border-slate-300 text-slate-700 hover:bg-slate-200 transition-colors"
              >
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
            </div>

            <div className="text-sm">
              <span className={secondsLeft < 60 ? 'text-rose-600 font-medium' : 'text-slate-500'}>
                Expires in {formatCountdown(secondsLeft)}
              </span>
            </div>

            <p className="text-xs text-slate-400">
              Generating a new link invalidates any previous link for this user.
            </p>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-slate-100 text-center">
          <button
            onClick={onClose}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
