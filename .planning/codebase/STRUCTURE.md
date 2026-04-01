# Codebase Structure

**Analysis Date:** 2026-04-01

## Directory Layout

```
vbudget/
├── nextjs/                        # ALL application code
│   ├── app/                       # Next.js App Router (pages + API routes)
│   │   ├── (protected)/           # Authenticated pages (behind auth guard)
│   │   ├── (public)/              # Public pages (login, signup, password reset)
│   │   ├── api/                   # REST API route handlers
│   │   ├── layout.tsx             # Root layout (HTML shell, fonts, ThemeProvider)
│   │   ├── globals.css            # Global Tailwind CSS styles
│   │   └── page.tsx               # Landing page (/)
│   ├── components/                # React components organized by domain
│   │   ├── analytics/             # Page/event tracking components
│   │   ├── auth/                  # Login form, demo login, sign out
│   │   ├── bills/                 # Bill form, list, filters, images, OCR
│   │   ├── budget/                # Budget matrix table and cells
│   │   ├── cinematic/             # Cinematic/themed UI elements
│   │   ├── dashboard/             # Dashboard KPIs, charts, recent bills
│   │   ├── layout/                # AppShell, Header, Sidebar, ProjectSwitcher
│   │   ├── providers/             # ClientSessionProvider
│   │   ├── reports/               # Reports page, Google Sheets config
│   │   ├── settings/              # Settings tabs, member/motive/category management
│   │   ├── spending/              # Spending table and page
│   │   ├── superadmin/            # Super admin modal, tabs, user/project management
│   │   └── ui/                    # Shared UI primitives (DataTable, Pagination, etc.)
│   ├── lib/                       # Shared utilities, clients, and business logic
│   │   ├── api/                   # Client-side API fetch wrappers
│   │   ├── hooks/                 # Custom React hooks for data fetching
│   │   ├── telegram/              # Telegram bot, encryption, handlers
│   │   ├── types/                 # Additional type definitions
│   │   ├── db.ts                  # Prisma client singleton
│   │   ├── auth.ts                # (not present - auth is at nextjs/auth.ts)
│   │   ├── email.ts               # Resend email client
│   │   ├── google.ts              # Google Sheets/Drive API client
│   │   ├── notifications.ts       # Notification helper functions
│   │   ├── ocr.ts                 # OCR analysis (OpenAI/Gemini/Claude)
│   │   ├── ratelimit.ts           # Rate limiting with Upstash Redis
│   │   ├── upload.ts              # File upload parsing and storage
│   │   ├── types.ts               # Core type definitions (Bill, EditLog, etc.)
│   │   ├── utils.ts               # General utilities
│   │   ├── env.ts                 # Environment variable validation
│   │   ├── analytics.ts           # Analytics helpers
│   │   ├── dashboard.ts           # Dashboard data aggregation
│   │   ├── spending.ts            # Spending data aggregation
│   │   ├── mentions.ts            # @mention parsing for comments
│   │   └── sessionId.ts           # Session ID generation for analytics
│   ├── prisma/                    # Database schema and migrations
│   │   ├── schema.prisma          # Prisma schema (22 models)
│   │   └── migrations/            # Database migration files
│   ├── scripts/                   # Migration/utility scripts
│   │   └── migrate-sqlite-to-pg.ts
│   ├── __tests__/                 # Test files
│   │   ├── api/                   # API route integration tests
│   │   └── lib/                   # Library unit tests
│   ├── public/                    # Static assets (favicon, icons)
│   ├── auth.ts                    # NextAuth v5 full config (Prisma + providers)
│   ├── auth.config.ts             # NextAuth v5 edge config (middleware only)
│   ├── middleware.ts              # Next.js middleware (auth guard)
│   ├── server.ts                  # Custom server (Telegram bot init)
│   ├── next.config.mjs            # Next.js configuration
│   ├── tsconfig.json              # TypeScript configuration
│   ├── jest.config.js             # Jest test configuration
│   ├── jest.setup.ts              # Jest setup file
│   ├── jest.global-setup.js       # Jest global setup
│   ├── package.json               # Dependencies and scripts
│   ├── Dockerfile                 # Production Docker build
│   ├── Dockerfile.test            # Test Docker build
│   └── postcss.config.mjs         # PostCSS config for Tailwind
├── features/                      # Feature specs, bug reports, change requests
│   └── INDEX.md                   # Work item tracking table
├── specification.md               # Living API/architecture documentation
├── CLAUDE.md                      # Claude Code project guide
└── .claude/rules/                 # Claude Code behavior rules
```

