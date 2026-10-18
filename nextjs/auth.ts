import NextAuth, { CredentialsSignin } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type { JWT } from '@auth/core/jwt';

// ---------------------------------------------------------------------------
// NextAuth v5 session/JWT type augmentation
// ---------------------------------------------------------------------------

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role: 'user' | 'admin' | 'owner' | 'superadmin';
      currentProjectId: string | null;
      currentProjectRole: 'user' | 'admin' | 'owner' | null;
      currentProjectName: string | null;
      isExampleProject: boolean;
      isDemoAccount: boolean;
      hasSeenTour: boolean;
    };
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    id: string;
    email: string;
    role: 'user' | 'admin' | 'owner' | 'superadmin';
    currentProjectId: string | null;
    currentProjectRole: 'user' | 'admin' | 'owner' | null;
    currentProjectName: string | null;
    isExampleProject: boolean;
    isDemoAccount: boolean;
    hasSeenTour: boolean;
    sessionVersion?: number;
  }
}

// ---------------------------------------------------------------------------
// Helper: Fetch current project details from database
// ---------------------------------------------------------------------------

async function getCurrentProjectDetails(
  userEmail: string,
  defaultProjectId: string | null
): Promise<{
  currentProjectId: string | null;
  currentProjectRole: 'user' | 'admin' | 'owner' | null;
  currentProjectName: string | null;
  isExampleProject: boolean;
}> {
  if (!defaultProjectId) {
    return {
      currentProjectId: null,
      currentProjectRole: null,
      currentProjectName: null,
      isExampleProject: false,
    };
  }

  const membership = await prisma.projectMember.findUnique({
    where: {
      projectId_userEmail: {
        projectId: defaultProjectId,
        userEmail,
      },
    },
    include: {
      project: true,
    },
  });

  if (!membership) {
    return {
      currentProjectId: null,
      currentProjectRole: null,
      currentProjectName: null,
      isExampleProject: false,
    };
  }

  return {
    currentProjectId: defaultProjectId,
    currentProjectRole: membership.role as 'user' | 'admin' | 'owner',
    currentProjectName: membership.project.name,
    isExampleProject: membership.project.isExample,
  };
}

// Superadmins bypass membership — look up project directly
async function getSuperAdminProjectDetails(projectId: string | null): Promise<{
  currentProjectId: string | null;
  currentProjectName: string | null;
  isExampleProject: boolean;
}> {
  if (!projectId) return { currentProjectId: null, currentProjectName: null, isExampleProject: false };

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, isExample: true },
  });

  if (!project) return { currentProjectId: null, currentProjectName: null, isExampleProject: false };

  return { currentProjectId: project.id, currentProjectName: project.name, isExampleProject: project.isExample };
}

// ---------------------------------------------------------------------------
// Custom error classes for CredentialsProvider (NextAuth v5)
// The `code` property surfaces as result.error in the client when
// signIn('credentials', { redirect: false }) is used.
// ---------------------------------------------------------------------------

// bcrypt hash (cost 12) of a random string, compared against when the email
// is unknown so failed logins take the same time either way.
const DUMMY_PASSWORD_HASH = '$2b$12$yWJXt6CAxPPWdp65uiKx8eHWqsSC3Q1x2LmYYIy523jWSEihPytma';

class GoogleOnlyAccountError extends CredentialsSignin {
  code = 'GoogleOnlyAccount' as const;
}

class AccountDisabledError extends CredentialsSignin {
  code = 'AccountDisabled' as const;
}

class EmailNotVerifiedError extends CredentialsSignin {
  code = 'EmailNotVerified' as const;
}

// ---------------------------------------------------------------------------
// Prisma singleton (avoid multiple instances during hot-reload in dev)
// ---------------------------------------------------------------------------

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// ---------------------------------------------------------------------------
// Token re-validation — called from the jwt callback on every invocation
// ---------------------------------------------------------------------------

/**
 * Re-sync a JWT with the database. Returns null to end the session.
 * Exported for tests; `isSignIn` is true only when the token is first issued.
 */
