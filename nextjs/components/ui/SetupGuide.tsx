'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';

interface SetupGuideProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

export default function SetupGuide({ title, children, defaultOpen = false }: SetupGuideProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-indigo-50/60 border border-indigo-100 rounded-lg px-4 py-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="text-sm font-medium text-indigo-700 flex items-center gap-2 w-full text-left"
      >
        {open ? (
          <ChevronDown className="w-4 h-4 text-indigo-500 transition-transform duration-200 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-indigo-500 transition-transform duration-200 shrink-0" />
        )}
        {title}
      </button>

      <div
        role="region"
        className="grid transition-[grid-template-rows] duration-200 ease-in-out"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="mt-3 text-sm text-slate-700 space-y-2">{children}</div>
        </div>
      </div>
    </div>
  );
}
