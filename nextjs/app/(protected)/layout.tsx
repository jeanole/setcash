import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { SessionProvider } from 'next-auth/react';
import { auth } from '../../auth';
import AppShell from '@/components/layout/AppShell';

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

  return (
    <SessionProvider session={session}>
      <AppShell>{children}</AppShell>
    </SessionProvider>
  );
}
