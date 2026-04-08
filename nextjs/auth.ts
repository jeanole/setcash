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
          include: {
            memberships: { select: { projectId: true, role: true } },
          },
        });

        if (!user) return null;

        if (!user.isActive) throw new AccountDisabledError();
        if (!user.passwordHash) throw new GoogleOnlyAccountError();

        const passwordMatch = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatch) return null;

        if (!user.emailVerified) throw new EmailNotVerifiedError();

        return {
          id: user.id,
          email: user.email,
          name: user.email,
          isSuperAdmin: user.isSuperAdmin,
          isDemoAccount: user.isDemoAccount,
          hasSeenTour: user.hasSeenTour,
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
    async jwt({ token, user, trigger, session }) {
      // Get user email for DB lookups
      const userEmail = token.email || (user as { email?: string })?.email;

      if (user) {
        // Initial sign-in — enrich token from the authorized user object
        const u = user as {
          id: string;
          email: string;
          isSuperAdmin?: boolean;
          isDemoAccount?: boolean;
          hasSeenTour?: boolean;
          defaultProjectId?: string | null;
          memberships?: Array<{ projectId: string; role: string }>;
        };

        token.id = u.id;
        token.email = u.email;
        token.isDemoAccount = u.isDemoAccount ?? false;
        token.hasSeenTour = u.hasSeenTour ?? false;

        // Derive role
        if (u.isSuperAdmin) {
          token.role = 'superadmin';
          // Superadmins can hold a project context — look up project directly (bypass membership)
          if (u.defaultProjectId) {
            const projectDetails = await getSuperAdminProjectDetails(u.defaultProjectId);
            token.currentProjectId = projectDetails.currentProjectId;
            token.currentProjectRole = 'admin'; // superadmin acts as admin in any project
            token.currentProjectName = projectDetails.currentProjectName;
            token.isExampleProject = projectDetails.isExampleProject;
          } else {
            token.currentProjectId = null;
            token.currentProjectRole = null;
            token.currentProjectName = null;
            token.isExampleProject = false;
          }
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
            token.isExampleProject = projectDetails.isExampleProject;
          } else {
            token.currentProjectName = null;
            token.isExampleProject = false;
          }
        }
      }

      // ------------------------------------------------------------------
      // Handle session update trigger from client (e.g., after project switch)
      // currentProjectId and currentProjectName are taken from the session payload,
      // but currentProjectRole is ALWAYS re-fetched from the database to prevent
      // clients from escalating their own role via updateSession().
      // ------------------------------------------------------------------
      if (trigger === 'update' && session) {
        if ('currentProjectId' in session) {
          token.currentProjectId = (session.currentProjectId as string | null) ?? null;
        }
        if ('currentProjectName' in session) {
          token.currentProjectName = (session.currentProjectName as string | null) ?? null;
        }

        // Re-validate the role from the database — never trust the client-supplied value.
        if (token.currentProjectId && userEmail) {
          try {
            const dbUser = await prisma.user.findUnique({
              where: { email: userEmail },
              select: { isSuperAdmin: true },
            });

            // Look up project to get isExample flag
            const project = await prisma.project.findUnique({
              where: { id: token.currentProjectId },
              select: { isExample: true },
            });
            token.isExampleProject = project?.isExample ?? false;

            if (dbUser?.isSuperAdmin) {
              // Superadmins always act as admin in any project they switch into.
              token.currentProjectRole = 'admin';
              token.role = 'superadmin';
            } else {
              const member = await prisma.projectMember.findUnique({
                where: {
                  projectId_userEmail: {
                    projectId: token.currentProjectId,
                    userEmail,
                  },
                },
              });

              if (member) {
                token.currentProjectRole = member.role as 'user' | 'admin' | 'owner';
                token.role = token.currentProjectRole;
              } else {
                // User is not a member of the requested project — do not update role fields.
                token.currentProjectId = null;
                token.currentProjectRole = null;
                token.currentProjectName = null;
                token.isExampleProject = false;
              }
            }
          } catch (error) {
            console.error('Error validating project role in JWT update trigger:', error);
            // Keep existing token values on error — do not apply client-supplied role.
          }
        }
      }
      // ------------------------------------------------------------------
      // Re-fetch current project from DB on every request to keep session in sync
      // Uses email for lookup (works for both credentials and Google OAuth users).
      // ------------------------------------------------------------------
      else if (userEmail) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { email: userEmail },
            select: { defaultProjectId: true, isSuperAdmin: true, isDemoAccount: true, hasSeenTour: true },
          });

          // Always sync superadmin role from DB — role may change while user is logged in
          if (dbUser?.isSuperAdmin && token.role !== 'superadmin') {
            token.role = 'superadmin';
          }

          // Sync isDemoAccount and hasSeenTour from DB
          token.isDemoAccount = dbUser?.isDemoAccount ?? false;
          token.hasSeenTour = dbUser?.hasSeenTour ?? false;

          if (dbUser?.defaultProjectId) {
            // Only re-fetch project details if project changed
            if (dbUser.defaultProjectId !== token.currentProjectId) {
              if (dbUser.isSuperAdmin) {
                // Superadmin: look up project directly (no membership required)
                const projectDetails = await getSuperAdminProjectDetails(dbUser.defaultProjectId);
                token.currentProjectId = projectDetails.currentProjectId;
                token.currentProjectRole = 'admin';
                token.currentProjectName = projectDetails.currentProjectName;
                token.isExampleProject = projectDetails.isExampleProject;
              } else {
                const projectDetails = await getCurrentProjectDetails(userEmail, dbUser.defaultProjectId);
                token.currentProjectId = projectDetails.currentProjectId;
                token.currentProjectRole = projectDetails.currentProjectRole;
                token.currentProjectName = projectDetails.currentProjectName;
                token.isExampleProject = projectDetails.isExampleProject;
                if (projectDetails.currentProjectRole) {
                  token.role = projectDetails.currentProjectRole;
                }
              }
            }
          } else if (dbUser && !dbUser.defaultProjectId) {
            // User found but has no default project set
            token.currentProjectId = null;
            token.currentProjectRole = null;
            token.currentProjectName = null;
            token.isExampleProject = false;
          }
          // If dbUser is null (user not in DB yet), keep existing token values
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
        const existing = await prisma.user.findUnique({
          where: { email: user.email },
        });

        if (existing && !existing.isActive) return false;

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
          // Existing user signing in via Google — mark as verified
          await prisma.user.update({
            where: { email: user.email },
            data: { emailVerified: new Date() },
          });
        }

        return true;
      }

      return true;
    },
  },
});