## Directory Purposes

**`nextjs/app/(protected)/`:**
- Purpose: All authenticated user-facing pages
- Contains: Server component pages that delegate to client components
- Key files:
  - `layout.tsx`: Auth guard + AppShell wrapper
  - `dashboard/page.tsx`: Main dashboard
  - `bills/page.tsx`: Bill list
  - `bills/new/page.tsx`: New bill form
  - `bills/[id]/page.tsx`: Bill detail/edit
  - `budget/page.tsx`: Budget matrix
  - `reports/page.tsx`: Reports and export
  - `spending/page.tsx`: Spending overview
  - `vgeld/page.tsx`: Cash transfers
  - `settings/page.tsx`: Project settings hub
  - `settings/members/page.tsx`: Member management
  - `settings/categories/page.tsx`: Category management
  - `settings/motives/page.tsx`: Motive management
  - `settings/positions/page.tsx`: Position management
  - `settings/telegram/page.tsx`: Telegram integration settings
  - `settings/ai-analysis/page.tsx`: OCR/AI analysis settings
  - `settings/projects/page.tsx`: Project list/management

**`nextjs/app/(public)/`:**
- Purpose: Unauthenticated pages
- Contains: Login, password reset, email verification, invite acceptance
- Key files:
  - `login/page.tsx`: Login page
  - `forgot-password/page.tsx`: Password reset request
  - `reset-password/page.tsx`: Password reset form
  - `verify-email/page.tsx`: Email verification
  - `accept-invite/page.tsx`: Project invitation acceptance

**`nextjs/app/api/`:**
- Purpose: REST API endpoints
- Contains: Route handler files (`route.ts`) organized by resource
- Key subdirectories: `auth/`, `bills/`, `projects/`, `admin/`, `superadmin/`, `reports/`, `notifications/`, `vgeld/`, `budget-matrix/`, `telegram/`, `analytics/`, `uploads/`

**`nextjs/components/`:**
- Purpose: All React components, organized by feature domain
- Contains: Client components (`'use client'`) with Tailwind CSS styling
- Key subdirectories described below

**`nextjs/components/layout/`:**
- Purpose: App-wide layout components
- Key files:
  - `AppShell.tsx`: Main layout wrapper (sidebar + header + content area)
  - `Header.tsx`: Top navigation bar
  - `Sidebar.tsx`: Side navigation menu
  - `ProjectSwitcher.tsx`: Project selection dropdown
  - `NotificationBell.tsx`: Notification icon with unread count
  - `ProfileModal.tsx`: User profile editor
  - `ThemeProvider.tsx`: Dark/light theme context
  - `ThemeToggle.tsx`: Theme switch button
  - `Logo.tsx`: App logo component
  - `BugReportModal.tsx`: In-app bug reporting

**`nextjs/components/ui/`:**
- Purpose: Shared, reusable UI primitives
- Key files:
  - `DataTable.tsx`: Generic sortable/filterable table
  - `Pagination.tsx`: Pagination controls
  - `ConfirmationDialog.tsx`: Confirm action modal
  - `RoleBadge.tsx`: Role display badge
  - `RoleSelect.tsx`: Role dropdown selector
  - `PositionSelect.tsx`: Position dropdown selector
  - `SetupGuide.tsx`: First-time setup wizard
  - `index.ts`: Barrel export file

