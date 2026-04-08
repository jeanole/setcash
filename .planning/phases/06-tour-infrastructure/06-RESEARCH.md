# Phase 6: Tour Infrastructure - Research

**Researched:** 2026-04-08
**Domain:** Database migration, JWT session augmentation, React context, TypeScript configuration
**Confidence:** HIGH

## Summary

Phase 6 is a plumbing phase with no visible UI. It adds a `hasSeenTour` boolean to the User model, exposes it through the JWT/session pipeline, creates a single API endpoint to mark the tour complete, builds a React context provider for tour state management, and defines all 6 tour steps in a centralized config file.

Every pattern needed already exists in the codebase. The `isDemoAccount` field is the exact template for `hasSeenTour` (same type, same flow through auth.ts and auth.config.ts). The `ClientSessionProvider` is the template for TourProvider mounting. The `users/me` route is the template for the completion endpoint. No new libraries are needed.

**Primary recommendation:** Follow existing codebase patterns exactly. This phase requires zero new dependencies and zero architectural decisions -- every implementation detail maps to an existing pattern.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Add a `hasSeenTour` Boolean column (default `false`) to the existing `User` model in Prisma schema. Single migration, mirrors the `isDemoAccount` pattern.
- **D-02:** Add `hasSeenTour` to the JWT/session type augmentation in `auth.ts`, following the same pattern as `isDemoAccount`. Available on client via `useSession()` without extra API calls.
- **D-03:** Demo/test users bypass the flag -- TourProvider checks `isDemoAccount` from session and shows the tour regardless of `hasSeenTour` value. The flag is still written on completion but ignored on read for demo users.
- **D-04:** All 6 tour steps defined in a single TypeScript file (e.g., `lib/tour/steps.ts`). One array of step objects. Adding or reordering a step requires editing only this file (per INFRA-04).
- **D-05:** Each step has: `targetSelector` (CSS string), `title` (string), `body` (string), `placement` ('top' | 'bottom' | 'left' | 'right'). Minimal shape -- no page route, no media fields.
- **D-06:** Type safety via a `TourStep` TypeScript interface and a typed `TOUR_STEPS` array with `as const`. Step IDs derived from array index or explicit string ID field.
- **D-07:** Minimal context API surface: `isActive`, `currentStep`, `stepCount`, `next()`, `back()`, `skip()`, `complete()`. No step metadata on context -- consumers import steps config separately if needed.
- **D-08:** TourProvider mounted inside the protected layout (`app/(protected)/layout.tsx`), wrapping AppShell children. Same mounting pattern as `ClientSessionProvider`.
- **D-09:** Initial state loaded from `useSession()` -- reads `hasSeenTour` and `isDemoAccount` from the JWT. No extra API call on mount.
- **D-10:** `POST /api/tour/complete` -- no request body needed. Sets `hasSeenTour = true` for the authenticated user. Returns `{ success: true }`. Idempotent. Standard auth-first, try/catch pattern.
- **D-11:** No separate GET endpoint for tour state. TourProvider relies entirely on the JWT session data.
- **D-12:** No forced JWT refresh after POST. TourProvider sets its own `isActive = false` locally after successful completion. JWT catches up on next natural session refresh/page load.

### Claude's Discretion
- Rate limiting strategy for the tour completion endpoint (likely light -- single fire-and-forget call)
- Exact file placement within `lib/tour/` directory structure
- Whether step IDs use array index or explicit string identifiers

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFRA-01 | User's tour completion state is persisted in the database (hasSeenTour boolean) | D-01: Add `hasSeenTour` Boolean to User model; mirrors `isDemoAccount` pattern in schema.prisma line 48 |
| INFRA-02 | User can mark tour as completed via API endpoint | D-10: `POST /api/tour/complete`, follows `users/me` route pattern with `getCurrentUser()` auth check |
| INFRA-03 | Tour state is managed through a React context provider | D-07/D-08/D-09: TourProvider with minimal API surface, mounted in protected layout, reads session |
| INFRA-04 | Tour steps are defined in a centralized configuration with target selectors and content | D-04/D-05/D-06: Single `lib/tour/steps.ts` file with typed `TOUR_STEPS` array |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma | 5.22+ | Database migration for `hasSeenTour` column | Already in use; `schema.prisma` is the single source of truth [VERIFIED: schema.prisma] |
| NextAuth v5 | beta.30 | JWT/session type augmentation for `hasSeenTour` | Already in use; `isDemoAccount` is the exact pattern to replicate [VERIFIED: auth.ts] |
| React | 18.3.1 | `createContext` + `useContext` for TourProvider | Already in use; no additional React packages needed [VERIFIED: package.json] |

