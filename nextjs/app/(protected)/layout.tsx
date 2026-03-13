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
        username: (session.user as { username?: string | null }).username ?? null,
        firstName: (session.user as { firstName?: string | null }).firstName ?? null,
        lastName: (session.user as { lastName?: string | null }).lastName ?? null,
        mobile: (session.user as { mobile?: string | null }).mobile ?? null,
      }
    : null;

  return (
    <ClientSessionProvider session={session}>
      <AppShell currentUser={currentUser}>
        {children}
      </AppShell>
    </ClientSessionProvider>
  );
}
