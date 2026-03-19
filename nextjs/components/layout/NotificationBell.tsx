'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeftRight, Bell, BellOff, CheckCircle, Mail, MessageCircle, UserPlus, X, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

function parseMessage(raw: string): { text: string; url?: string } {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.text === 'string') return parsed;
  } catch {
    // plain string
  }
  return { text: raw };
}

interface AppNotification {
  id: string;
  type: string;
  message: string;
  projectId: string | null;
  projectName: string | null;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications');
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {
      // ignore network errors silently
    }
  }, []);

  // Initial fetch + 30s polling
  useEffect(() => {
    fetchNotifications();
    const id = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(id);
  }, [fetchNotifications]);

  // Refetch when dropdown opens
  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [open]);

  const markAsRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
  };

  const markAllAsRead = async () => {
    setIsMarkingAll(true);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    await fetch('/api/notifications/read-all', { method: 'POST' });
    setIsMarkingAll(false);
  };

  const handleNotificationClick = async (n: AppNotification) => {
    if (!n.isRead) await markAsRead(n.id);
    if (n.type === 'telegram_invite') {
      const { url } = parseMessage(n.message);
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    setOpen(false);
    if (n.type === 'project_invite') {
      router.push('/settings/projects');
    } else if (n.type === 'bill_rejected') {
      router.push('/bills');
    } else if (n.type === 'transfer_requested' || n.type === 'transfer_confirmed') {
      router.push('/vgeld');
    } else if (n.type === 'budget_overrun') {
      router.push('/budget');
    }
    // pending_invite: action is in email, just mark read
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg border border-zinc-900/20 bg-white hover:bg-zinc-50 transition-colors btn-brutal-sm"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell className="w-4 h-4 text-zinc-700" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-[var(--vb-accent)] border border-zinc-900 rounded-full text-[10px] font-bold text-zinc-900 flex items-center justify-center px-1 leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="fixed right-2 left-2 top-16 sm:absolute sm:left-auto sm:top-full sm:mt-2 sm:w-[360px] sm:right-0 bg-white border border-zinc-900/20 rounded-lg shadow-[4px_4px_0_#0f172a] z-50 overflow-hidden"
          role="dialog"
          aria-label="Notifications panel"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
            <span className="text-xs font-bold uppercase tracking-widest text-zinc-800">
              Notifications
            </span>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  disabled={isMarkingAll}
                  className="text-xs text-zinc-500 hover:text-zinc-800 transition-colors disabled:opacity-50"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded hover:bg-zinc-100 transition-colors"
                aria-label="Close notifications"
              >
                <X className="w-3.5 h-3.5 text-zinc-400" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-[400px] overflow-y-auto divide-y divide-zinc-50">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <BellOff className="w-8 h-8 text-zinc-300" />
                <p className="text-sm font-medium text-zinc-500">No notifications yet</p>
                <p className="text-xs text-zinc-400">We&apos;ll notify you when something happens</p>
              </div>
            ) : (
              notifications.map((n) => {
                const { text, url } = parseMessage(n.message);
                const icon = n.type === 'telegram_invite'
                  ? <MessageCircle className="w-4 h-4 text-zinc-700" />
                  : n.type === 'pending_invite'
                  ? <Mail className="w-4 h-4 text-zinc-700" />
                  : n.type === 'bill_rejected'
                  ? <XCircle className="w-4 h-4 text-red-600" />
                  : n.type === 'transfer_requested'
                  ? <ArrowLeftRight className="w-4 h-4 text-amber-500" />
                  : n.type === 'transfer_confirmed'
                  ? <CheckCircle className="w-4 h-4 text-green-600" />
                  : n.type === 'budget_overrun'
                  ? <AlertTriangle className="w-4 h-4 text-orange-500" />
                  : <UserPlus className="w-4 h-4 text-zinc-700" />;

                return (
                  <button
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`w-full text-left flex gap-3 px-4 py-3 hover:bg-zinc-50 transition-colors border-l-2 ${
                      n.isRead ? 'border-l-transparent' : 'border-l-[var(--vb-accent)]'
                    }`}
                  >
                    <div className="shrink-0 w-8 h-8 rounded-full bg-[var(--vb-accent-light)] border border-[var(--vb-accent)] flex items-center justify-center">
                      {icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-snug line-clamp-2 ${n.isRead ? 'text-zinc-500' : 'text-zinc-800 font-medium'}`}>
                        {text}
                      </p>
                      {n.type === 'pending_invite' && (
                        <p className="text-xs text-zinc-400 mt-0.5 italic">Check your email for the invite link</p>
                      )}
                      {n.type === 'telegram_invite' && url && (
                        <span className="inline-flex items-center gap-1 mt-1 text-xs font-medium text-[#229ED9]">
                          <MessageCircle className="w-3 h-3" /> Open Telegram
                        </span>
                      )}
                      <div className="flex items-center gap-1.5 mt-1">
                        {n.projectName && (
                          <>
                            <span className="text-xs text-zinc-400">{n.projectName}</span>
                            <span className="text-zinc-300">·</span>
                          </>
                        )}
                        <span className="text-xs text-zinc-400">
                          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                    {!n.isRead && (
                      <span className="shrink-0 w-2 h-2 rounded-full bg-[var(--vb-accent)] mt-1.5" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
