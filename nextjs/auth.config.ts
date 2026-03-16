import type { NextAuthConfig } from 'next-auth';

// ---------------------------------------------------------------------------
// Edge-compatible NextAuth config (NO Prisma, NO bcrypt)
// Used by middleware.ts — must run in Edge Runtime.
// The full config with Prisma lives in auth.ts.
// ---------------------------------------------------------------------------

export const authConfig = {
  session: { strategy: 'jwt' as const },
  // trustHost: true is required for Docker/reverse-proxy deployments.
  // Ensure the upstream proxy (nginx/Traefik) sets the Host header correctly.
  trustHost: true,

  pages: {
    signIn: '/login',
    error: '/login',
  },

  // Providers are added in auth.ts — middleware only verifies existing JWTs,
  // it never calls `authorize`.
  providers: [],

  callbacks: {
    // Lightweight JWT callback — just passes through existing token fields.
    // The enriched version (with Prisma DB lookups) lives in auth.ts.
    jwt({ token }) {
      return token;
    },

    // Session callback — expose token fields to client session.
    // Mirrors the full version in auth.ts.
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.role = token.role as 'user' | 'admin' | 'owner' | 'superadmin';
        session.user.currentProjectId = token.currentProjectId as string | null;
        session.user.currentProjectRole = token.currentProjectRole as 'user' | 'admin' | 'owner' | null;
        session.user.currentProjectName = token.currentProjectName as string | null;
        session.user.isExampleProject = (token.isExampleProject as boolean) ?? false;
        session.user.isDemoAccount = (token.isDemoAccount as boolean) ?? false;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