**`nextjs/components/bills/`:**
- Purpose: Bill management UI
- Key files:
  - `BillForm.tsx`: Create/edit bill form
  - `BillList.tsx`: Bill listing with filters
  - `BillFilters.tsx`: Filter controls
  - `BillImageUpload.tsx`: Image upload widget
  - `ImageGallery.tsx`: Bill image viewer
  - `AllocationWidget.tsx`: Motive/category percentage allocation
  - `BillStatusBadge.tsx`: Status indicator
  - `BillDetailHeader.tsx`: Bill detail page header
  - `BillHistoryTimeline.tsx`: Edit history display
  - `BillCommentInput.tsx`: Comment input with @mentions
  - `OcrFieldVerification.tsx`: OCR result review UI
  - `CropModal.tsx`: Image crop tool
  - `QuotaBanner.tsx`: Upload quota display

**`nextjs/components/superadmin/`:**
- Purpose: Global admin management UI
- Key files:
  - `SuperAdminModal.tsx`: Main superadmin panel (modal)
  - `ProjectsTab.tsx`: Project management
  - `UsersTab.tsx`: User management
  - `ConfigTab.tsx`: System configuration
  - `AnalyticsTab.tsx`: Analytics dashboard
  - `useSuperAdminApi.ts`: API hooks for superadmin operations
  - `types.ts`: Superadmin-specific types

**`nextjs/lib/`:**
- Purpose: Shared server and client utilities
- Contains: Database client, API wrappers, hooks, service integrations

**`nextjs/lib/api/`:**
- Purpose: Client-side fetch wrappers for API routes
- Key files:
  - `bills.ts`: Bill CRUD operations
  - `members.ts`: Member management operations
  - `settings.ts`: Settings operations
- Pattern: Each exports async functions that call `/api/*` endpoints via `fetchWithError<T>()`

**`nextjs/lib/hooks/`:**
- Purpose: Custom React hooks for data fetching and state management
- Key files:
  - `useBills.ts`: Bill data fetching, filtering, sorting, mutations
  - `useCategories.ts`: Category CRUD
  - `useMembers.ts`: Member management
  - `useMotives.ts`: Motive CRUD
  - `usePositions.ts`: Position CRUD
  - `useProjects.ts`: Project listing

**`nextjs/lib/telegram/`:**
- Purpose: Telegram bot integration
- Key files:
  - `bot.ts`: Bot initialization, polling, message routing
  - `handlers.ts`: Command and message handlers
  - `codes.ts`: Link code generation/validation
  - `encryption.ts`: Bot token encryption at rest

**`nextjs/prisma/`:**
- Purpose: Database schema and migrations
- Key files:
  - `schema.prisma`: All 22 models, enums, indexes, and relations
  - `migrations/`: Ordered migration SQL files

## Key File Locations

**Entry Points:**
- `nextjs/app/layout.tsx`: Root layout (HTML, fonts, ThemeProvider)
- `nextjs/app/(protected)/layout.tsx`: Protected layout (auth guard, AppShell)
- `nextjs/middleware.ts`: Request-level auth middleware
- `nextjs/server.ts`: Custom server entry point (production)

**Configuration:**
- `nextjs/next.config.mjs`: Next.js config (standalone output, security headers, webpack externals)
- `nextjs/tsconfig.json`: TypeScript config (path alias `@/*` maps to `nextjs/*`)
- `nextjs/postcss.config.mjs`: PostCSS/Tailwind config
- `nextjs/jest.config.js`: Jest test runner config
- `nextjs/Dockerfile`: Production Docker image
- `nextjs/Dockerfile.test`: Test Docker image

**Auth:**
- `nextjs/auth.ts`: Full NextAuth v5 config (providers, JWT/session callbacks, type augmentation)
- `nextjs/auth.config.ts`: Edge-compatible auth config (middleware only)

**Core Logic:**
- `nextjs/lib/db.ts`: Prisma client singleton (exported as both `db` and `prisma`)
- `nextjs/lib/upload.ts`: Multipart form parsing, file storage
- `nextjs/lib/ocr.ts`: OCR analysis with AI providers
- `nextjs/lib/notifications.ts`: Notification creation helpers
- `nextjs/lib/email.ts`: Email sending via Resend
- `nextjs/lib/google.ts`: Google Sheets/Drive API integration
- `nextjs/lib/ratelimit.ts`: Rate limiter definitions and factory
- `nextjs/lib/types.ts`: Shared TypeScript interfaces (Bill, EditLog, Motive, Category, etc.)

