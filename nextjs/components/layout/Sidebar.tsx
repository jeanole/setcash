import type { ReactNode } from 'react';

interface NavItem {
  label: string;
  href: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Bills', href: '/bills' },
  { label: 'Budget', href: '/budget' },
  { label: 'Reports', href: '/reports' },
  { label: 'Settings', href: '/settings' },
];

/** Icon placeholder — square box representing a nav icon */
function IconPlaceholder() {
  return (
    <span
      className="w-5 h-5 rounded border border-slate-600 shrink-0"
      aria-hidden="true"
    />
  );
}

export default function Sidebar(): ReactNode {
  return (
    <aside
      className="hidden lg:flex w-64 flex-col bg-slate-900 text-white shrink-0"
      aria-label="Primary navigation"
    >
      {/* Logo area */}
      <div className="px-6 py-5 border-b border-slate-800">
        <span className="text-xl font-bold text-indigo-400 tracking-tight">
          vBudget
        </span>
        <p className="text-xs text-slate-500 mt-0.5">expense tracker</p>
      </div>

      {/* Navigation links */}
      <nav className="flex-1 px-3 py-4 space-y-1" aria-label="Main menu">
        {NAV_ITEMS.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <IconPlaceholder />
            {item.label}
          </a>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-slate-800">
        <p className="text-xs text-slate-600">v2.0.0-next</p>
      </div>
    </aside>
  );
}
