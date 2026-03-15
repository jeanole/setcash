'use client';

import { useState, useCallback } from 'react';
import { X, Send } from 'lucide-react';
import { toast } from 'sonner';

interface InviteMemberModalProps {
  isOpen: boolean;
  projectId?: string;
  mode?: 'project' | 'platform';
  onClose: () => void;
  onInvited?: () => void;
}

export default function InviteMemberModal({
  isOpen,
  projectId,
  mode = 'project',
  onClose,
  onInvited,
}: InviteMemberModalProps) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState(
    mode === 'project'
      ? 'Hey, join my project so we can ease the bureaucracy!'
      : 'Hey, check out SetCash for tracking expenses!'
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPlatform = mode === 'platform';

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      if (!email.trim()) {
        setError('Email is required');
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        setError('Please enter a valid email address');
        return;
      }

      setIsLoading(true);

      try {
        const url = isPlatform
          ? '/api/auth/invite'
          : `/api/projects/${projectId}/invite`;

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email.trim(),
            message: message.trim() || undefined,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || 'Failed to send invitation');
          return;
        }

        toast.success(`Invitation sent to ${email.trim()}`);
        setEmail('');
        setMessage(
          isPlatform
            ? 'Hey, check out SetCash for tracking expenses!'
            : 'Hey, join my project so we can ease the bureaucracy!'
        );
        onInvited?.();
        onClose();
      } catch {
        setError('An unexpected error occurred.');
      } finally {
        setIsLoading(false);
      }
    },
    [email, message, projectId, isPlatform, onClose, onInvited]
  );

  const handleClose = useCallback(() => {
    setEmail('');
    setMessage(
      isPlatform
        ? 'Hey, check out SetCash for tracking expenses!'
        : 'Hey, join my project so we can ease the bureaucracy!'
    );
    setError(null);
    onClose();
  }, [isPlatform, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-md bg-white rounded-lg shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">
            {isPlatform ? 'Invite to SetCash' : 'Invite to Project'}
          </h2>
          <button
            onClick={handleClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-md">
              <p className="text-sm text-rose-600">{error}</p>
            </div>
          )}

          <div>
            <label
              htmlFor="invite-email"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Email <span className="text-rose-500">*</span>
            </label>
            <input
              type="email"
              id="invite-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@example.com"
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
            />
            <p className="mt-1 text-xs text-slate-500">
              {isPlatform
                ? "They\u2019ll receive an email invitation to create a SetCash account"
                : "They\u2019ll receive an email invitation to join the project"}
            </p>
          </div>

          <div>
            <label
              htmlFor="invite-message"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Message
            </label>
            <textarea
              id="invite-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              maxLength={500}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] resize-none"
            />
            <p className="mt-1 text-xs text-slate-400 text-right">
              {message.length}/500
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-slate-700 bg-slate-100 rounded-md font-medium hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-zinc-900 rounded-md font-medium hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
            >
              <Send className="w-4 h-4" />
              {isLoading ? 'Sending...' : 'Send Invite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
