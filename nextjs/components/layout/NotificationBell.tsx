'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, BellOff, UserPlus, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

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
    setOpen(false);
    if (n.projectId) {
      window.location.href = '/bills';
    }
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
          className="absolute right-0 top-full mt-2 w-[360px] bg-white border border-zinc-900/20 rounded-lg shadow-[4px_4px_0_#0f172a] z-50 overflow-hidden"
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
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`w-full text-left flex gap-3 px-4 py-3 hover:bg-zinc-50 transition-colors border-l-2 ${
                    n.isRead ? 'border-l-transparent' : 'border-l-[var(--vb-accent)]'
                  }`}
                >
                  <div className="shrink-0 w-8 h-8 rounded-full bg-[var(--vb-accent-light)] border border-[var(--vb-accent)] flex items-center justify-center">
                    <UserPlus className="w-4 h-4 text-zinc-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm leading-snug line-clamp-2 ${
                        n.isRead ? 'text-zinc-500' : 'text-zinc-800 font-medium'
                      }`}
                    >
                      {n.message}
                    </p>
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
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