### Supporting
No additional libraries needed. This phase uses only existing project dependencies.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| React Context | Zustand/Jotai | Overkill -- project convention is no global state library; context is sufficient for tour state [VERIFIED: CLAUDE.md "No global state library"] |
| JWT session field | Separate API fetch | D-11 explicitly locks this out; JWT is the transport |

**Installation:**
```bash
# No new packages required
```

## Architecture Patterns

### Recommended Project Structure
```
nextjs/
├── lib/
│   ├── tour/
│   │   ├── steps.ts           # TOUR_STEPS array + TourStep interface (INFRA-04)
│   │   └── types.ts           # TourStep type (or inline in steps.ts)
│   └── api/
│       └── tour.ts            # Client-side fetch wrapper for POST /api/tour/complete
├── components/
│   └── providers/
│       └── TourProvider.tsx   # React context provider (INFRA-03)
├── app/
│   ├── api/
│   │   └── tour/
│   │       └── complete/
│   │           └── route.ts   # POST handler (INFRA-02)
│   └── (protected)/
│       └── layout.tsx         # Mount TourProvider here (D-08)
├── auth.ts                    # Add hasSeenTour to JWT/session types + callbacks
├── auth.config.ts             # Forward hasSeenTour in edge session callback
└── prisma/
    └── schema.prisma          # Add hasSeenTour Boolean to User model
```

### Pattern 1: Boolean Field Through JWT Pipeline (isDemoAccount template)
**What:** Add a boolean field to User model, propagate through JWT token and session callbacks, expose on client via `useSession()`.
**When to use:** Any per-user flag that needs to be available on every page without an API call.
**Example:**
```typescript
// Source: nextjs/auth.ts lines 23, 37, 230, 360, 408
// 1. Type augmentation (auth.ts)
declare module 'next-auth' {
  interface Session {
    user: {
      // ... existing fields ...
      hasSeenTour: boolean;
    };
  }
}
declare module '@auth/core/jwt' {
  interface JWT {
    // ... existing fields ...
    hasSeenTour: boolean;
  }
}

// 2. JWT callback - initial sign-in enrichment (auth.ts jwt callback, ~line 230)
token.hasSeenTour = u.hasSeenTour ?? false;

// 3. JWT callback - re-fetch on every request (auth.ts jwt callback, ~line 360)
// Add hasSeenTour to the select clause of the dbUser lookup
const dbUser = await prisma.user.findUnique({
  where: { email: userEmail },
  select: { defaultProjectId: true, isSuperAdmin: true, isDemoAccount: true, hasSeenTour: true },
});
token.hasSeenTour = dbUser?.hasSeenTour ?? false;

// 4. Session callback - expose to client (auth.ts session callback, ~line 408)
session.user.hasSeenTour = (token.hasSeenTour as boolean) ?? false;

// 5. Edge config session callback (auth.config.ts, ~line 38)
session.user.hasSeenTour = (token.hasSeenTour as boolean) ?? false;
```
[VERIFIED: auth.ts, auth.config.ts -- exact pattern exists for isDemoAccount]

### Pattern 2: User-scoped API Endpoint
**What:** Authenticated POST endpoint that modifies the current user's record.
**When to use:** Any action scoped to the authenticated user.
**Example:**
```typescript
// Source: nextjs/app/api/users/me/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';

export async function POST() {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await db.user.update({
      where: { id: sessionUser.id },
      data: { hasSeenTour: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error completing tour:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```
[VERIFIED: users/me/route.ts -- getCurrentUser + db.user.update pattern]

