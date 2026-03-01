import type { ReactNode } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';

interface AppShellProps {
  children: ReactNode;
  title?: string;
}

export default function AppShell({ children, title }: AppShellProps): ReactNode {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header title={title} />
        <main
          className="flex-1 overflow-y-auto p-4 md:p-6"
          aria-label="Page content"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
