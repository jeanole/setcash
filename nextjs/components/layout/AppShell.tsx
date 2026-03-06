'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';

interface AppShellProps {
  children: ReactNode;
  title?: string;
  currentUser: {
    email: string;
    role: 'user' | 'admin' | 'superadmin';
  } | null;
}

export default function AppShell({ children, title, currentUser }: AppShellProps): ReactNode {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleMenuToggle = () => {
    setIsMobileMenuOpen((prev) => !prev);
  };

  const handleMenuClose = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--vb-content-bg)]">
      <Sidebar
        currentUser={currentUser}
        isMobileOpen={isMobileMenuOpen}
        onClose={handleMenuClose}
      />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header
          title={title}
          user={currentUser}
          onMenuToggle={handleMenuToggle}
        />
        <main
          className="flex-1 overflow-y-auto"
          aria-label="Page content"
        >
          <div className="max-w-7xl mx-auto px-4 md:px-6 pb-8 pt-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
