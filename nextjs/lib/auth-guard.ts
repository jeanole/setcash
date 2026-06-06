// ============================================================================
// Admin role re-verification guard (SEC-02)
// ============================================================================
// Re-checks a user's admin authority against the database on the request path,
// independent of the (cached) JWT claims. This catches the window where an
// admin has been demoted (or removed from a project) but is still carrying a
// JWT that claims an elevated role. On a detected demotion the session cookies
// are cleared and a 401 with code ROLE_CHANGED is returned so the client forces
// a fresh sign-in.
//
// Superadmin status and project membership/role are both read from the DB, so
// they cannot be spoofed client-side.
// ============================================================================

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';

export interface AdminRoleCheck {
  authorized: boolean;
  /** Present only when authorized === false — the response to return as-is. */
  response?: NextResponse;
}

// NextAuth v5 session cookie names (insecure + __Secure- prefixed variants).
const SESSION_COOKIE_NAMES = ['authjs.session-token', '__Secure-authjs.session-token'];

async function forceReauthResponse(): Promise<NextResponse> {
  const cookieStore = await cookies();
  for (const name of SESSION_COOKIE_NAMES) {
    cookieStore.delete(name);
  }
  return NextResponse.json(
    { error: 'Your role changed. Please sign in again.', code: 'ROLE_CHANGED' },
    { status: 401 }
  );
}

/**
 * Verify that `email` currently holds admin authority over `projectId`,
 * reading from the database rather than trusting JWT claims.
 *
 * - Superadmins are always authorized (project membership is not checked).
 * - Otherwise the caller must be a project member with role `admin` or `owner`.
 * - On demotion or lost membership the session is invalidated (401 ROLE_CHANGED).
 */
export async function verifyAdminRole(email: string, projectId: string): Promise<AdminRoleCheck> {
  const user = await db.user.findUnique({
    where: { email },
    select: { isSuperAdmin: true },
  });

  if (user?.isSuperAdmin) {
    return { authorized: true };
  }

  const membership = await db.projectMember.findUnique({
    where: { projectId_userEmail: { projectId, userEmail: email } },
    select: { role: true },
  });

  if (membership && (membership.role === 'admin' || membership.role === 'owner')) {
    return { authorized: true };
  }

  return { authorized: false, response: await forceReauthResponse() };
}
