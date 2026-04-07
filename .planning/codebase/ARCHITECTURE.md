# Architecture

**Analysis Date:** 2026-04-01

## Pattern Overview

**Overall:** Multi-tenant monolithic Next.js 14 App Router application with JWT-based authentication, server-side rendering for pages, and REST API routes.

**Key Characteristics:**
- Server-rendered pages with client-side interactivity (React Server Components + "use client" components)
- JWT session strategy (no database sessions) via NextAuth v5
- Project-scoped multi-tenancy with role-based access control
- Separate Edge-compatible auth config for middleware (`nextjs/auth.config.ts`) and full auth config with Prisma for API routes (`nextjs/auth.ts`)
- Custom HTTP server wrapping Next.js to support long-running Telegram bot processes (`nextjs/server.ts`)

## Layers

**Middleware (Edge Runtime):**
- Purpose: Authentication gate for all non-public routes
- Location: `nextjs/middleware.ts`
- Contains: JWT verification only (no DB access)
- Depends on: `nextjs/auth.config.ts` (edge-compatible NextAuth config)
- Used by: Every incoming request matching the route matcher

**Pages (Server Components):**
- Purpose: Server-side rendered page shells that fetch initial data and enforce auth
- Location: `nextjs/app/(protected)/` and `nextjs/app/(public)/`
- Contains: Server components that call `auth()` and pass data to client components
- Depends on: `nextjs/auth.ts`, `nextjs/lib/db.ts`
- Used by: Browser navigation

**Client Components:**
- Purpose: Interactive UI with state management, API calls, and user interactions
- Location: `nextjs/components/`
- Contains: React components using hooks from `nextjs/lib/hooks/`
- Depends on: `nextjs/lib/api/` (fetch wrappers), `nextjs/lib/types.ts`
- Used by: Page components

**API Routes (Node.js Runtime):**
- Purpose: REST endpoints handling CRUD operations, file uploads, exports
- Location: `nextjs/app/api/`
- Contains: Route handlers exporting GET/POST/PUT/DELETE/PATCH functions
- Depends on: `nextjs/auth.ts`, `nextjs/lib/db.ts`, `nextjs/lib/*.ts` utilities
- Used by: Client components via fetch, external integrations (Telegram webhook)

**Shared Libraries:**
- Purpose: Business logic, database access, external service clients, utilities
- Location: `nextjs/lib/`
- Contains: DB client, API client wrappers, hooks, notification helpers, OCR, email, Google APIs, Telegram bot, rate limiting, file upload
- Depends on: Prisma, external SDKs
- Used by: API routes and server components

**Database (Prisma ORM):**
- Purpose: PostgreSQL data access layer
- Location: Schema at `nextjs/prisma/schema.prisma`, client at `nextjs/lib/db.ts`
- Contains: 22 models covering users, projects, bills, budget matrix, notifications, analytics
- Depends on: PostgreSQL via `DATABASE_URL`
- Used by: All API routes and server components

## Data Flow

**Typical Authenticated Request (Client-Side Navigation):**

1. Browser sends request; Edge middleware (`nextjs/middleware.ts`) verifies JWT using `nextjs/auth.config.ts`
2. If unauthenticated, redirect to `/` with `callbackUrl` param
3. If authenticated, Next.js renders the server component page
4. Protected layout (`nextjs/app/(protected)/layout.tsx`) calls `auth()` (full config with Prisma) to get session
5. Layout wraps children in `ClientSessionProvider` and `AppShell`
6. Client component mounts, calls custom hook (e.g., `useBills()` from `nextjs/lib/hooks/useBills.ts`)
7. Hook calls API client function (e.g., `getBills()` from `nextjs/lib/api/bills.ts`)
8. API route handler (`nextjs/app/api/bills/route.ts`) calls `auth()` to verify session
9. Handler validates input with Zod, queries Prisma, returns JSON response
10. Hook updates React state, component re-renders

**Bill Submission Flow:**

1. User fills `BillForm` component (`nextjs/components/bills/BillForm.tsx`)
2. Form submits multipart FormData to `POST /api/bills`
3. API route (`nextjs/app/api/bills/route.ts`) verifies auth, checks rate limit via `billCreateLimiter`
4. Route parses form with `parseForm()` from `nextjs/lib/upload.ts`
5. Creates `Bill` record in DB, saves images to disk, creates `BillImage` records
6. Saves motive/category allocations (fills remainder with defaults)
7. Triggers OCR analysis if configured (`nextjs/lib/ocr.ts`)
8. Creates notification for project admins (`nextjs/lib/notifications.ts`)
9. Returns bill ID to client

