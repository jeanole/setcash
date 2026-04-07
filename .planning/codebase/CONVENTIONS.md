# Coding Conventions

**Analysis Date:** 2026-04-01

## Naming Patterns

**Files:**
- React components: PascalCase (`BillForm.tsx`, `DataTable.tsx`, `AppShell.tsx`)
- Utility/library modules: camelCase (`utils.ts`, `ratelimit.ts`, `notifications.ts`)
- API route handlers: `route.ts` inside directory named for the resource (`app/api/bills/route.ts`)
- Custom hooks: `use` prefix, camelCase (`useBills.ts`, `useCategories.ts`)
- Type definition files: camelCase (`types.ts`, `types/settings.ts`)

**Functions:**
- camelCase for all functions: `formatCurrency`, `calculateBillNumber`, `fetchWithError`
- Event handlers: `handle` prefix (`handleMenuToggle`, `handleMenuClose`)
- Boolean variables: `is` prefix (`isAuthenticated`, `isPublicRoute`)
- Async data fetchers: verb-noun pattern (`getBills`, `deleteBill`)

**Variables:**
- camelCase for local variables and state
- UPPER_SNAKE_CASE for constants: `BILLS_PER_PAGE`, `API_BASE`, `UPLOADS_DIR`
- CSS custom properties: `--vb-` prefix for design tokens

**Types/Interfaces:**
- PascalCase: `Bill`, `BillStatus`, `FilterState`, `TestContext`
- Props interfaces: `{ComponentName}Props` pattern
- Use `interface` for object shapes, `type` for unions/aliases

## Code Style

**Formatting:**
- No Prettier config -- ESLint + editor defaults
- 2-space indentation
- Single quotes for strings
- Trailing commas in multi-line structures
- Semicolons required

**Linting:**
- ESLint via `next lint` (Next.js built-in config)
- No custom `.eslintrc` file
- Run: `cd nextjs && npm run lint`

**File Headers:**
- Server-side utility files use section-comment banners:
```typescript
// ============================================================================
// Bills API - GET / POST
// ============================================================================
```

**TypeScript Strictness:**
- `strict: true` in `nextjs/tsconfig.json`
- Type assertions used sparingly, primarily for NextAuth session types (`as never`)
- Zod schemas provide runtime validation alongside TypeScript types

## Import Organization

**Order:**
1. React/Next.js framework imports (`react`, `next/navigation`, `next/server`)
2. Third-party libraries (`zod`, `bcryptjs`, `next-auth`)
3. Internal `@/` aliased imports:
   - Auth (`@/auth`)
   - Lib/utilities (`@/lib/db`, `@/lib/utils`, `@/lib/types`)
   - Components (`@/components/...`)

**Path Aliases:**
- `@/*` maps to `nextjs/*` (configured in `nextjs/tsconfig.json` and `nextjs/jest.config.js`)
- Always use `@/` for imports; never use relative `../` except in `nextjs/middleware.ts`

**Example:**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { db as prisma } from '@/lib/db';
import { billCreateLimiter } from '@/lib/ratelimit';
```

## Component Patterns

**Client vs Server Components:**
- Client components: `'use client'` directive at top of file
- Pages in `app/(protected)/` are typically client components with hook-based data fetching
- Layouts (`app/(protected)/layout.tsx`) are server components that fetch session data
- Protected layout wraps children with `ClientSessionProvider` for client-side session access

**Component Structure:**
```typescript
'use client';

import { useState } from 'react';
import { SomeType } from '@/lib/types';
import { cn } from '@/lib/utils';

interface MyComponentProps {
  data: SomeType;
  isLoading?: boolean;
  onAction: (id: string) => void;
}

export default function MyComponent({ data, isLoading = false, onAction }: MyComponentProps) {
  const [state, setState] = useState<string>('');
  const handleClick = () => { /* ... */ };

  return (
    <div className="...tailwind classes...">
      {/* JSX */}
    </div>
  );
}
```

**Key patterns:**
- Default exports for components (not named exports)
- Props destructured in function signature with default values
- `cn()` utility from `@/lib/utils` for conditional class merging
- `dynamic()` import for heavy/optional components with `{ ssr: false }`
- UI barrel file at `nextjs/components/ui/index.ts` re-exports shared primitives

**State Management:**
- No global state library (no Redux, Zustand, Jotai)
- Custom hooks in `nextjs/lib/hooks/` encapsulate data fetching + local state
- Hooks use `useState` + `useCallback` + `useEffect` for async data
- Session: `useSession()` on client, `auth()` on server

## API Route Patterns

**Standard structure for every API route:**
```typescript
export async function GET(req: NextRequest) {
  try {
    // 1. Authenticate
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Validate project context
    const projectId = session.user.currentProjectId;
    if (!projectId) {
      return NextResponse.json({ error: 'No project selected' }, { status: 400 });
    }

    // 3. Verify project membership (unless superadmin)
    const membership = await prisma.projectMember.findUnique({
      where: {
        projectId_userEmail: { projectId, userEmail: session.user.email },
      },
    });
    if (!membership && session.user.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 4. Validate input with Zod (POST/PUT)
    // 5. Execute business logic
    // 6. Return JSON response
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error description:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

**Conventions:**
- Always wrap entire handler in try/catch
- Auth check first, project context second, membership third
- Superadmin bypasses membership checks
- Zod validation for request bodies
- Return `{ error: 'message' }` for errors
- Rate limiting via `@/lib/ratelimit` limiters
- Import DB as: `import { db as prisma } from '@/lib/db'`

## Error Handling

**API Routes:**
- Top-level try/catch in every route handler
- `console.error('Context:', error)` for logging
- Generic 500 response to client; specific codes for validation/auth errors

**Client-Side:**
- Hooks track `error` as `string | null`
- `fetchWithError<T>()` in `nextjs/lib/api/bills.ts` throws on non-OK responses
- `finally` blocks always reset loading state

**Fire-and-Forget:**
- Background ops use `.catch(() => [])` (see `nextjs/lib/notifications.ts`)

## Logging

**Framework:** `console.error` / `console.warn` (no structured logging library)
- API errors: `console.error('Error fetching X:', error)`
- Parse warnings: `console.warn('Failed to parse X:', e)`

## CSS / Styling

**Framework:** Tailwind CSS v4 via `@tailwindcss/postcss`

**Approach:**
- Utility-first Tailwind classes in JSX
- CSS custom properties in `nextjs/app/globals.css` with `--vb-` prefix
- Dark mode via `[data-theme="dark"]` selector
- `cn()` for conditional classes
- No CSS Modules or styled-components

**Design Tokens:** `--vb-sidebar-*`, `--vb-content-*`, `--vb-card-*`, `--vb-text-*`, `--vb-accent*`

**Icons:** `lucide-react`

**Fonts:** Google Fonts in root layout (Inter, DM Mono, Bricolage Grotesque, Space Grotesk, JetBrains Mono, Kanit)

## Client API Layer

Thin client functions in `nextjs/lib/api/`:
```typescript
async function fetchWithError<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  return response.json();
}
```
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

In `nextjs/next.config.mjs`: X-Frame-Options DENY, X-Content-Type-Options nosniff, HSTS, Referrer-Policy

---

*Convention analysis: 2026-04-01*
