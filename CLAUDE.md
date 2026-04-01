# SetCash — Claude Code Guide

## Project Overview

**SetCash** is a multi-tenant expense tracking and budget management web application built with Next.js, PostgreSQL, and Prisma.

> **All application code lives in the `nextjs/` subdirectory.** Do not look for or modify code at the repo root — the Express/vanilla JS legacy app has been removed.

## Tech Stack

- **Runtime:** Node.js (20+ recommended)
- **Framework:** Next.js 14 (App Router)
- **Database:** PostgreSQL via Prisma ORM
- **Frontend:** React + Tailwind CSS
- **Auth:** NextAuth.js (email/password + Google OAuth 2.0)
- **Integrations:** Google Sheets API, Google Drive API, Telegram Bot API
- **File generation:** PDFKit (PDF), ExcelJS (Excel)

## Project Structure

```
setcash/
├── nextjs/                    # ← ALL application code is here
│   ├── app/                   # Next.js App Router pages and API routes
│   │   ├── (protected)/       # Authenticated pages (budget, bills, etc.)
│   │   ├── api/               # API route handlers
│   │   └── ...
│   ├── components/            # React components
│   │   ├── budget/            # Budget matrix components
│   │   ├── bills/             # Bills components
│   │   ├── layout/            # AppShell, Header, Sidebar
│   │   └── ...
│   ├── lib/                   # Shared utilities and DB client
│   ├── prisma/                # Prisma schema and migrations
│   ├── scripts/               # Migration and seed scripts
│   ├── auth.ts                # NextAuth config
│   ├── middleware.ts           # Next.js middleware (auth guards)
│   ├── server.ts              # Custom Express-like server wrapper
│   ├── Dockerfile
│   └── package.json
├── features/                  # Feature specs and bug reports
├── specification.md           # Living architecture/API documentation
└── CLAUDE.md                  # This file
```

## Running the Application

```bash
cd nextjs
npm install
npm run dev        # Dev server on port 3000
npm run build && npm start   # Production
```

**With Docker:**
```bash
cd nextjs
docker build -t setcash .
docker run -p 3000:3000 setcash
```

## Environment Variables

All env vars go in `nextjs/.env.local`:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Secret for NextAuth session signing |
| `NEXTAUTH_URL` | Full URL of the app (e.g. `http://localhost:3000`) |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 client secret |
| `TARGET_SHEET_ID` | Google Sheets spreadsheet ID |
| `GOOGLE_DRIVE_FOLDER_ID` | Google Drive folder ID for uploads |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token (optional) |
| `OCR_ENCRYPTION_SECRET` | Secret for encrypting OCR API keys |

A `nextjs/data/google-credentials.json` service account file is required for Google integrations.

## Key Architecture Notes

- **App Router:** Pages in `nextjs/app/(protected)/`; API routes in `nextjs/app/api/`
- **Auth:** NextAuth.js in `nextjs/auth.ts`; session guards in `nextjs/middleware.ts`
- **Database:** Prisma client in `nextjs/lib/db.ts`; schema in `nextjs/prisma/schema.prisma`
- **Multi-tenant:** Projects are isolated; users belong to projects with roles (`user`, `admin`)
- **Super-admin:** A global super-admin role exists above project admins
- **Bill tracking:** Users submit expense bills with images; admins approve/process them
- **Google Sheets sync:** Bills can be exported/synced to Google Sheets
- **Roles:** `user` → submit bills; `admin` → manage project bills; `superadmin` → manage all projects and users

## Common Development Tasks

- **Add an API route:** Create a file under `nextjs/app/api/your-route/route.ts`
- **Add a page:** Create a folder under `nextjs/app/(protected)/your-page/page.tsx`
- **Modify the database schema:** Edit `nextjs/prisma/schema.prisma`, then run `npx prisma migrate dev`
- **Add a component:** Create under `nextjs/components/` in the appropriate subdomain folder
- **Refer to API docs:** See `specification.md` for the full list of API endpoints and data models

## Linting & Testing

```bash
cd nextjs
npm run lint       # ESLint
npm run test       # Jest (integration tests with real DB)
```

<!-- GSD:project-start source:PROJECT.md -->
## Project

**SetCash — Hardening Milestone**

SetCash is a multi-tenant expense tracking and budget management app built with Next.js 14, PostgreSQL/Prisma, and NextAuth. Users submit expense bills with images; admins approve and process them; budgets are managed via a matrix view. Google Sheets sync, Telegram notifications, and PDF/Excel exports round out the feature set.

