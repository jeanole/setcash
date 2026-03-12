'use client';

import type { ReactNode } from 'react';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';
import { cn, formatCurrency } from '@/lib/utils';
import { X, UserPlus } from 'lucide-react';
import SuperAdminModal from '@/components/superadmin/SuperAdminModal';
import InviteMemberModal from '@/components/settings/InviteMemberModal';
import ProjectSwitcher from '@/components/layout/ProjectSwitcher';

const FilmRollNav = dynamic(() => import('@/components/cinematic/FilmRollNav'), { ssr: false });

interface NavItem {
  label: string;
  href: string;
  icon: (props: { className?: string }) => ReactNode;
}

function BillsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function BudgetIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function SpendingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  );
}

function ReportsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
    </svg>
  );
}

function VGeldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Bills', href: '/bills', icon: BillsIcon },
  { label: 'Spending', href: '/spending', icon: SpendingIcon },
  { label: 'Budget', href: '/budget', icon: BudgetIcon },
  { label: 'Reports', href: '/reports', icon: ReportsIcon },
  { label: 'V-Geld', href: '/vgeld', icon: VGeldIcon },
  { label: 'Settings', href: '/settings', icon: SettingsIcon },
];

// ============================================================================
// V-Geld Balance Widget
// ============================================================================

function VGeldBalance() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const hasProject = !!session?.user?.currentProjectId;

  useEffect(() => {
    if (!hasProject) {
      setBalance(null);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    fetch('/api/vgeld/balance')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data && typeof data.balance === 'number') {
          setBalance(data.balance);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [pathname, hasProject]);

  return (
    <div
      className="mx-3 mb-2 rounded-lg px-3 py-2 bg-slate-50 border border-slate-200"
      aria-label="Your V-Geld balance"
    >
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.12em] mb-0.5">
        V-Geld Balance
      </p>
      {isLoading ? (
        <div className="h-4 w-20 bg-slate-200 rounded animate-pulse" />
      ) : balance === null ? (
        <p className="text-xs text-slate-400">—</p>
      ) : (
        <p className={cn(
          'text-sm font-semibold font-mono',
          balance < 0 ? 'text-rose-500' : 'text-slate-700'
        )}>
          {formatCurrency(balance)}
        </p>
      )}
    </div>
  );
}

interface SidebarProps {
  currentUser?: {
    email: string;
    role: 'user' | 'admin' | 'superadmin';
  } | null;
  isMobileOpen?: boolean;
  onClose?: () => void;
}

function NavLinks({
  isActive,
  onClose,
  isSuperAdmin,
  onOpenSuperAdmin,
}: {
  isActive: (href: string) => boolean;
  onClose?: () => void;
  isSuperAdmin: boolean;
  onOpenSuperAdmin: () => void;
}) {
  const mainItems = NAV_ITEMS.map((item) => {
    const active = isActive(item.href);
    return (
      <a
        key={item.href}
        href={item.href}
        onClick={() => onClose?.()}
        className={cn(
          'flex items-center gap-3 py-2.5 rounded-lg text-[13.5px] font-medium transition-colors border-l-2 pl-[14px]',
          active
            ? 'text-indigo-700 bg-indigo-50 border-indigo-500'
            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100 border-transparent'
        )}
        aria-current={active ? 'page' : undefined}
      >
        <item.icon className={cn('w-5 h-5 shrink-0', active ? 'text-indigo-600' : 'opacity-60')} />
        {item.label}
      </a>
    );
  });

  const settingsSection = (
    <div className="mt-6 pt-6 border-t border-slate-200">
      <p className="px-[14px] mb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-[0.12em]">
        Settings
      </p>
      {isSuperAdmin && (
        <button
          onClick={() => { onClose?.(); onOpenSuperAdmin(); }}
          className="w-full flex items-center gap-3 py-2.5 rounded-lg text-[13.5px] font-medium transition-colors text-amber-600 hover:bg-amber-50 hover:text-amber-700 border-l-2 border-transparent pl-[14px]"
          aria-label="Open Super Admin panel"
        >
          <svg
            className="w-5 h-5 shrink-0 opacity-60"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          System
        </button>
      )}
    </div>
  );

  return (
    <>
      <FilmRollNav>
        {mainItems}
      </FilmRollNav>
      <VGeldBalance />
      {settingsSection}
    </>
  );
}

