import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '../../auth';
import { db } from '@/lib/db';
import AppShell from '@/components/layout/AppShell';
import ClientSessionProvider from '@/components/providers/ClientSessionProvider';
import AuthPageTracker from '@/components/analytics/AuthPageTracker';

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

  // Fetch profile fields from DB — these are not stored in the JWT token
  let profileFields: {
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    mobile: string | null;
  } = { username: null, firstName: null, lastName: null, mobile: null };

  if (session.user?.id) {
    const dbUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        username: true,
        firstName: true,
        lastName: true,
        mobile: true,
      },
    });

    if (dbUser) {
      profileFields = {
        username: dbUser.username,
        firstName: dbUser.firstName,
        lastName: dbUser.lastName,
        mobile: dbUser.mobile,
      };
    }
  }

  const currentUser = session.user
    ? {
        email: session.user.email || '',
        role: (session.user.role as 'user' | 'admin' | 'superadmin') || 'user',
        username: profileFields.username,
        firstName: profileFields.firstName,
        lastName: profileFields.lastName,
        mobile: profileFields.mobile,
      }
    : null;

  return (
    <ClientSessionProvider session={session}>
      <AuthPageTracker />
      <AppShell currentUser={currentUser}>
        {children}
      </AppShell>
    </ClientSessionProvider>
  );
}
