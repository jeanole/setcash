'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { ProjectPosition } from '@/lib/types';
import { ChevronDown } from 'lucide-react';

interface PositionSelectProps {
  value: string | null;
  onChange: (positionId: string | null) => void;
  positions: ProjectPosition[];
  includeNone?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export default function PositionSelect({
  value,
  onChange,
  positions,
  includeNone = true,
  disabled = false,
  placeholder = 'Select position...',
}: PositionSelectProps) {
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

  const selectedPosition = positions.find((p) => p.id === value);

  const handleSelect = (positionId: string | null) => {
    onChange(positionId);
    setIsOpen(false);
  };

  // Sort positions: Misc first, then alphabetically
  const sortedPositions = [...positions].sort((a, b) => {
    if (a.name.toLowerCase() === 'misc') return -1;
    if (b.name.toLowerCase() === 'misc') return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'flex items-center justify-between gap-2 w-full px-3 py-1.5 rounded-lg border text-sm transition-colors',
          disabled
            ? 'opacity-50 cursor-not-allowed bg-slate-50 border-slate-200'
            : 'hover:bg-slate-50 border-slate-200 bg-white cursor-pointer'
        )}
      >
        <span className={cn(!selectedPosition && 'text-slate-400')}>
          {selectedPosition?.name || (includeNone ? 'None' : placeholder)}
        </span>
        {!disabled && <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />}
      </button>

      {isOpen && !disabled && (
        <div className="absolute z-50 mt-1 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 animate-[fadeIn_0.1s_ease-out]">
          {includeNone && (
            <button
              type="button"
              onClick={() => handleSelect(null)}
              className={cn(
                'w-full px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50',
                value === null && 'bg-violet-50 text-[#7C6AF6]'
              )}
            >
              None
            </button>
          )}
          {sortedPositions.map((position) => (
            <button
              key={position.id}
              type="button"
              onClick={() => handleSelect(position.id)}
              className={cn(
                'w-full px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50',
                value === position.id && 'bg-violet-50 text-[#7C6AF6]'
              )}
            >
              {position.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