**Core Value:** Every bill submission, approval, and budget calculation must be **correct, secure, and reliable** — financial data tolerates zero silent failures.

### Constraints

- **Tech stack**: No framework changes — Next.js 14, Prisma, PostgreSQL stay as-is
- **Backwards compatibility**: No breaking changes to existing API contracts or data models
- **Data safety**: Legacy column removal requires migration with verification that no external system reads them
- **Testing**: Integration tests use real database (per project convention), not mocks
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript 5.6+ - All application code (`nextjs/**/*.ts`, `nextjs/**/*.tsx`)
- SQL - Prisma migrations in `nextjs/prisma/migrations/`
- CSS - Tailwind CSS v4 utility classes
## Runtime
- Node.js 20+ (Alpine-based in Docker, see `nextjs/Dockerfile` line 1: `node:20-alpine`)
- Target: ES2017 (`nextjs/tsconfig.json` compilerOptions.target)
- npm (lockfile: `nextjs/package-lock.json`)
## Frameworks
- Next.js 14.2.35 - App Router, standalone output mode (`nextjs/next.config.mjs`)
- React 18.3.1 - UI library
- React DOM 18.3.1
- NextAuth.js v5 (beta 30) - JWT strategy, Credentials + Google OAuth providers (`nextjs/auth.ts`)
- Edge-compatible auth config for middleware (`nextjs/auth.config.ts`)
- Prisma 5.22+ - PostgreSQL client with `@prisma/client` (`nextjs/prisma/schema.prisma`)
- Jest 29.7 - Test runner (`nextjs/jest.config.js`)
- ts-jest 29.4.6 - TypeScript transform for Jest
- tsx 4.19.2 - TypeScript execution for dev server and scripts
- TypeScript 5.6.3 - Compiler
- Tailwind CSS v4 with `@tailwindcss/postcss` - PostCSS plugin (`nextjs/postcss.config.mjs`)
## Key Dependencies
- `next` 14.2.35 - Web framework, App Router
- `@prisma/client` 5.22+ - Database ORM
- `next-auth` 5.0.0-beta.30 - Authentication (JWT, Credentials, Google OAuth)
- `zod` 4.3.6 - Input validation (all API routes)
- `bcryptjs` 3.0.3 - Password hashing (`nextjs/auth.ts`)
- `googleapis` 171.4.0 - Google Sheets API for bill export (`nextjs/lib/google.ts`)
- `node-telegram-bot-api` 0.67.0 - Telegram bot polling per project (`nextjs/lib/telegram/bot.ts`)
- `resend` 6.9.3 - Transactional email delivery (`nextjs/lib/email.ts`)
- `@upstash/ratelimit` 2.0.8 + `@upstash/redis` 1.36.3 - Rate limiting with Redis backend (`nextjs/lib/ratelimit.ts`)
- `pdfkit` 0.17.2 - PDF report generation (externalized in webpack, `nextjs/next.config.mjs`)
- `exceljs` 4.4.0 - Excel spreadsheet export
- `archiver` 7.0.1 - ZIP archive creation for image exports
- `lucide-react` 0.477.0 - Icon library
- `recharts` 3.8.0 - Charts and data visualization
- `sonner` 2.0.7 - Toast notifications
- `cropperjs` 2.1.0 - Image cropping for bill photos
- `formidable` 3.5.4 - Multipart form-data parsing (`nextjs/lib/upload.ts`)
- `date-fns` 4.1.0 - Date formatting and manipulation
- `better-sqlite3` 11.8.1 - SQLite driver (legacy migration script `nextjs/scripts/migrate-sqlite-to-pg.ts`)
- `uuid` 11.0.5 - UUID generation in scripts/tests
## Database
- Connection: `DATABASE_URL` env var
- ORM: Prisma with `prisma-client-js` generator
- Binary targets: `native` + `linux-musl-openssl-3.0.x` (for Alpine Docker)
- Schema: `nextjs/prisma/schema.prisma` (25 models)
- Migrations: `nextjs/prisma/migrations/` (managed via `prisma migrate dev` / `prisma migrate deploy`)
- Seed script: `nextjs/prisma/seed.ts` (compiled to JS for production)
## Configuration
- Config: `nextjs/tsconfig.json`
- Strict mode enabled
- Path alias: `@/*` maps to `nextjs/*`
- Module resolution: bundler
- Config: `nextjs/next.config.mjs`
- Output: `standalone` (optimized for Docker)
- Server external packages: `pdfkit`, `fontkit`
- Security headers: X-Frame-Options DENY, HSTS, nosniff, Referrer-Policy
- Git commit hash exposed as `NEXT_PUBLIC_GIT_COMMIT`
- Config: `nextjs/postcss.config.mjs`
- Plugin: `@tailwindcss/postcss` (Tailwind v4)
- Required vars validated at startup in `nextjs/lib/env.ts`: `DATABASE_URL`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- Local dev: `nextjs/.env.local` (gitignored)
- Test: `nextjs/.env.test`
- Example files: `nextjs/.env.local.example`, `nextjs/.env.test.example`
## Build & Deployment
- Multi-stage Dockerfile: `nextjs/Dockerfile`
- Stage 1 (deps): `npm ci`
- Stage 2 (builder): Prisma generate, Next.js build, compile server + seed via tsc
- Stage 3 (runner): Alpine, non-root user `nextjs:nodejs`, port 3001
- Startup: `prisma migrate deploy && node prisma/seed.js && node server.js`
- Health check: `GET /api/health` every 30s
- `nextjs/server.ts` wraps Next.js with `http.createServer`
- Initializes all Telegram bots at startup via `initAllBots()`
- Validates `TELEGRAM_ENCRYPTION_KEY` at startup (hard fail in production)
## Platform Requirements
- Node.js 20+
- PostgreSQL database
- npm
- Docker (node:20-alpine based)
- PostgreSQL
- Upstash Redis (optional, falls back to in-memory rate limiting)
- Port 3001 (configurable via PORT env var)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- React components: PascalCase (`BillForm.tsx`, `DataTable.tsx`, `AppShell.tsx`)
- Utility/library modules: camelCase (`utils.ts`, `ratelimit.ts`, `notifications.ts`)
- API route handlers: `route.ts` inside directory named for the resource (`app/api/bills/route.ts`)
- Custom hooks: `use` prefix, camelCase (`useBills.ts`, `useCategories.ts`)
- Type definition files: camelCase (`types.ts`, `types/settings.ts`)
- camelCase for all functions: `formatCurrency`, `calculateBillNumber`, `fetchWithError`
- Event handlers: `handle` prefix (`handleMenuToggle`, `handleMenuClose`)
- Boolean variables: `is` prefix (`isAuthenticated`, `isPublicRoute`)
- Async data fetchers: verb-noun pattern (`getBills`, `deleteBill`)
- camelCase for local variables and state
- UPPER_SNAKE_CASE for constants: `BILLS_PER_PAGE`, `API_BASE`, `UPLOADS_DIR`
- CSS custom properties: `--vb-` prefix for design tokens
- PascalCase: `Bill`, `BillStatus`, `FilterState`, `TestContext`
- Props interfaces: `{ComponentName}Props` pattern
- Use `interface` for object shapes, `type` for unions/aliases
## Code Style
- No Prettier config -- ESLint + editor defaults
- 2-space indentation
- Single quotes for strings
- Trailing commas in multi-line structures
- Semicolons required
- ESLint via `next lint` (Next.js built-in config)
- No custom `.eslintrc` file
- Run: `cd nextjs && npm run lint`
- Server-side utility files use section-comment banners:
- `strict: true` in `nextjs/tsconfig.json`
- Type assertions used sparingly, primarily for NextAuth session types (`as never`)
- Zod schemas provide runtime validation alongside TypeScript types
## Import Organization
- `@/*` maps to `nextjs/*` (configured in `nextjs/tsconfig.json` and `nextjs/jest.config.js`)
- Always use `@/` for imports; never use relative `../` except in `nextjs/middleware.ts`
## Component Patterns
- Client components: `'use client'` directive at top of file
- Pages in `app/(protected)/` are typically client components with hook-based data fetching
- Layouts (`app/(protected)/layout.tsx`) are server components that fetch session data
- Protected layout wraps children with `ClientSessionProvider` for client-side session access
- Default exports for components (not named exports)
- Props destructured in function signature with default values
- `cn()` utility from `@/lib/utils` for conditional class merging
- `dynamic()` import for heavy/optional components with `{ ssr: false }`
- UI barrel file at `nextjs/components/ui/index.ts` re-exports shared primitives
- No global state library (no Redux, Zustand, Jotai)
- Custom hooks in `nextjs/lib/hooks/` encapsulate data fetching + local state
- Hooks use `useState` + `useCallback` + `useEffect` for async data
- Session: `useSession()` on client, `auth()` on server
## API Route Patterns
- Always wrap entire handler in try/catch
- Auth check first, project context second, membership third
- Superadmin bypasses membership checks
- Zod validation for request bodies
- Return `{ error: 'message' }` for errors
- Rate limiting via `@/lib/ratelimit` limiters
- Import DB as: `import { db as prisma } from '@/lib/db'`
## Error Handling
- Top-level try/catch in every route handler
- `console.error('Context:', error)` for logging
- Generic 500 response to client; specific codes for validation/auth errors
- Hooks track `error` as `string | null`
- `fetchWithError<T>()` in `nextjs/lib/api/bills.ts` throws on non-OK responses
- `finally` blocks always reset loading state
- Background ops use `.catch(() => [])` (see `nextjs/lib/notifications.ts`)
## Logging
- API errors: `console.error('Error fetching X:', error)`
- Parse warnings: `console.warn('Failed to parse X:', e)`
## CSS / Styling
- Utility-first Tailwind classes in JSX
- CSS custom properties in `nextjs/app/globals.css` with `--vb-` prefix
- Dark mode via `[data-theme="dark"]` selector
- `cn()` for conditional classes
- No CSS Modules or styled-components
## Client API Layer
- One file per domain: `nextjs/lib/api/bills.ts`, `nextjs/lib/api/members.ts`, `nextjs/lib/api/settings.ts`
- Hooks in `nextjs/lib/hooks/` consume these functions
## Database Access
- Prisma singleton via `nextjs/lib/db.ts` (hot-reload safe)
- Import as `import { db as prisma } from '@/lib/db'`
- Schema: `nextjs/prisma/schema.prisma`
- Transactions for concurrency: `prisma.$transaction(async (tx) => { ... })`
- Convert `Decimal` to `Number()` in API responses
## Environment Validation
- `nextjs/lib/env.ts` validates required vars at startup
- Called from `nextjs/lib/db.ts` before Prisma connects
## Security Headers
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- Server-rendered pages with client-side interactivity (React Server Components + "use client" components)
- JWT session strategy (no database sessions) via NextAuth v5
- Project-scoped multi-tenancy with role-based access control
- Separate Edge-compatible auth config for middleware (`nextjs/auth.config.ts`) and full auth config with Prisma for API routes (`nextjs/auth.ts`)
- Custom HTTP server wrapping Next.js to support long-running Telegram bot processes (`nextjs/server.ts`)
## Layers
- Purpose: Authentication gate for all non-public routes
- Location: `nextjs/middleware.ts`
- Contains: JWT verification only (no DB access)
- Depends on: `nextjs/auth.config.ts` (edge-compatible NextAuth config)
- Used by: Every incoming request matching the route matcher
- Purpose: Server-side rendered page shells that fetch initial data and enforce auth
- Location: `nextjs/app/(protected)/` and `nextjs/app/(public)/`
- Contains: Server components that call `auth()` and pass data to client components
- Depends on: `nextjs/auth.ts`, `nextjs/lib/db.ts`
- Used by: Browser navigation
- Purpose: Interactive UI with state management, API calls, and user interactions
- Location: `nextjs/components/`
- Contains: React components using hooks from `nextjs/lib/hooks/`
- Depends on: `nextjs/lib/api/` (fetch wrappers), `nextjs/lib/types.ts`
- Used by: Page components
- Purpose: REST endpoints handling CRUD operations, file uploads, exports
- Location: `nextjs/app/api/`
- Contains: Route handlers exporting GET/POST/PUT/DELETE/PATCH functions
- Depends on: `nextjs/auth.ts`, `nextjs/lib/db.ts`, `nextjs/lib/*.ts` utilities
- Used by: Client components via fetch, external integrations (Telegram webhook)
- Purpose: Business logic, database access, external service clients, utilities
- Location: `nextjs/lib/`
- Contains: DB client, API client wrappers, hooks, notification helpers, OCR, email, Google APIs, Telegram bot, rate limiting, file upload
- Depends on: Prisma, external SDKs
- Used by: API routes and server components
- Purpose: PostgreSQL data access layer
- Location: Schema at `nextjs/prisma/schema.prisma`, client at `nextjs/lib/db.ts`
- Contains: 22 models covering users, projects, bills, budget matrix, notifications, analytics
- Depends on: PostgreSQL via `DATABASE_URL`
- Used by: All API routes and server components
## Data Flow
- Server state: JWT token contains `currentProjectId`, `currentProjectRole`, `currentProjectName`, `isExampleProject`, `isDemoAccount`
- Client state: React `useState` hooks in custom hooks (`nextjs/lib/hooks/`); no global state library
- Session state: NextAuth `useSession()` via `ClientSessionProvider` (`nextjs/components/providers/ClientSessionProvider.tsx`)
- The JWT is refreshed on every request via the `jwt` callback, which re-fetches project details from DB when the default project changes
## Key Abstractions
- Purpose: Carries user identity and current project context across requests
- Defined in: `nextjs/auth.ts` (type augmentation for `Session` and `JWT`)
- Key fields: `id`, `email`, `role`, `currentProjectId`, `currentProjectRole`, `currentProjectName`, `isExampleProject`, `isDemoAccount`
- Pattern: Enriched on sign-in, re-validated on every request, updated on project switch
- Purpose: Type-safe fetch wrappers for client components to call API routes
- Examples: `nextjs/lib/api/bills.ts`, `nextjs/lib/api/members.ts`, `nextjs/lib/api/settings.ts`
- Pattern: Each function wraps `fetch()` with error handling via `fetchWithError<T>()`
- Purpose: Encapsulate data fetching, state, and mutations for specific domains
- Examples: `nextjs/lib/hooks/useBills.ts`, `nextjs/lib/hooks/useCategories.ts`, `nextjs/lib/hooks/useMembers.ts`, `nextjs/lib/hooks/useMotives.ts`, `nextjs/lib/hooks/usePositions.ts`, `nextjs/lib/hooks/useProjects.ts`
- Pattern: `useState` + `useEffect` + `useCallback`; call API client functions; return data/loading/error/mutate interface
- Purpose: Protect endpoints from abuse
- Defined in: `nextjs/lib/ratelimit.ts`
- Pattern: Named rate limit configs (e.g., `billCreate: { max: 10, window: '1 m' }`); uses Upstash Redis when available, falls back to in-memory
## Entry Points
- Location: `nextjs/server.ts`
- Triggers: `npm start` (production) or direct `ts-node` invocation
- Responsibilities: Starts Next.js, initializes all Telegram bots via `initAllBots()` from `nextjs/lib/telegram/bot.ts`, validates `TELEGRAM_ENCRYPTION_KEY`
- Triggers: `npm run dev`
- Responsibilities: Standard Next.js dev server (does NOT run `server.ts`)
- Location: `nextjs/middleware.ts`
- Triggers: Every request matching the route matcher pattern
- Responsibilities: JWT verification, redirect unauthenticated users to login
- Location: `nextjs/app/layout.tsx`
- Triggers: Every page render
- Responsibilities: HTML shell, font loading, `ThemeProvider` wrapper
- Location: `nextjs/app/(protected)/layout.tsx`
- Triggers: Every protected page render
- Responsibilities: Server-side auth check, fetch user profile, wrap in `ClientSessionProvider` + `AppShell`
## Authentication and Authorization
- Credentials (email + bcrypt password) with Zod validation
- Google OAuth 2.0 (auto-creates user on first sign-in)
- `user` - Submit and manage own bills within a project
- `admin` - Manage all bills, members, settings within a project
- `owner` - Same as admin (project creator)
- `superadmin` - Global admin; can access any project without membership; set via `User.isSuperAdmin` flag in DB
## Multi-Tenancy Model
- Stored as `User.defaultProjectId` in the database
- Carried in JWT token as `currentProjectId`
- Switched via `POST /api/projects/switch` (updates DB + JWT)
- Every API route reads `session.user.currentProjectId` to scope queries
- All domain models (Bill, Motive, Category, BudgetMatrix, Vgeld, EditLog, Notification, etc.) have a `projectId` foreign key
- API routes always include `projectId` in their Prisma `where` clauses
- No cross-project data access except for superadmins
- Superadmins can switch to any project without membership
- When in a project context, superadmins act with `admin` role
- Superadmin status is checked from DB on every JWT refresh (cannot be faked client-side)
## API Route Organization
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
```typescript
```
## Error Handling
- Zod validation errors return 400 with first issue message
- Missing auth returns 401 `{ error: 'Unauthorized' }`
- Insufficient role returns 403
- Not found returns 404
- Rate limit exceeded returns 429
- Catch-all returns 500 with generic message; logs error to console
- Client-side: `fetchWithError()` in `nextjs/lib/api/bills.ts` throws on non-OK responses; hooks catch and set error state
## Cross-Cutting Concerns
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
