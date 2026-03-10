"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
var _b, _c, _d;
Object.defineProperty(exports, "__esModule", { value: true });
exports.signOut = exports.signIn = exports.auth = exports.handlers = void 0;
const next_auth_1 = __importStar(require("next-auth"));
const credentials_1 = __importDefault(require("next-auth/providers/credentials"));
const google_1 = __importDefault(require("next-auth/providers/google"));
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const zod_1 = require("zod");
// ---------------------------------------------------------------------------
// Helper: Fetch current project details from database
// ---------------------------------------------------------------------------
async function getCurrentProjectDetails(userEmail, defaultProjectId) {
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
        currentProjectRole: membership.role,
        currentProjectName: membership.project.name,
    };
}
// Superadmins bypass membership — look up project directly
async function getSuperAdminProjectDetails(projectId) {
    if (!projectId)
        return { currentProjectId: null, currentProjectName: null };
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, name: true },
    });
    if (!project)
        return { currentProjectId: null, currentProjectName: null };
    return { currentProjectId: project.id, currentProjectName: project.name };
}
// ---------------------------------------------------------------------------
// Custom error classes for CredentialsProvider (NextAuth v5)
// The `code` property surfaces as result.error in the client when
// signIn('credentials', { redirect: false }) is used.
// ---------------------------------------------------------------------------
class GoogleOnlyAccountError extends next_auth_1.CredentialsSignin {
    constructor() {
        super(...arguments);
        this.code = 'GoogleOnlyAccount';
    }
}
class AccountDisabledError extends next_auth_1.CredentialsSignin {
    constructor() {
        super(...arguments);
        this.code = 'AccountDisabled';
    }
}
// ---------------------------------------------------------------------------
// Prisma singleton (avoid multiple instances during hot-reload in dev)
// ---------------------------------------------------------------------------
const globalForPrisma = globalThis;
const prisma = (_b = globalForPrisma.prisma) !== null && _b !== void 0 ? _b : new client_1.PrismaClient();
if (process.env.NODE_ENV !== 'production')
    globalForPrisma.prisma = prisma;
