'use client';

import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface Tab {
  id: string;
  label: string;
  href: string;
  roles: ('user' | 'admin' | 'owner' | 'superadmin')[];
}

const TABS: Tab[] = [
  { id: 'general', label: 'General', href: '/settings', roles: ['user', 'admin', 'owner', 'superadmin'] },
  { id: 'members', label: 'Members', href: '/settings/members', roles: ['admin', 'owner', 'superadmin'] },
  { id: 'positions', label: 'Positions', href: '/settings/positions', roles: ['admin', 'owner', 'superadmin'] },
  { id: 'motives', label: 'Motives', href: '/settings/motives', roles: ['admin', 'owner', 'superadmin'] },
  { id: 'categories', label: 'Categories', href: '/settings/categories', roles: ['admin', 'owner', 'superadmin'] },
  { id: 'ai-analysis', label: 'AI Analysis', href: '/settings/ai-analysis', roles: ['admin', 'owner', 'superadmin'] },
  { id: 'telegram', label: 'Telegram', href: '/settings/telegram', roles: ['user', 'admin', 'owner', 'superadmin'] },
  { id: 'projects', label: 'Projects', href: '/settings/projects', roles: ['user', 'admin', 'owner', 'superadmin'] },
];

interface SettingsTabsProps {
  userRole: 'user' | 'admin' | 'owner' | 'superadmin';
}

export default function SettingsTabs({ userRole }: SettingsTabsProps) {
  const pathname = usePathname();

  const visibleTabs = TABS.filter((tab) => tab.roles.includes(userRole));

  const isActive = (tab: Tab) => {
    if (tab.href === '/settings') {
      return pathname === '/settings' || pathname === '/settings/';
    }
    return pathname.startsWith(tab.href);
  };

  return (
    <nav className="border-b border-slate-200 mb-6">
      <div className="flex gap-1 overflow-x-auto scrollbar-hide">
        {visibleTabs.map((tab) => (
          <a
            key={tab.id}
            href={tab.href}
            className={cn(
              'px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
              isActive(tab)
                ? 'border-[#6366f1] text-[#6366f1]'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            )}
          >
            {tab.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