export default function Sidebar({ currentUser, isMobileOpen, onClose }: SidebarProps): ReactNode {
  const pathname = usePathname();
  const [isSuperAdminModalOpen, setIsSuperAdminModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const { data: session } = useSession();

  const isSuperAdmin = currentUser?.role === 'superadmin';
  const currentProjectId = session?.user?.currentProjectId;
  const currentProjectRole = session?.user?.currentProjectRole;
  const canInviteToProject = currentProjectRole === 'admin' || currentProjectRole === 'owner' || isSuperAdmin;
  const inviteMode = canInviteToProject ? 'project' as const : 'platform' as const;

  const isActive = (href: string) => {
    if (href === '/bills') {
      return pathname === href || pathname.startsWith('/bills/');
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileOpen && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isMobileOpen, onClose]);

  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileOpen]);

  return (
    <>
      <aside
        className="hidden lg:flex w-64 flex-col bg-white border-r border-slate-200 shrink-0"
        aria-label="Primary navigation"
      >
        <div className="px-6 py-5 border-b border-slate-200">
          <span className="text-xl font-bold text-slate-800 tracking-tight">vBudget</span>
          <p className="text-xs text-slate-400 mt-0.5">expense tracker</p>
        </div>
        <ProjectSwitcher />
        <nav className="flex-1 px-3 py-4 space-y-1" aria-label="Main menu">
          <NavLinks
            isActive={isActive}
            onClose={onClose}
            isSuperAdmin={isSuperAdmin}
            onOpenSuperAdmin={() => setIsSuperAdminModalOpen(true)}
          />
        </nav>
        <div className="px-4 py-3 border-t border-slate-200">
          <button
            onClick={() => setIsInviteModalOpen(true)}
            className="w-full flex items-center gap-2 px-3 py-2 mb-2 text-xs font-medium text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5" />
            {canInviteToProject ? 'Invite to project' : 'Invite to vBudget'}
          </button>
          <p className="text-xs text-slate-400 px-3">v2.0.0-next</p>
        </div>
      </aside>

      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50" aria-hidden={!isMobileOpen}>
          <div className="absolute inset-0 bg-black/50 transition-opacity" onClick={onClose} aria-hidden="true" />
          <aside
            className="absolute left-0 top-0 h-full w-72 bg-white border-r border-slate-200 flex flex-col shadow-xl transform transition-transform duration-300 ease-in-out translate-x-0"
            aria-label="Mobile navigation"
          >
            <div className="flex items-center justify-between px-4 py-4 border-b border-slate-200">
              <div>
                <span className="text-xl font-bold text-slate-800 tracking-tight">vBudget</span>
                <p className="text-xs text-slate-400 mt-0.5">expense tracker</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                aria-label="Close navigation menu"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <ProjectSwitcher onClose={onClose} />
            <nav className="flex-1 px-3 py-4 space-y-1" aria-label="Mobile main menu">
              <NavLinks
                isActive={isActive}
                onClose={onClose}
                isSuperAdmin={isSuperAdmin}
                onOpenSuperAdmin={() => {
                  setIsSuperAdminModalOpen(true);
                  onClose?.();
                }}
              />
            </nav>
            <div className="px-4 py-3 border-t border-slate-200">
              <button
                onClick={() => { setIsInviteModalOpen(true); onClose?.(); }}
                className="w-full flex items-center gap-2 px-3 py-2 mb-2 text-xs font-medium text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                {canInviteToProject ? 'Invite to project' : 'Invite to vBudget'}
              </button>
              <p className="text-xs text-slate-400 px-3">v2.0.0-next</p>
            </div>
          </aside>
        </div>
      )}

      <SuperAdminModal
        isOpen={isSuperAdminModalOpen}
        onClose={() => setIsSuperAdminModalOpen(false)}
        currentUserEmail={currentUser?.email || ''}
      />

      <InviteMemberModal
        isOpen={isInviteModalOpen}
        projectId={currentProjectId || undefined}
        mode={inviteMode}
        onClose={() => setIsInviteModalOpen(false)}
      />
    </>
  );
}
