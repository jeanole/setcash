'use client';

import SignOutButton from '@/components/auth/SignOutButton';
import { Menu } from 'lucide-react';

interface HeaderProps {
  title?: string;
  user?: {
    email: string;
  } | null;
  onMenuToggle?: () => void;
}

// ---------------------------------------------------------------------------
// Header — client component
// Shows hamburger menu (mobile), page title, and user controls
// ---------------------------------------------------------------------------

export default function Header({ title, user, onMenuToggle }: HeaderProps) {
  const initials = user?.email ? user.email.charAt(0).toUpperCase() : '?';

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
        {title ?? 'vBudget'}
      </h1>

      <div className="ml-auto flex items-center gap-3">
        {user ? (
          <>
            <span
              className="hidden md:block text-xs text-zinc-500 max-w-[160px] truncate"
              title={user.email}
            >
              {user.email}
            </span>
            <div
              className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm font-semibold shrink-0"
              aria-label={`Signed in as ${user.email}`}
              role="img"
            >
              {initials}
            </div>
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
