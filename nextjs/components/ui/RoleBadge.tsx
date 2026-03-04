'use client';

import { cn } from '@/lib/utils';

export type RoleType = 'user' | 'admin' | 'owner' | 'superadmin';

interface RoleBadgeProps {
  role: RoleType;
  size?: 'sm' | 'md';
}

const roleConfig: Record<RoleType, { label: string; bg: string; text: string; border: string }> = {
  user: {
    label: 'User',
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-200',
  },
  admin: {
    label: 'Admin',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
  },
  owner: {
    label: 'Owner',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
  },
  superadmin: {
    label: 'Super Admin',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
  },
};

export default function RoleBadge({ role, size = 'md' }: RoleBadgeProps) {
  const config = roleConfig[role] || roleConfig.user;

  const sizeClasses = {
    sm: 'text-[0.65rem] px-1.5 py-px',
    md: 'text-xs px-2 py-1',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded font-medium border',
        config.bg,
        config.text,
        config.border,
        sizeClasses[size]
      )}
    >
      {config.label}
    </span>
  );
}
