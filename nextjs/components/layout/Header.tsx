'use client';

import SignOutButton from '@/components/auth/SignOutButton';
import ThemeToggle from '@/components/layout/ThemeToggle';
import { Menu } from 'lucide-react';

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

      <h1 className="text-base font-semibold text-zinc-800">
        {title ?? 'SetCash'}
      </h1>

      <div className="ml-auto flex items-center gap-3">
        <ThemeToggle />
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
              className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm font-semibold shrink-0 cursor-pointer hover:ring-2 hover:ring-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 ring-offset-1 transition-all"
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
