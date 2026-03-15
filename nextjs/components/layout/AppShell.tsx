'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import BugReportModal from './BugReportModal';
import ProfileModal from './ProfileModal';

interface AppShellProps {
  children: ReactNode;
  title?: string;
  currentUser: {
    email: string;
    role: 'user' | 'admin' | 'superadmin';
    username?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    mobile?: string | null;
  } | null;
}

export default function AppShell({ children, title, currentUser }: AppShellProps): ReactNode {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isBugReportOpen, setIsBugReportOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Local copy of profile fields so header re-renders immediately after save
  const [profileFields, setProfileFields] = useState<{
    username: string | null;
    firstName: string | null;
    lastName: string | null;
  }>({
    username: currentUser?.username ?? null,
    firstName: currentUser?.firstName ?? null,
    lastName: currentUser?.lastName ?? null,
  });

  const handleMenuToggle = () => {
    setIsMobileMenuOpen((prev) => !prev);
  };

  const handleMenuClose = () => {
    setIsMobileMenuOpen(false);
  };

  const handleProfileUpdated = (updated: {
    username: string | null;
    firstName: string | null;
    lastName: string | null;
  }) => {
    setProfileFields(updated);
  };

  // Merged user object passed to Header so the avatar initials update instantly
  const headerUser = currentUser
    ? {
        email: currentUser.email,
        username: profileFields.username,
        firstName: profileFields.firstName,
      }
    : null;

  // Full user object passed to ProfileModal
  const profileUser = currentUser
    ? {
        email: currentUser.email,
        username: profileFields.username,
        firstName: profileFields.firstName,
        lastName: profileFields.lastName,
        mobile: currentUser.mobile ?? null,
      }
    : null;

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
          user={headerUser}
          onMenuToggle={handleMenuToggle}
          onProfileOpen={() => setIsProfileOpen(true)}
        />
        <main
          className="flex-1 overflow-y-auto"
          aria-label="Page content"
        >
          <div className="max-w-7xl mx-auto px-4 md:px-6 pb-8 pt-6">
            {children}
          </div>
          <footer className="border-t border-[var(--border)] bg-[var(--bg-surface)] px-4 md:px-6 py-3">
            <div className="max-w-7xl mx-auto flex items-center justify-between text-xs text-zinc-400">
              <span>&copy; {new Date().getFullYear()} SetCash</span>
              <button
                onClick={() => setIsBugReportOpen(true)}
                className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-zinc-600 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                </svg>
                Report Bug
              </button>
            </div>
          </footer>
        </main>
        <BugReportModal isOpen={isBugReportOpen} onClose={() => setIsBugReportOpen(false)} />
        {profileUser && (
          <ProfileModal
            isOpen={isProfileOpen}
            onClose={() => setIsProfileOpen(false)}
            user={profileUser}
            onProfileUpdated={handleProfileUpdated}
          />
        )}
      </div>
    </div>
  );
}
