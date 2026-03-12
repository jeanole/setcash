import { auth } from '../../auth';

// ---------------------------------------------------------------------------
// SessionUser type — subset of NextAuth session user exposed to server components
// ---------------------------------------------------------------------------

export type SessionUser = {
  id: string;
  email: string;
  role: 'user' | 'admin' | 'owner' | 'superadmin';
  currentProjectId: string | null;
};

// ---------------------------------------------------------------------------
// getCurrentUser — server-side helper for server components and API routes
// Returns the authenticated user or null if unauthenticated
// ---------------------------------------------------------------------------

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();

  if (!session?.user?.id || !session?.user?.email) {
    return null;
  }

  return {
    id: session.user.id,
    email: session.user.email,
    role: session.user.role ?? 'user',
    currentProjectId: session.user.currentProjectId ?? null,
  };
}
