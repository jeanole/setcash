import NextAuth, { CredentialsSignin } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// NextAuth v5 session/JWT type augmentation
// ---------------------------------------------------------------------------

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role: 'user' | 'admin' | 'superadmin';
      currentProjectId: string | null;
      currentProjectRole: 'user' | 'admin' | 'owner' | null;
      currentProjectName: string | null;
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
}> {
  if (!defaultProjectId) {
    return {
      currentProjectId: null,
      currentProjectRole: null,
      currentProjectName: null,
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
    };
  }

  return {
    currentProjectId: defaultProjectId,
    currentProjectRole: membership.role as 'user' | 'admin' | 'owner',
    currentProjectName: membership.project.name,
  };
}

// ---------------------------------------------------------------------------
// Custom error classes for CredentialsProvider (NextAuth v5)
// The `code` property surfaces as result.error in the client when
// signIn('credentials', { redirect: false }) is used.
// ---------------------------------------------------------------------------

class GoogleOnlyAccountError extends CredentialsSignin {
  code = 'GoogleOnlyAccount' as const;
}

class AccountDisabledError extends CredentialsSignin {
  code = 'AccountDisabled' as const;
}

// ---------------------------------------------------------------------------
// Prisma singleton (avoid multiple instances during hot-reload in dev)
// ---------------------------------------------------------------------------

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// ---------------------------------------------------------------------------
// NextAuth configuration
// ---------------------------------------------------------------------------

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
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

        const user = await prisma.user.findUnique({
          where: { email },
          include: {
            memberships: { select: { projectId: true, role: true } },
          },
        });

        if (!user) return null;

        if (!user.isActive) throw new AccountDisabledError();
        if (!user.passwordHash) throw new GoogleOnlyAccountError();

        const passwordMatch = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatch) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.email,
          isSuperAdmin: user.isSuperAdmin,
          defaultProjectId: user.defaultProjectId,
          memberships: user.memberships,
        };
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
    async jwt({ token, user, trigger }) {
      // Get user email for DB lookups
      const userEmail = token.email || (user as { email?: string })?.email;

      if (user) {
        // Initial sign-in — enrich token from the authorized user object
        const u = user as {
          id: string;
          email: string;
          isSuperAdmin?: boolean;
          defaultProjectId?: string | null;
          memberships?: Array<{ projectId: string; role: string }>;
        };

        token.id = u.id;
        token.email = u.email;

        // Derive role
        if (u.isSuperAdmin) {
          token.role = 'superadmin';
        } else {
          // Determine currentProjectId: prefer defaultProjectId,
          // else the single membership's project, else null
          let currentProjectId: string | null = null;

          if (u.defaultProjectId) {
            currentProjectId = u.defaultProjectId;
          } else if (u.memberships && u.memberships.length === 1) {
            currentProjectId = u.memberships[0].projectId;
          }

          token.currentProjectId = currentProjectId;

          // Role for the current project
          const membership = u.memberships?.find(
            (m) => m.projectId === currentProjectId
          );
          const projectRole = (membership?.role as 'user' | 'admin' | 'owner') ?? 'user';
          token.role = projectRole;
          token.currentProjectRole = projectRole;
          
          // Fetch project name from DB during sign-in
          if (currentProjectId && userEmail) {
            const projectDetails = await getCurrentProjectDetails(userEmail, currentProjectId);
            token.currentProjectId = projectDetails.currentProjectId;
            token.currentProjectRole = projectDetails.currentProjectRole;
            token.currentProjectName = projectDetails.currentProjectName;
          } else {
            token.currentProjectName = null;
          }
        }

        if (token.role === 'superadmin') {
          token.currentProjectId = null;
          token.currentProjectRole = null;
          token.currentProjectName = null;
        }
      }

      // ------------------------------------------------------------------
      // Re-fetch current project from DB on every request to keep session in sync
      // This ensures project switching is reflected immediately
      // ------------------------------------------------------------------
      if (token.id && token.role !== 'superadmin' && userEmail) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { defaultProjectId: true },
          });

          if (dbUser?.defaultProjectId) {
            // Only re-fetch if project changed or trigger is 'update'
            if (trigger === 'update' || dbUser.defaultProjectId !== token.currentProjectId) {
              const projectDetails = await getCurrentProjectDetails(
                userEmail,
                dbUser.defaultProjectId
              );
              token.currentProjectId = projectDetails.currentProjectId;
              token.currentProjectRole = projectDetails.currentProjectRole;
              token.currentProjectName = projectDetails.currentProjectName;
              
              // Update the token role to match the project role
              if (projectDetails.currentProjectRole) {
                token.role = projectDetails.currentProjectRole;
              }
            }
          } else {
            // No default project set
            token.currentProjectId = null;
            token.currentProjectRole = null;
            token.currentProjectName = null;
          }
        } catch (error) {
          console.error('Error refreshing project in JWT callback:', error);
          // Keep existing token values on error
        }
      }

      return token;
    },

    // ------------------------------------------------------------------
    // Session callback — expose token fields to client session
    // ------------------------------------------------------------------
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.role = token.role as 'user' | 'admin' | 'superadmin';
        session.user.currentProjectId = token.currentProjectId as string | null;
        session.user.currentProjectRole = token.currentProjectRole as 'user' | 'admin' | 'owner' | null;
        session.user.currentProjectName = token.currentProjectName as string | null;
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
        const existing = await prisma.user.findUnique({
          where: { email: user.email },
        });

        if (existing && !existing.isActive) return false;

        if (!existing) {
          // Auto-create user on first Google sign-in (passwordHash is empty)
          await prisma.user.create({
            data: {
              email: user.email,
              passwordHash: '',
            },
          });
        }

        return true;
      }

      return true;
    },
  },
});