**Project Switch Flow:**

1. User selects project via `ProjectSwitcher` component (`nextjs/components/layout/ProjectSwitcher.tsx`)
2. Client calls `POST /api/projects/switch` with `projectId`
3. API route (`nextjs/app/api/projects/switch/route.ts`) verifies membership (or superadmin status)
4. Updates `User.defaultProjectId` in database
5. Client calls `updateSession()` to refresh the JWT with new project context
6. JWT callback in `nextjs/auth.ts` re-fetches project role from DB (never trusts client-supplied role)

**State Management:**
- Server state: JWT token contains `currentProjectId`, `currentProjectRole`, `currentProjectName`, `isExampleProject`, `isDemoAccount`
- Client state: React `useState` hooks in custom hooks (`nextjs/lib/hooks/`); no global state library
- Session state: NextAuth `useSession()` via `ClientSessionProvider` (`nextjs/components/providers/ClientSessionProvider.tsx`)
- The JWT is refreshed on every request via the `jwt` callback, which re-fetches project details from DB when the default project changes

## Key Abstractions

**Session/JWT Token:**
- Purpose: Carries user identity and current project context across requests
- Defined in: `nextjs/auth.ts` (type augmentation for `Session` and `JWT`)
- Key fields: `id`, `email`, `role`, `currentProjectId`, `currentProjectRole`, `currentProjectName`, `isExampleProject`, `isDemoAccount`
- Pattern: Enriched on sign-in, re-validated on every request, updated on project switch

**API Client Layer:**
- Purpose: Type-safe fetch wrappers for client components to call API routes
- Examples: `nextjs/lib/api/bills.ts`, `nextjs/lib/api/members.ts`, `nextjs/lib/api/settings.ts`
- Pattern: Each function wraps `fetch()` with error handling via `fetchWithError<T>()`

**Custom Hooks:**
- Purpose: Encapsulate data fetching, state, and mutations for specific domains
- Examples: `nextjs/lib/hooks/useBills.ts`, `nextjs/lib/hooks/useCategories.ts`, `nextjs/lib/hooks/useMembers.ts`, `nextjs/lib/hooks/useMotives.ts`, `nextjs/lib/hooks/usePositions.ts`, `nextjs/lib/hooks/useProjects.ts`
- Pattern: `useState` + `useEffect` + `useCallback`; call API client functions; return data/loading/error/mutate interface

**Rate Limiting:**
- Purpose: Protect endpoints from abuse
- Defined in: `nextjs/lib/ratelimit.ts`
- Pattern: Named rate limit configs (e.g., `billCreate: { max: 10, window: '1 m' }`); uses Upstash Redis when available, falls back to in-memory

## Entry Points

**Custom Server (`nextjs/server.ts`):**
- Location: `nextjs/server.ts`
- Triggers: `npm start` (production) or direct `ts-node` invocation
- Responsibilities: Starts Next.js, initializes all Telegram bots via `initAllBots()` from `nextjs/lib/telegram/bot.ts`, validates `TELEGRAM_ENCRYPTION_KEY`

**Next.js Dev Server:**
- Triggers: `npm run dev`
- Responsibilities: Standard Next.js dev server (does NOT run `server.ts`)

**Middleware:**
- Location: `nextjs/middleware.ts`
- Triggers: Every request matching the route matcher pattern
- Responsibilities: JWT verification, redirect unauthenticated users to login

**Root Layout:**
- Location: `nextjs/app/layout.tsx`
- Triggers: Every page render
- Responsibilities: HTML shell, font loading, `ThemeProvider` wrapper

**Protected Layout:**
- Location: `nextjs/app/(protected)/layout.tsx`
- Triggers: Every protected page render
- Responsibilities: Server-side auth check, fetch user profile, wrap in `ClientSessionProvider` + `AppShell`

## Authentication and Authorization

**Authentication Strategy:** JWT via NextAuth v5

**Two Auth Configs:**
1. `nextjs/auth.config.ts` - Edge-compatible (no Prisma/bcrypt), used by middleware for JWT verification only
2. `nextjs/auth.ts` - Full config with Prisma, bcrypt, Zod validation; used by API routes and server components

**Providers:**
- Credentials (email + bcrypt password) with Zod validation
- Google OAuth 2.0 (auto-creates user on first sign-in)

**Authorization Layers:**
1. **Middleware** (`nextjs/middleware.ts`): Blocks unauthenticated access to non-public routes
2. **Protected Layout** (`nextjs/app/(protected)/layout.tsx`): Server-side `auth()` check with redirect
3. **API Route Guards**: Each API route calls `auth()` and checks `session.user` before processing
4. **Role Checks**: API routes check `session.user.role` or `session.user.currentProjectRole` for admin-only operations
5. **Project Scoping**: API routes filter all queries by `session.user.currentProjectId` to enforce tenant isolation