### Pattern 3: Context Provider in Protected Layout
**What:** A `'use client'` provider component wrapping children in the protected layout.
**When to use:** State that needs to be available to all protected pages.
**Example:**
```typescript
// Source: nextjs/components/providers/ClientSessionProvider.tsx
// TourProvider follows same pattern but with internal state logic
'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { useSession } from 'next-auth/react';

interface TourContextValue {
  isActive: boolean;
  currentStep: number;
  stepCount: number;
  next: () => void;
  back: () => void;
  skip: () => void;
  complete: () => void;
}

const TourContext = createContext<TourContextValue | null>(null);

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useTour must be used within TourProvider');
  return ctx;
}
```
[VERIFIED: ClientSessionProvider.tsx -- provider wrapping pattern]

### Anti-Patterns to Avoid
- **Fetching tour state via separate API call on mount:** D-09/D-11 explicitly lock this out. Use JWT session data only.
- **Storing step content in the database:** Steps are static config (D-04). Database stores only the completion flag.
- **Importing TourProvider outside protected layout:** It depends on `useSession()` which requires `ClientSessionProvider` as ancestor (D-08).
- **Refreshing JWT after tour completion:** D-12 says no forced refresh. Set local state to `isActive = false` and let JWT sync naturally.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session/auth state | Custom cookie/localStorage auth | NextAuth JWT pipeline | Already in place; D-02 locks this |
| Database migrations | Raw SQL ALTER TABLE | `prisma migrate dev` | Project convention; schema.prisma is source of truth |
| Rate limiting | Custom middleware | `@upstash/ratelimit` pattern in `lib/ratelimit.ts` | Already abstracted with in-memory fallback |

**Key insight:** This phase is entirely about wiring existing patterns together. Every piece has a direct template in the codebase.

## Common Pitfalls

### Pitfall 1: Forgetting auth.config.ts Session Callback
**What goes wrong:** `hasSeenTour` appears in API routes (which use `auth.ts`) but is `undefined` in middleware or edge contexts.
**Why it happens:** `auth.config.ts` has its own `session` callback that must independently forward `hasSeenTour` from token to session.
**How to avoid:** Update BOTH `auth.ts` session callback (line ~403) AND `auth.config.ts` session callback (line ~33).
**Warning signs:** `session.user.hasSeenTour` is `undefined` on the client despite being set in the database.
[VERIFIED: auth.config.ts has separate session callback at line 33]

### Pitfall 2: Missing hasSeenTour in Authorize Return Object
**What goes wrong:** `hasSeenTour` is `false` on first login even though it's `true` in the database.
**Why it happens:** The `authorize` function in the Credentials provider returns a user object that feeds the initial JWT enrichment. If `hasSeenTour` is not included in the user query/return, the JWT callback's `user` block won't have it.
**How to avoid:** Add `hasSeenTour` to the `prisma.user.findFirst` select in the `authorize` function (auth.ts ~line 171) and include it in the return object (auth.ts ~line 188).
**Warning signs:** Tour shows on every login for credentials users but works for returning sessions.
[VERIFIED: auth.ts authorize function at line 161-198]

### Pitfall 3: Google OAuth Sign-In Missing hasSeenTour
**What goes wrong:** Google OAuth users always see `hasSeenTour = false` on first sign-in even after completing the tour previously.
**Why it happens:** Google OAuth `signIn` callback creates users but doesn't return a user object with `hasSeenTour`. The JWT callback's `user` block for Google sign-ins may not have the field.
**How to avoid:** The JWT callback's else branch (line ~347, the re-fetch on every request) already fetches from DB -- ensure `hasSeenTour` is in the `select` clause there. This naturally covers Google OAuth users after their first token refresh.
**Warning signs:** Google OAuth users see the tour flash briefly on every login.
[VERIFIED: auth.ts JWT callback re-fetch at line 347-395]

### Pitfall 4: TourProvider Renders Before Session is Ready
**What goes wrong:** TourProvider reads `useSession()` which may initially return `loading` status, causing the tour to briefly show or hide incorrectly.
**Why it happens:** NextAuth's `useSession()` has a `status` field that transitions through `loading` -> `authenticated`.
**How to avoid:** Check `status === 'authenticated'` before evaluating `hasSeenTour`. While loading, keep `isActive = false`.
**Warning signs:** Tour flickers on page load.
[ASSUMED -- standard NextAuth behavior]

