import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '../../auth';
import AppShell from '@/components/layout/AppShell';
import ClientSessionProvider from '@/components/providers/ClientSessionProvider';

// ---------------------------------------------------------------------------
// Protected layout — server-side session guard
// Redirects unauthenticated users to /login
// Wraps children with SessionProvider for client components
// ---------------------------------------------------------------------------

export default async function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  const currentUser = session.user
    ? {
        email: session.user.email || '',
        role: (session.user.role as 'user' | 'admin' | 'superadmin') || 'user',
      }
    : null;

  return (
    <AppShell currentUser={currentUser}>
      <ClientSessionProvider session={session}>
        {children}
      </ClientSessionProvider>
    </AppShell>
  );
}