export async function syncTokenWithDb(token: JWT, isSignIn: boolean): Promise<JWT | null> {
  // ------------------------------------------------------------------
  // Re-validate the token against the database on EVERY call (sign-in,
  // client-triggered update after a project switch, and each request).
  // Nothing in the client update() payload is trusted: /api/projects/switch
  // persists User.defaultProjectId first, so the DB is the source of truth.
  //
  // Revocation: the session ends (return null) when the user was deleted
  // or deactivated, or when their password changed after the token was
  // issued (sessionVersion mismatch). Role, superadmin status and project
  // membership are re-read every time, so demotions and removals take
  // effect on the next request.
  // ------------------------------------------------------------------
  const userEmail = token.email;
  if (userEmail) {
    try {
      const dbUser = await prisma.user.findUnique({
        where: { email: userEmail },
        select: {
          id: true,
          defaultProjectId: true,
          isSuperAdmin: true,
          isActive: true,
          isDemoAccount: true,
          hasSeenTour: true,
          sessionVersion: true,
        },
      });

      if (!dbUser || !dbUser.isActive) return null;

      if (isSignIn) {
        token.sessionVersion = dbUser.sessionVersion;
      } else if ((token.sessionVersion ?? 0) !== dbUser.sessionVersion) {
        return null;
      }

      // Google sign-in hands us the provider profile (random id), so always
      // take the id from our own User row.
      token.id = dbUser.id;
      token.isDemoAccount = dbUser.isDemoAccount;
      token.hasSeenTour = dbUser.hasSeenTour;

      if (dbUser.isSuperAdmin) {
        // Superadmin: look up project directly (no membership required)
        const projectDetails = await getSuperAdminProjectDetails(dbUser.defaultProjectId);
        token.role = 'superadmin';
        token.currentProjectId = projectDetails.currentProjectId;
        token.currentProjectRole = projectDetails.currentProjectId ? 'admin' : null;
        token.currentProjectName = projectDetails.currentProjectName;
        token.isExampleProject = projectDetails.isExampleProject;
      } else {
        const projectDetails = await getCurrentProjectDetails(userEmail, dbUser.defaultProjectId);
        token.role = projectDetails.currentProjectRole ?? 'user';
        token.currentProjectId = projectDetails.currentProjectId;
        token.currentProjectRole = projectDetails.currentProjectRole;
        token.currentProjectName = projectDetails.currentProjectName;
        token.isExampleProject = projectDetails.isExampleProject;
      }
    } catch (error) {
      console.error('Error refreshing session in JWT callback:', error);
      // Keep existing token values on transient DB errors
    }
  }

  return token;
}

// ---------------------------------------------------------------------------
// NextAuth configuration
// ---------------------------------------------------------------------------

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  // trustHost: true is required for Docker/reverse-proxy deployments.
  // Ensure the upstream proxy (nginx/Traefik) sets the Host header correctly.
  trustHost: true,

  pages: {
    signIn: '/login',
    error: '/login',
  },

  providers: [
    // ------------------------------------------------------------------
    // Credentials provider — email + bcrypt password
    // ------------------------------------------------------------------
    Credentials({
      name: 'Email & Password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const credentialsSchema = z.object({
          email: z.string().email(),
          password: z.string().min(1),
        });

        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const user = await prisma.user.findFirst({
          where: { email: { equals: email, mode: 'insensitive' } },
          orderBy: { createdAt: 'asc' },
          select: { id: true, email: true, passwordHash: true, isActive: true, emailVerified: true },
        });

        if (!user) {
          // Spend the same bcrypt time as a real check so response timing
          // does not reveal whether the account exists.
          await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
          return null;
        }

        if (!user.passwordHash) throw new GoogleOnlyAccountError();

        const passwordMatch = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatch) return null;

        // Account state is only revealed to someone who knows the password.
        if (!user.isActive) throw new AccountDisabledError();
        if (!user.emailVerified) throw new EmailNotVerifiedError();

        return { id: user.id, email: user.email, name: user.email };
      },
    }),

    // ------------------------------------------------------------------
    // Google OAuth provider
    // ------------------------------------------------------------------
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
  ],

  callbacks: {
    // ------------------------------------------------------------------
    // JWT callback — runs on sign-in and session refresh
    // ------------------------------------------------------------------
    async jwt({ token, user }) {
      if (user) {
        // Initial sign-in — role and project context are filled in below
        token.id = (user as { id: string }).id;
        token.email = (user as { email: string }).email;
      }

      return syncTokenWithDb(token, !!user);
    },

    // ------------------------------------------------------------------
    // Session callback — expose token fields to client session
    // ------------------------------------------------------------------
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.role = token.role as 'user' | 'admin' | 'owner' | 'superadmin';
        session.user.currentProjectId = token.currentProjectId as string | null;
        session.user.currentProjectRole = token.currentProjectRole as 'user' | 'admin' | 'owner' | null;
        session.user.currentProjectName = token.currentProjectName as string | null;
        session.user.isExampleProject = (token.isExampleProject as boolean) ?? false;
        session.user.isDemoAccount = (token.isDemoAccount as boolean) ?? false;
        session.user.hasSeenTour = (token.hasSeenTour as boolean) ?? false;
      }
      return session;
    },

    // ------------------------------------------------------------------
    // SignIn callback — handle Google OAuth user creation / linking
    // ------------------------------------------------------------------
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        if (!user.email) return false;

        // Find or create user record for Google sign-in
        // Case-insensitive: Google reports lowercase addresses, legacy
        // credential accounts may be stored with mixed case
        const existing = await prisma.user.findFirst({
          where: { email: { equals: user.email, mode: 'insensitive' } },
        });

        if (existing && !existing.isActive) return false;

        // Carry the stored address into the token (Auth.js passes this same
        // user object on to the jwt callback), so session lookups match it.
        if (existing) user.email = existing.email;

        if (!existing) {
          // Auto-create user on first Google sign-in (passwordHash is empty, auto-verified)
          await prisma.user.create({
            data: {
              email: user.email,
              passwordHash: '',
              emailVerified: new Date(),
            },
          });
        } else if (!existing.emailVerified) {
          // Existing UNVERIFIED account: its password was set by whoever signed
          // up, which Google has not proven to be this user (pre-registration
          // takeover). Drop that password — the owner can set one via
          // "Forgot password" — and end any sessions tied to it.
          await prisma.user.update({
            where: { id: existing.id },
            data: {
              emailVerified: new Date(),
              passwordHash: '',
              sessionVersion: { increment: 1 },
            },
          });
        }

        return true;
      }

      return true;
    },
  },
});
