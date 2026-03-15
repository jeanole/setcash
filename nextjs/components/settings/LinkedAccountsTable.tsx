'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import TelegramInviteModal from './TelegramInviteModal';

interface TelegramLink {
  id: string;
  userEmail: string;
  telegramUserId: string;
  linkedAt: string;
}

export default function LinkedAccountsTable() {
  const [links, setLinks] = useState<TelegramLink[]>([]);
  const [unlinked, setUnlinked] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [unlinking, setUnlinking] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState<string | null>(null);

  const fetchLinks = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/telegram/links');
      if (res.ok) {
        const data = await res.json();
        setLinks(data.linked);
        setUnlinked(data.unlinked);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  const handleUnlink = async (id: string, email: string) => {
    if (!confirm(`Unlink Telegram account for ${email}?`)) return;
    setUnlinking(id);
    try {
      const res = await fetch(`/api/admin/telegram/links/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to unlink');
      setLinks((prev) => prev.filter((l) => l.id !== id));
      toast.success(`Unlinked ${email}`);
    } catch {
      toast.error('Failed to unlink account');
    } finally {
      setUnlinking(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (links.length === 0 && unlinked.length === 0) {
    return (
      <p className="text-sm text-slate-500 py-4 text-center">No Telegram accounts linked yet.</p>
    );
  }

  return (
    <>
      {links.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-medium text-slate-500 border-b border-slate-200">
                <th className="pb-2 pr-4">User Email</th>
                <th className="pb-2 pr-4">Telegram User ID</th>
                <th className="pb-2 pr-4">Linked</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {links.map((link) => (
                <tr key={link.id}>
                  <td className="py-2.5 pr-4 text-slate-800">{link.userEmail}</td>
                  <td className="py-2.5 pr-4 text-slate-600 font-mono">{link.telegramUserId}</td>
                  <td className="py-2.5 pr-4 text-slate-500">
                    {new Date(link.linkedAt).toLocaleDateString()}
                  </td>
                  <td className="py-2.5">
                    <button
                      onClick={() => handleUnlink(link.id, link.userEmail)}
                      disabled={unlinking === link.id}
                      className="text-rose-500 hover:text-rose-700 text-xs disabled:opacity-50"
                    >
                      {unlinking === link.id ? 'Unlinking…' : 'Unlink'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {unlinked.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-slate-500 mb-2">Not Linked</p>
          <ul className="divide-y divide-slate-100">
            {unlinked.map((email) => (
              <li key={email} className="flex items-center justify-between py-2">
                <span className="text-sm text-slate-700">{email}</span>
                <button
                  onClick={() => setInviteEmail(email)}
                  className="text-[var(--vb-accent)] hover:text-[var(--vb-accent-hover)] text-xs font-medium"
                >
                  Invite
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {inviteEmail && (
        <TelegramInviteModal
          userEmail={inviteEmail}
          onClose={() => {
            setInviteEmail(null);
            fetchLinks();
          }}
        />
      )}
    </>
  );
}
