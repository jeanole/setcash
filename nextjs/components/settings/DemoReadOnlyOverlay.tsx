'use client';

import type { ReactNode } from 'react';

export default function DemoReadOnlyOverlay({
  isDemoAccount,
  children,
}: {
  isDemoAccount: boolean;
  children: ReactNode;
}) {
  if (!isDemoAccount) return <>{children}</>;

  return (
    <>
      <div className="mb-4 flex items-center gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
        </svg>
        <span><strong>Demo mode</strong> — Settings are visible but cannot be changed in the example account.</span>
      </div>
      <div className="pointer-events-none select-none opacity-60">
        {children}
      </div>
    </>
  );
}