**Role Hierarchy:**
- `user` - Submit and manage own bills within a project
- `admin` - Manage all bills, members, settings within a project
- `owner` - Same as admin (project creator)
- `superadmin` - Global admin; can access any project without membership; set via `User.isSuperAdmin` flag in DB

## Multi-Tenancy Model

**Isolation Unit:** Project (the `Project` model in `nextjs/prisma/schema.prisma`)

**Membership:** Users belong to projects via `ProjectMember` join table with a `role` field (user/admin/owner)

**Current Project Context:**
- Stored as `User.defaultProjectId` in the database
- Carried in JWT token as `currentProjectId`
- Switched via `POST /api/projects/switch` (updates DB + JWT)
- Every API route reads `session.user.currentProjectId` to scope queries

**Data Isolation:**
- All domain models (Bill, Motive, Category, BudgetMatrix, Vgeld, EditLog, Notification, etc.) have a `projectId` foreign key
- API routes always include `projectId` in their Prisma `where` clauses
- No cross-project data access except for superadmins

**Superadmin Bypass:**
- Superadmins can switch to any project without membership
- When in a project context, superadmins act with `admin` role
- Superadmin status is checked from DB on every JWT refresh (cannot be faked client-side)

## API Route Organization

**Route Groups:**
- `/api/auth/*` - Authentication (signup, login, password reset, email verification, invites, demo login)
- `/api/bills/*` - Bill CRUD, images, comments, OCR, status changes, bulk operations
- `/api/budget-matrix/*` - Budget matrix read and bulk update
- `/api/categories` - Category CRUD for current project
- `/api/motives` - Motive CRUD for current project
- `/api/notifications/*` - Notification list, mark read, mark all read
- `/api/projects/*` - Project CRUD, switch, members, positions, categories, motives, invites, quota
- `/api/reports/*` - Report generation (budget matrix PDF, user reports, user PDFs)
- `/api/spending` - Spending data aggregation
- `/api/vgeld/*` - Vgeld (cash transfer) CRUD, balance, analysis
- `/api/uploads/[[...path]]` - Static file serving for uploaded images
- `/api/users/*` - User profile, password change
- `/api/admin/*` - Admin operations (export to Excel/Google Sheets/images, project management, Telegram config, user management, analytics)
- `/api/superadmin/*` - Superadmin-only operations (system config)
- `/api/analytics/*` - Visit and event tracking (public endpoints)
- `/api/bug-reports/*` - Bug report submission with screenshots
- `/api/health` - Health check endpoint
- `/api/telegram/*` - Telegram link codes, links, status
- `/api/ocr-log` - OCR processing logs
- `/api/project-settings` - Project-level key-value settings

**Common API Route Pattern:**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db as prisma } from '@/lib/db';
import { z } from 'zod';

const schema = z.object({ /* ... */ });

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Validate input with Zod
  // Query Prisma scoped to session.user.currentProjectId
  // Return NextResponse.json()
}
```

## Error Handling

**Strategy:** Try-catch in API routes with JSON error responses

**Patterns:**
- Zod validation errors return 400 with first issue message
- Missing auth returns 401 `{ error: 'Unauthorized' }`
- Insufficient role returns 403
- Not found returns 404
- Rate limit exceeded returns 429
- Catch-all returns 500 with generic message; logs error to console
- Client-side: `fetchWithError()` in `nextjs/lib/api/bills.ts` throws on non-OK responses; hooks catch and set error state

## Cross-Cutting Concerns

**Logging:** `console.log`/`console.error`/`console.warn` throughout; no structured logging framework

**Validation:** Zod schemas in every API route for input validation; schemas defined inline in route files

**Authentication:** NextAuth v5 JWT strategy; `auth()` called at the start of every API route handler

**Rate Limiting:** Upstash Redis-backed (with in-memory fallback) rate limiters defined in `nextjs/lib/ratelimit.ts`; applied per-endpoint in API routes

**File Uploads:** Formidable-based multipart parsing in `nextjs/lib/upload.ts`; files stored on local filesystem at `../data/uploads/`

**Email:** Resend SDK in `nextjs/lib/email.ts`; graceful fallback to console logging when API key not set

**Security Headers:** Configured globally in `nextjs/next.config.mjs` (X-Frame-Options, HSTS, X-Content-Type-Options, Referrer-Policy)

---

*Architecture analysis: 2026-04-01*