**Testing:**
- `nextjs/__tests__/api/`: API route integration tests
- `nextjs/__tests__/lib/`: Library unit tests

## Naming Conventions

**Files:**
- Pages: `page.tsx` (Next.js App Router convention)
- Layouts: `layout.tsx`
- API routes: `route.ts`
- Components: `PascalCase.tsx` (e.g., `BillForm.tsx`, `AppShell.tsx`)
- Hooks: `camelCase.ts` prefixed with `use` (e.g., `useBills.ts`)
- Libraries: `camelCase.ts` (e.g., `notifications.ts`, `ratelimit.ts`)
- Types: `types.ts` within their directory
- Tests: `*.test.ts` in `__tests__/` directory (mirrors source structure)

**Directories:**
- Route groups: `(parenthesized)` for Next.js route groups (`(protected)`, `(public)`)
- Dynamic segments: `[param]` or `[...param]` for catch-all
- Feature domains: lowercase (`bills/`, `budget/`, `settings/`)
- Component domains: lowercase matching feature area

## Where to Add New Code

**New Protected Page:**
- Create directory: `nextjs/app/(protected)/your-page/`
- Add file: `nextjs/app/(protected)/your-page/page.tsx`
- The protected layout automatically wraps it with auth guard and AppShell

**New Public Page:**
- Create directory: `nextjs/app/(public)/your-page/`
- Add file: `nextjs/app/(public)/your-page/page.tsx`
- Add the path to the `isPublicRoute` list in `nextjs/middleware.ts`

**New API Route:**
- Create directory: `nextjs/app/api/your-resource/`
- Add file: `nextjs/app/api/your-resource/route.ts`
- Export named functions: `GET`, `POST`, `PUT`, `DELETE`, `PATCH`
- Always start with `const session = await auth()` and check authentication
- Always scope queries by `session.user.currentProjectId`
- Validate input with Zod

**New Component:**
- If domain-specific: `nextjs/components/{domain}/YourComponent.tsx`
- If reusable UI primitive: `nextjs/components/ui/YourComponent.tsx` and add to `nextjs/components/ui/index.ts`
- Use `'use client'` directive for interactive components

**New Custom Hook:**
- Add file: `nextjs/lib/hooks/useYourHook.ts`
- Follow pattern: useState + useEffect + useCallback, call API client functions

**New API Client Function:**
- Add to existing file in `nextjs/lib/api/` or create new file
- Use `fetchWithError<T>()` pattern for consistent error handling

**New Utility/Service:**
- Add file: `nextjs/lib/your-utility.ts`
- Server-only code can import Prisma; client code must not

**New Database Model:**
- Edit `nextjs/prisma/schema.prisma`
- Run `npx prisma migrate dev` from `nextjs/`
- Add corresponding types to `nextjs/lib/types.ts` if needed

**New Test:**
- API test: `nextjs/__tests__/api/your-route.test.ts`
- Library test: `nextjs/__tests__/lib/your-lib.test.ts`

## Special Directories

**`nextjs/.next/`:**
- Purpose: Next.js build output
- Generated: Yes
- Committed: No (in `.gitignore`)

**`nextjs/node_modules/`:**
- Purpose: npm dependencies
- Generated: Yes
- Committed: No

**`nextjs/prisma/migrations/`:**
- Purpose: Database migration history
- Generated: By `prisma migrate dev`
- Committed: Yes (required for deployment)

**`nextjs/public/`:**
- Purpose: Static assets served at root URL
- Generated: No
- Committed: Yes

**`nextjs/dist/`:**
- Purpose: Compiled custom server output
- Generated: Yes (TypeScript compilation of `server.ts`)
- Committed: Appears to be committed

**`features/`:**
- Purpose: Feature specs, bug reports, change request tracking
- Generated: No
- Committed: Yes

---

*Structure analysis: 2026-04-01*
