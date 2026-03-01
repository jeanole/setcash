import type { ReactNode } from 'react';

interface HeaderProps {
  title?: string;
}

export default function Header({ title }: HeaderProps): ReactNode {
  return (
    <header
      className="h-14 border-b border-slate-200 bg-white flex items-center px-4 md:px-6 shrink-0 shadow-sm"
      aria-label="Page header"
    >
      {/* Page title */}
      <h1 className="text-base font-semibold text-slate-800">
        {title ?? 'vBudget'}
      </h1>

      {/* Avatar placeholder */}
      <div className="ml-auto">
        <div
          className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-semibold"
          aria-label="User avatar"
          role="img"
        >
          ?
        </div>
      </div>
    </header>
  );
}
