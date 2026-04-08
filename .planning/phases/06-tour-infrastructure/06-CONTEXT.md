# Phase 6: Tour Infrastructure - Context

**Gathered:** 2026-04-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Database persistence for tour completion state, a REST API endpoint to mark the tour complete, a React context provider for tour state management, and a centralized TypeScript configuration file defining all 6 tour steps. This phase delivers the plumbing — no visible UI components (Phase 7) or app integration (Phase 8).

</domain>

<decisions>
## Implementation Decisions

### Tour State Persistence
- **D-01:** Add a `hasSeenTour` Boolean column (default `false`) to the existing `User` model in Prisma schema. Single migration, mirrors the `isDemoAccount` pattern.
- **D-02:** Add `hasSeenTour` to the JWT/session type augmentation in `auth.ts`, following the same pattern as `isDemoAccount`. Available on client via `useSession()` without extra API calls.
- **D-03:** Demo/test users bypass the flag — TourProvider checks `isDemoAccount` from session and shows the tour regardless of `hasSeenTour` value. The flag is still written on completion but ignored on read for demo users.

### Step Configuration
- **D-04:** All 6 tour steps defined in a single TypeScript file (e.g., `lib/tour/steps.ts`). One array of step objects. Adding or reordering a step requires editing only this file (per INFRA-04).
- **D-05:** Each step has: `targetSelector` (CSS string), `title` (string), `body` (string), `placement` ('top' | 'bottom' | 'left' | 'right'). Minimal shape — no page route, no media fields.
- **D-06:** Type safety via a `TourStep` TypeScript interface and a typed `TOUR_STEPS` array with `as const`. Step IDs derived from array index or explicit string ID field.

### TourProvider Design
- **D-07:** Minimal context API surface: `isActive`, `currentStep`, `stepCount`, `next()`, `back()`, `skip()`, `complete()`. No step metadata on context — consumers import steps config separately if needed.
- **D-08:** TourProvider mounted inside the protected layout (`app/(protected)/layout.tsx`), wrapping AppShell children. Same mounting pattern as `ClientSessionProvider`.
- **D-09:** Initial state loaded from `useSession()` — reads `hasSeenTour` and `isDemoAccount` from the JWT. No extra API call on mount.

### API Endpoint
- **D-10:** `POST /api/tour/complete` — no request body needed. Sets `hasSeenTour = true` for the authenticated user. Returns `{ success: true }`. Idempotent. Standard auth-first, try/catch pattern.
- **D-11:** No separate GET endpoint for tour state. TourProvider relies entirely on the JWT session data.
- **D-12:** No forced JWT refresh after POST. TourProvider sets its own `isActive = false` locally after successful completion. JWT catches up on next natural session refresh/page load.

### Claude's Discretion
- Rate limiting strategy for the tour completion endpoint (likely light — single fire-and-forget call)
- Exact file placement within `lib/tour/` directory structure
- Whether step IDs use array index or explicit string identifiers

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Auth & Session
- `nextjs/auth.ts` — JWT/session type augmentation, `isDemoAccount` pattern to replicate for `hasSeenTour`
- `nextjs/auth.config.ts` — Edge-compatible session callback where `hasSeenTour` needs to be forwarded

### Database
- `nextjs/prisma/schema.prisma` — User model where `hasSeenTour` column will be added

### Layout & Providers
- `nextjs/app/(protected)/layout.tsx` — Where TourProvider will be mounted (after ClientSessionProvider)
- `nextjs/components/providers/ClientSessionProvider.tsx` — Pattern to follow for provider implementation

### API Patterns
- `nextjs/app/api/users/me/route.ts` — Reference for user-scoped API endpoint pattern

### Requirements
- `.planning/REQUIREMENTS.md` §Tour Infrastructure — INFRA-01 through INFRA-04

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `isDemoAccount` pattern in `auth.ts` and `auth.config.ts` — exact template for adding `hasSeenTour` to JWT/session
- `ClientSessionProvider` — pattern for wrapping protected layout with a context provider
- `useSession()` hook — already used throughout client components for session data access
- `fetchWithError<T>()` in `lib/api/bills.ts` — pattern for the API client function

### Established Patterns
- JWT type augmentation in `auth.ts` with `declare module` blocks for `next-auth` and `@auth/core/jwt`
- Protected layout fetches DB data and wraps children with providers
- API routes: auth check first, Zod validation, try/catch, `{ error: 'message' }` responses
- Custom hooks in `lib/hooks/` encapsulate fetch + state

### Integration Points
- `auth.ts` JWT callback — add `hasSeenTour` to token enrichment
- `auth.config.ts` session callback — forward `hasSeenTour` to session
- `app/(protected)/layout.tsx` — mount TourProvider
- `prisma/schema.prisma` User model — add column + migration

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-tour-infrastructure*
*Context gathered: 2026-04-08*
