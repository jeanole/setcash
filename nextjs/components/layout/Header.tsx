'use client';

import SignOutButton from '@/components/auth/SignOutButton';
import NotificationBell from '@/components/layout/NotificationBell';
import { Menu, Plus } from 'lucide-react';
import Link from 'next/link';

interface HeaderProps {
  title?: string;
  user?: {
    email: string;
    username?: string | null;
    firstName?: string | null;
  } | null;
  onMenuToggle?: () => void;
  onProfileOpen?: () => void;
}

// ---------------------------------------------------------------------------
// Header — client component
// Shows hamburger menu (mobile), page title, and user controls
// ---------------------------------------------------------------------------

export default function Header({ title, user, onMenuToggle, onProfileOpen }: HeaderProps) {
  const initials = user
    ? (user.firstName ? user.firstName.charAt(0) : user.email.charAt(0)).toUpperCase()
    : '?';

  return (
    <header
      className="h-14 border-b border-zinc-900/8 bg-[var(--vb-header-bg)] backdrop-blur-md flex items-center px-4 md:px-6 shrink-0 sticky top-0 z-40"
      aria-label="Page header"
    >
      <button
        type="button"
        onClick={onMenuToggle}
        className="lg:hidden mr-3 p-2 -ml-2 rounded-lg hover:bg-zinc-900/6 transition-colors"
        aria-label="Open navigation menu"
      >
        <Menu className="w-5 h-5 text-zinc-600" />
      </button>

      <h1 className="text-base font-semibold text-zinc-800 uppercase tracking-widest" style={{ fontFamily: 'var(--font-display)' }}>
        {title ?? 'SetCash'}
      </h1>

      <div className="ml-auto flex items-center gap-3">
        <Link
          href="/bills/new"
          className="w-8 h-8 rounded-full bg-[var(--vb-accent)] border border-zinc-900 flex items-center justify-center text-zinc-900 shrink-0 hover:bg-[var(--vb-accent-hover)] transition-colors btn-brutal-sm"
          aria-label="Upload new bill"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />
        </Link>
        <NotificationBell />
        {user ? (
          <>
            <span
              className="hidden md:block text-xs text-zinc-500 max-w-[160px] truncate"
              title={user.email}
            >
              {user.email}
            </span>
            <button
              type="button"
              onClick={onProfileOpen}
              className="w-8 h-8 rounded-full bg-[var(--vb-accent)] border border-zinc-900 flex items-center justify-center text-zinc-900 text-sm font-bold shrink-0 cursor-pointer focus:outline-none btn-brutal-sm"
              aria-label={`Edit profile — signed in as ${user.email}`}
            >
              {initials}
            </button>
            <SignOutButton />
          </>
        ) : (
          <div
            className="w-8 h-8 rounded-full bg-zinc-200 flex items-center justify-center text-zinc-500 text-sm font-semibold"
            aria-label="User avatar"
            role="img"
          >
            ?
          </div>
        )}
      </div>
    </header>
  );
}
