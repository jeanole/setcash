'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { ChevronDown, Check } from 'lucide-react';
import { useProjects } from '@/lib/hooks/useProjects';
import { cn } from '@/lib/utils';

interface ProjectSwitcherProps {
  onClose?: () => void;
}

export default function ProjectSwitcher({ onClose }: ProjectSwitcherProps) {
  const { data: session } = useSession();
  const { projects, isLoading, switchProject } = useProjects();
  const [isOpen, setIsOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentProjectName = session?.user?.currentProjectName;
  const currentProjectRole = session?.user?.currentProjectRole;

  const hasMultipleProjects = projects.length > 1;

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeDropdown();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, closeDropdown]);

  // Close on ESC
  useEffect(() => {
    if (!isOpen) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeDropdown();
      }
    };

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, closeDropdown]);

  const handleToggle = () => {
    if (hasMultipleProjects) {
      setIsOpen((prev) => !prev);
    }
  };

  const handleSwitch = async (projectId: string) => {
    if (isSwitching) return;
    setIsSwitching(projectId);
    closeDropdown();
    onClose?.();
    await switchProject(projectId);
    setIsSwitching(null);
  };

  if (isLoading) {
    return (
      <div className="px-6 py-3 border-b border-slate-200">
        <p className="text-sm text-slate-400">Loading...</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} data-tour="project-switcher" className="relative px-6 py-3 border-b border-slate-200">
      <button
        type="button"
        onClick={handleToggle}
        disabled={!hasMultipleProjects}
        className={cn(
          'w-full flex items-center justify-between gap-2 text-left',
          hasMultipleProjects && 'cursor-pointer'
        )}
        aria-haspopup={hasMultipleProjects ? 'listbox' : undefined}
        aria-expanded={hasMultipleProjects ? isOpen : undefined}
        aria-label={hasMultipleProjects ? 'Switch project' : undefined}
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">
            {currentProjectName ?? 'No project'}
          </p>
          {currentProjectRole && (
            <p className="text-[10px] uppercase tracking-wider text-slate-400 mt-0.5">
              {currentProjectRole}
            </p>
          )}
        </div>
        {hasMultipleProjects && (
          <ChevronDown
            className={cn(
              'w-4 h-4 text-slate-400 shrink-0 transition-transform duration-150',
              isOpen && 'rotate-180'
            )}
          />
        )}
      </button>

      {isOpen && hasMultipleProjects && (
        <div
          role="listbox"
          aria-label="Projects"
          className="absolute left-3 right-3 mt-1 bg-white rounded-lg border border-slate-200 shadow-lg z-50 overflow-hidden"
        >
          {projects.map((project) => {
            const isActive = project.isCurrent;
            const isBusy = isSwitching === project.id;

            return (
              <button
                key={project.id}
                role="option"
                aria-selected={isActive}
                type="button"
                onClick={() => {
                  if (!isActive) {
                    handleSwitch(project.id);
                  } else {
                    closeDropdown();
                  }
                }}
                disabled={isBusy}
                className={cn(
                  'w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm transition-colors',
                  isActive
                    ? 'text-indigo-700 bg-indigo-50 font-medium'
                    : 'text-slate-600 hover:bg-slate-50 cursor-pointer'
                )}
              >
                <span className="truncate">{project.name}</span>
                {isActive && (
                  <Check className="w-4 h-4 shrink-0 text-indigo-500" />
                )}
                {isBusy && !isActive && (
                  <span className="text-xs text-slate-400 shrink-0">Switching...</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
