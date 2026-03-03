import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

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
    };
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    id: string;
    role: 'user' | 'admin' | 'superadmin';
    currentProjectId: string | null;
  }
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
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email =
          typeof credentials.email === 'string' ? credentials.email : '';
        const password =
          typeof credentials.password === 'string'
            ? credentials.password
            : '';

        const user = await prisma.user.findUnique({
          where: { email },
          include: {
            memberships: { select: { projectId: true, role: true } },
          },
        });

        if (!user) return null;

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
    async jwt({ token, user }) {
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
          token.role =
            (membership?.role as 'user' | 'admin') ?? 'user';
        }

        if (token.role === 'superadmin') {
          token.currentProjectId = null;
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
        session.user.role = token.role as 'user' | 'admin' | 'superadmin';
        session.user.currentProjectId = token.currentProjectId as
          | string
          | null;
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
