'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';

interface SetupGuideProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

let idCounter = 0;

export default function SetupGuide({ title, children, defaultOpen = false }: SetupGuideProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [ids] = useState(() => {
    const n = ++idCounter;
    return { button: `setup-guide-btn-${n}`, region: `setup-guide-region-${n}` };
  });

  return (
    <div className="bg-[var(--vb-accent-light)] border border-[var(--vb-accent)] rounded-lg px-4 py-3">
      <button
        type="button"
        id={ids.button}
        aria-expanded={open}
        aria-controls={ids.region}
        onClick={() => setOpen((v) => !v)}
        className="text-sm font-semibold text-zinc-800 flex items-center gap-2 w-full text-left uppercase tracking-wider"
      >
        {open ? (
          <ChevronDown className="w-4 h-4 text-zinc-600 transition-transform duration-200 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-zinc-600 transition-transform duration-200 shrink-0" />
        )}
        {title}
      </button>

      <div
        id={ids.region}
        role="region"
        aria-labelledby={ids.button}
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
