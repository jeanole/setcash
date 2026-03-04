'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { ProjectRole } from '@/lib/types';
import RoleBadge from './RoleBadge';
import { ChevronDown } from 'lucide-react';

interface RoleSelectProps {
  value: ProjectRole;
  onChange: (role: ProjectRole) => void;
  currentUserRole: ProjectRole;
  disabled?: boolean;
}

const ROLE_OPTIONS: { value: ProjectRole; label: string; requiresOwner: boolean }[] = [
  { value: 'user', label: 'User', requiresOwner: false },
  { value: 'admin', label: 'Admin', requiresOwner: false },
  { value: 'owner', label: 'Owner', requiresOwner: true },
];

export default function RoleSelect({
  value,
  onChange,
  currentUserRole,
  disabled = false,
}: RoleSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isOwner = currentUserRole === 'owner';

  const handleSelect = (role: ProjectRole) => {
    onChange(role);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'flex items-center gap-2 px-2 py-1 rounded-lg border transition-colors',
          disabled
            ? 'opacity-50 cursor-not-allowed bg-slate-50 border-slate-200'
            : 'hover:bg-slate-50 border-slate-200 bg-white cursor-pointer'
        )}
      >
        <RoleBadge role={value} size="sm" />
        {!disabled && <ChevronDown className="w-3 h-3 text-slate-400" />}
      </button>

      {isOpen && !disabled && (
        <div className="absolute z-50 mt-1 w-40 bg-white rounded-lg shadow-lg border border-slate-200 py-1 animate-[fadeIn_0.1s_ease-out]">
          {ROLE_OPTIONS.map((option) => {
            const isDisabled = option.requiresOwner && !isOwner;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => !isDisabled && handleSelect(option.value)}
                disabled={isDisabled}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-left transition-colors',
                  isDisabled
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:bg-slate-50 cursor-pointer',
                  value === option.value && 'bg-indigo-50'
                )}
              >
                <RoleBadge role={option.value} size="sm" />
                {isDisabled && (
                  <span className="text-xs text-slate-400 ml-auto">Owner only</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