// ---------------------------------------------------------------------------
// NextAuth configuration
// ---------------------------------------------------------------------------
_a = (0, next_auth_1.default)({
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
        (0, credentials_1.default)({
            name: 'Email & Password',
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Password', type: 'password' },
            },
            async authorize(credentials) {
                const credentialsSchema = zod_1.z.object({
                    email: zod_1.z.string().email(),
                    password: zod_1.z.string().min(1),
                });
                const parsed = credentialsSchema.safeParse(credentials);
                if (!parsed.success)
                    return null;
                const { email, password } = parsed.data;
                const user = await prisma.user.findUnique({
                    where: { email },
                    include: {
                        memberships: { select: { projectId: true, role: true } },
                    },
                });
                if (!user)
                    return null;
                if (!user.isActive)
                    throw new AccountDisabledError();
                if (!user.passwordHash)
                    throw new GoogleOnlyAccountError();
                const passwordMatch = await bcryptjs_1.default.compare(password, user.passwordHash);
                if (!passwordMatch)
                    return null;
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
        (0, google_1.default)({
            clientId: (_c = process.env.GOOGLE_CLIENT_ID) !== null && _c !== void 0 ? _c : '',
            clientSecret: (_d = process.env.GOOGLE_CLIENT_SECRET) !== null && _d !== void 0 ? _d : '',
        }),
    ],
    callbacks: {
        // ------------------------------------------------------------------
        // JWT callback — runs on sign-in and session refresh
        // ------------------------------------------------------------------
        async jwt({ token, user, trigger, session }) {
            var _a, _b, _c, _d, _e;
            // Get user email for DB lookups
            const userEmail = token.email || (user === null || user === void 0 ? void 0 : user.email);
            if (user) {
                // Initial sign-in — enrich token from the authorized user object
                const u = user;
                token.id = u.id;
                token.email = u.email;
                // Derive role
                if (u.isSuperAdmin) {
                    token.role = 'superadmin';
                    // Superadmins can hold a project context — look up project directly (bypass membership)
                    if (u.defaultProjectId) {
                        const projectDetails = await getSuperAdminProjectDetails(u.defaultProjectId);
                        token.currentProjectId = projectDetails.currentProjectId;
                        token.currentProjectRole = 'admin'; // superadmin acts as admin in any project
                        token.currentProjectName = projectDetails.currentProjectName;
                    }
                    else {
                        token.currentProjectId = null;
                        token.currentProjectRole = null;
                        token.currentProjectName = null;
                    }
                }
                else {
                    // Determine currentProjectId: prefer defaultProjectId,
                    // else the single membership's project, else null
                    let currentProjectId = null;
                    if (u.defaultProjectId) {
                        currentProjectId = u.defaultProjectId;
                    }
                    else if (u.memberships && u.memberships.length === 1) {
                        currentProjectId = u.memberships[0].projectId;
                    }
                    token.currentProjectId = currentProjectId;
                    // Role for the current project
                    const membership = (_a = u.memberships) === null || _a === void 0 ? void 0 : _a.find((m) => m.projectId === currentProjectId);
                    const projectRole = (_b = membership === null || membership === void 0 ? void 0 : membership.role) !== null && _b !== void 0 ? _b : 'user';
                    token.role = projectRole;
                    token.currentProjectRole = projectRole;
                    // Fetch project name from DB during sign-in
                    if (currentProjectId && userEmail) {
                        const projectDetails = await getCurrentProjectDetails(userEmail, currentProjectId);
                        token.currentProjectId = projectDetails.currentProjectId;
                        token.currentProjectRole = projectDetails.currentProjectRole;
                        token.currentProjectName = projectDetails.currentProjectName;
                    }
                    else {
                        token.currentProjectName = null;
                    }
                }
            }
            // ------------------------------------------------------------------
            // Handle session update trigger from client (e.g., after project switch)
            // Use the session data passed from updateSession() directly — it was
            // validated server-side by POST /api/projects/switch before being sent.
            // ------------------------------------------------------------------
            if (trigger === 'update' && session) {
                if ('currentProjectId' in session) {
                    token.currentProjectId = (_c = session.currentProjectId) !== null && _c !== void 0 ? _c : null;
                }
                if ('currentProjectRole' in session) {
                    token.currentProjectRole = (_d = session.currentProjectRole) !== null && _d !== void 0 ? _d : null;
                    if (token.currentProjectRole) {
                        token.role = token.currentProjectRole;
                    }
                }
                if ('currentProjectName' in session) {
                    token.currentProjectName = (_e = session.currentProjectName) !== null && _e !== void 0 ? _e : null;
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
                        select: { defaultProjectId: true, isSuperAdmin: true },
                    });
                    // Always sync superadmin role from DB — role may change while user is logged in
                    if ((dbUser === null || dbUser === void 0 ? void 0 : dbUser.isSuperAdmin) && token.role !== 'superadmin') {
                        token.role = 'superadmin';
                    }
                    if (dbUser === null || dbUser === void 0 ? void 0 : dbUser.defaultProjectId) {
                        // Only re-fetch project details if project changed
                        if (dbUser.defaultProjectId !== token.currentProjectId) {
                            if (dbUser.isSuperAdmin) {
                                // Superadmin: look up project directly (no membership required)
                                const projectDetails = await getSuperAdminProjectDetails(dbUser.defaultProjectId);
                                token.currentProjectId = projectDetails.currentProjectId;
                                token.currentProjectRole = 'admin';
                                token.currentProjectName = projectDetails.currentProjectName;
                            }
                            else {
                                const projectDetails = await getCurrentProjectDetails(userEmail, dbUser.defaultProjectId);
                                token.currentProjectId = projectDetails.currentProjectId;
                                token.currentProjectRole = projectDetails.currentProjectRole;
                                token.currentProjectName = projectDetails.currentProjectName;
                                if (projectDetails.currentProjectRole) {
                                    token.role = projectDetails.currentProjectRole;
                                }
                            }
                        }
                    }
                    else if (dbUser && !dbUser.defaultProjectId) {
                        // User found but has no default project set
                        token.currentProjectId = null;
                        token.currentProjectRole = null;
                        token.currentProjectName = null;
                    }
                    // If dbUser is null (user not in DB yet), keep existing token values
                }
                catch (error) {
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
                session.user.id = token.id;
                session.user.email = token.email;
                session.user.role = token.role;
                session.user.currentProjectId = token.currentProjectId;
                session.user.currentProjectRole = token.currentProjectRole;
                session.user.currentProjectName = token.currentProjectName;
            }
            return session;
        },
        // ------------------------------------------------------------------
        // SignIn callback — handle Google OAuth user creation / linking
        // ------------------------------------------------------------------
        async signIn({ user, account }) {
            if ((account === null || account === void 0 ? void 0 : account.provider) === 'google') {
                if (!user.email)
                    return false;
                // Find or create user record for Google sign-in
                const existing = await prisma.user.findUnique({
                    where: { email: user.email },
                });
                if (existing && !existing.isActive)
                    return false;
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
}), exports.handlers = _a.handlers, exports.auth = _a.auth, exports.signIn = _a.signIn, exports.signOut = _a.signOut;