### Pitfall 5: Prisma Migration on Existing Data
**What goes wrong:** Migration fails or takes long on large user tables.
**Why it happens:** Adding a NOT NULL Boolean with a default value should be fast on PostgreSQL (it's a metadata-only change in modern PG), but worth noting.
**How to avoid:** Use `Boolean @default(false)` which PostgreSQL handles efficiently. No data backfill needed.
**Warning signs:** None expected -- this is a safe migration pattern.
[VERIFIED: PostgreSQL documentation -- adding column with default is O(1) since PG 11]

## Code Examples

### Prisma Schema Addition
```prisma
// Source: nextjs/prisma/schema.prisma, User model (~line 40)
model User {
  // ... existing fields ...
  isDemoAccount Boolean   @default(false)
  hasSeenTour   Boolean   @default(false)   // <-- add after isDemoAccount
  createdAt     DateTime  @default(now())
  // ... rest of model ...
}
```
[VERIFIED: schema.prisma User model at line 40-63]

### Tour Steps Configuration
```typescript
// File: nextjs/lib/tour/steps.ts
export interface TourStep {
  id: string;
  targetSelector: string;
  title: string;
  body: string;
  placement: 'top' | 'bottom' | 'left' | 'right';
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: 'welcome',
    targetSelector: '[data-tour="sidebar-nav"]',
    title: 'Welcome to SetCash',
    body: 'This is your navigation sidebar...',
    placement: 'right',
  },
  // ... 5 more steps
] as const;
```
[ASSUMED -- step content is placeholder; actual selectors depend on Phase 8 INTG-01]

### Client API Wrapper
```typescript
// File: nextjs/lib/api/tour.ts
// Follows pattern from nextjs/lib/api/bills.ts fetchWithError
export async function completeTour(): Promise<{ success: boolean }> {
  const res = await fetch('/api/tour/complete', { method: 'POST' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to complete tour');
  }
  return res.json();
}
```
[VERIFIED: lib/api/bills.ts fetchWithError pattern]

### SessionUser Type Extension
```typescript
// File: nextjs/lib/auth/session.ts -- add hasSeenTour to SessionUser type
export type SessionUser = {
  id: string;
  email: string;
  role: 'user' | 'admin' | 'owner' | 'superadmin';
  currentProjectId: string | null;
  isDemoAccount: boolean;
  hasSeenTour: boolean;  // <-- add
};
```
[VERIFIED: lib/auth/session.ts at line 7-13]

## State of the Art

No relevant changes. This phase uses stable, established patterns (Prisma migrations, React Context, NextAuth JWT). Nothing is deprecated or changing.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `useSession()` has a `loading` status that must be handled in TourProvider | Common Pitfalls #4 | Tour could flicker on load; low risk, easy fix |
| A2 | Tour step content (titles, body text) are placeholders -- actual content defined by user in Phase 7/8 | Code Examples | No risk -- config file is easily editable |
| A3 | Explicit string IDs for steps (e.g., `'welcome'`, `'bills'`) are preferable to array indices for debugging and future analytics (v2 TOUR-02) | Architecture Patterns | Low risk -- array index works too, discretion area |

## Open Questions

1. **Tour step content and selectors**
   - What we know: 6 steps covering the core workflow (per STATE.md)
   - What's unclear: Exact title/body text and target CSS selectors for each step
   - Recommendation: Use placeholder content in Phase 6. Phase 8 (INTG-01) adds `data-tour` attributes to actual UI elements, at which point selectors become concrete. Step content can be finalized then.

2. **Rate limiting for completion endpoint**
   - What we know: Single fire-and-forget call per user (D-10 says idempotent)
   - What's unclear: Whether it needs rate limiting at all
   - Recommendation: Add a light rate limiter (e.g., `tourComplete: { max: 5, window: '1 m' }`) to prevent abuse. Follows project convention where every POST endpoint has rate limiting. This is a Claude's discretion area.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.7 + ts-jest 29.4.6 |
| Config file | `nextjs/jest.config.js` |
| Quick run command | `cd nextjs && npx jest --testPathPattern tour --no-coverage -x` |
| Full suite command | `cd nextjs && npm run test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-01 | hasSeenTour persisted in DB | integration | `npx jest __tests__/api/tour-complete.test.ts -x` | Wave 0 |
| INFRA-02 | POST /api/tour/complete sets flag | integration | `npx jest __tests__/api/tour-complete.test.ts -x` | Wave 0 |
| INFRA-03 | TourProvider exposes context API | unit | `npx jest __tests__/lib/tour-provider.test.ts -x` | Wave 0 |
| INFRA-04 | TOUR_STEPS config has 6 entries with required fields | unit | `npx jest __tests__/lib/tour-steps.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd nextjs && npx jest --testPathPattern tour --no-coverage -x`
- **Per wave merge:** `cd nextjs && npm run test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `nextjs/__tests__/api/tour-complete.test.ts` -- covers INFRA-01, INFRA-02
- [ ] `nextjs/__tests__/lib/tour-steps.test.ts` -- covers INFRA-04 (validates step shape and count)
- [ ] `nextjs/__tests__/lib/tour-provider.test.ts` -- covers INFRA-03 (may require React test utils; could defer to Phase 7 if too complex for this infra phase)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `getCurrentUser()` auth check on POST endpoint [VERIFIED: lib/auth/session.ts] |
| V3 Session Management | yes | JWT session -- hasSeenTour added to existing JWT pipeline, no new session mechanism |
| V4 Access Control | no | No project-scoped data; user-scoped only (own hasSeenTour flag) |
| V5 Input Validation | minimal | POST /api/tour/complete takes no request body; no input to validate |
| V6 Cryptography | no | No crypto operations |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthorized tour completion | Spoofing | `getCurrentUser()` auth check returns 401 if no session |
| Rate limit bypass on completion endpoint | Denial of Service | Rate limiter from `lib/ratelimit.ts` |
| JWT tampering of hasSeenTour | Tampering | JWT is signed by NextAuth; field is re-fetched from DB on every request (auth.ts line ~350) |

## Discretion Recommendations

Areas marked as Claude's discretion, with research-backed recommendations:

### Rate Limiting
**Recommendation:** Add `tourComplete: { max: 5, window: '1 m', name: 'tour_complete' }` to `rateLimits` in `lib/ratelimit.ts`. Light enough to never hit in normal use, prevents abuse. Follows the project pattern where every mutation endpoint has a rate limiter.
[VERIFIED: lib/ratelimit.ts -- all POST endpoints have rate limiters]

### File Placement
**Recommendation:** `lib/tour/steps.ts` for the step configuration (types + data in one file). Separate `types.ts` is unnecessary given the small surface. TourProvider lives in `components/providers/TourProvider.tsx` alongside `ClientSessionProvider.tsx`. API wrapper in `lib/api/tour.ts`.
[VERIFIED: existing lib/api/ and components/providers/ directory structure]

### Step IDs
**Recommendation:** Use explicit string IDs (e.g., `'welcome'`, `'submit-bill'`) rather than array indices. Reasons: (1) more readable in debugging, (2) stable reference for Phase 8 integration, (3) future-proofs for v2 analytics (TOUR-02). Negligible cost.
[ASSUMED -- no existing pattern in codebase to reference]

## Sources

### Primary (HIGH confidence)
- `nextjs/auth.ts` -- JWT/session type augmentation, isDemoAccount pattern, authorize function, JWT callback
- `nextjs/auth.config.ts` -- Edge-compatible session callback that must be kept in sync
- `nextjs/prisma/schema.prisma` -- User model structure, existing boolean field patterns
- `nextjs/app/(protected)/layout.tsx` -- Provider mounting pattern
- `nextjs/components/providers/ClientSessionProvider.tsx` -- Provider component pattern
- `nextjs/app/api/users/me/route.ts` -- User-scoped API route pattern with getCurrentUser
- `nextjs/lib/auth/session.ts` -- SessionUser type that needs hasSeenTour
- `nextjs/lib/ratelimit.ts` -- Rate limiting pattern for API endpoints
- `nextjs/lib/hooks/useBills.ts` -- Custom hook pattern (useState + useCallback + useEffect)
- `nextjs/lib/api/bills.ts` -- Client API wrapper pattern

### Secondary (MEDIUM confidence)
- PostgreSQL documentation -- Boolean column with default is O(1) metadata change since PG 11

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in use, no new dependencies
- Architecture: HIGH -- every pattern has a direct template in the codebase
- Pitfalls: HIGH -- identified from reading actual auth.ts flow; each pitfall maps to specific lines

**Research date:** 2026-04-08
**Valid until:** 2026-05-08 (stable patterns, no fast-moving dependencies)
