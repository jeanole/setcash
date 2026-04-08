# Architecture Research — Onboarding Tour Integration

**Domain:** Tooltip-based onboarding tour in existing Next.js 14 App Router app
**Researched:** 2026-04-08
**Confidence:** HIGH (based on direct codebase audit + verified library documentation)

---

## System Overview

The tour is a client-side overlay system that sits between AppShell and the page content. It does not add new routes, new API endpoints (except one for persisting completion state), or new database tables. It adds one DB column, one React context provider, one hook, and a set of step definition constants.

```
┌─────────────────────────────────────────────────────────────────┐
│  (protected)/layout.tsx  (server component)                     │
│    └── ClientSessionProvider                                    │
│          └── TourProvider  ← NEW (wraps AppShell)               │
│                └── AppShell  (client component)                 │
│                      ├── Sidebar  (nav links need data-tour-*)  │
│                      ├── Header                                 │
│                      ├── {children}  (page content)             │
│                      └── TourOverlay  ← NEW (renders tooltips)  │
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | New/Modified | Responsibility |
|-----------|-------------|----------------|
| `TourProvider` | NEW | React context holding tour state (active, currentStep, steps). Reads session to decide auto-start. Exposes `startTour()`, `nextStep()`, `prevStep()`, `skipTour()`, `completeTour()`. |
| `TourOverlay` | NEW | Renders the spotlight backdrop + speech-bubble tooltip positioned relative to the target element. Uses Floating UI (already indirectly available via Radix, or add `@floating-ui/react-dom`). |
| `TourTooltip` | NEW | The speech-bubble UI component: title, body text, step indicator (2/6), Next/Back/Skip/Done buttons. Pure presentational. |
| `TOUR_STEPS` | NEW | Constant array defining the 6 steps: `{ id, target, title, content, route?, placement }`. Defined in `lib/tour/steps.ts`. |
| `useTour` | NEW | Hook that consumes TourProvider context. Components call `useTour()` to check if tour is active and which step is current. |
| `AppShell` | MODIFIED | Renders `<TourOverlay />` as last child (portal-free, lives in the flex layout). |
| `Sidebar` NavLinks | MODIFIED | Add `data-tour="nav-bills"`, `data-tour="nav-budget"`, etc. to nav link elements for targeting. |
| `(protected)/layout.tsx` | MODIFIED | Wraps content with `<TourProvider>` between `ClientSessionProvider` and `AppShell`. Passes `isDemoAccount` and `hasSeenTour` as props. |
| `User` model | MODIFIED | Add `hasSeenTour Boolean @default(false)` column. |
| `POST /api/tour/complete` | NEW | Single endpoint: sets `hasSeenTour = true` for the authenticated user. |

---

## Recommended Project Structure

```
nextjs/
├── components/
│   └── tour/
│       ├── TourProvider.tsx       # Context provider + auto-start logic
│       ├── TourOverlay.tsx        # Backdrop + positioned tooltip container
│       ├── TourTooltip.tsx        # Speech-bubble UI component
│       └── index.ts               # Barrel: export { TourProvider } from './TourProvider'
├── lib/
│   └── tour/
│       ├── steps.ts               # TOUR_STEPS constant array
│       ├── types.ts               # TourStep interface, TourState type
│       └── useTour.ts             # Hook consuming TourContext
├── app/
│   └── api/
│       └── tour/
│           └── complete/
│               └── route.ts       # POST handler to persist completion
└── prisma/
    └── migrations/
        └── YYYYMMDD_add_has_seen_tour/
            └── migration.sql      # ALTER TABLE "User" ADD COLUMN "hasSeenTour" ...
```

### Structure Rationale

- **components/tour/**: Isolated from other component domains. TourProvider is a layout-level component; TourOverlay and TourTooltip are its children. No other component folder needs modification.
- **lib/tour/**: Step definitions and types live here because they are data, not UI. The `useTour` hook follows the existing pattern (`lib/hooks/useBills.ts` etc.) but lives in `lib/tour/` because it is tightly coupled to tour types.
- **app/api/tour/complete/**: Follows the existing API route naming convention. Single-purpose endpoint.

---

## Architectural Patterns

### Pattern 1: Provider at Layout Level, Not Page Level

**What:** Mount `TourProvider` inside the `(protected)/layout.tsx` server component, wrapping `AppShell`. This means the tour context persists across client-side navigations between protected pages.

**When to use:** Always for multi-step tours that reference elements in the persistent shell (sidebar, header) AND elements inside page content.

**Trade-offs:**
- PRO: Sidebar nav links, header elements, and page content are all within the provider's scope. No need to reinitialize tour state on navigation.
- PRO: Tour survives `router.push()` between steps (e.g., from dashboard to /bills).
- CON: Provider must handle the case where target elements do not exist yet (page not loaded). Solved with a `waitForElement` utility.

**Implementation in existing layout:**

```typescript
// app/(protected)/layout.tsx — the only server-component change
import { TourProvider } from '@/components/tour';

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session) redirect('/login');

  // Fetch hasSeenTour alongside existing profile fields
  const dbUser = session.user?.id
    ? await db.user.findUnique({
        where: { id: session.user.id },
        select: { hasSeenTour: true, username: true, firstName: true, lastName: true, mobile: true },
      })
    : null;

  return (
    <ClientSessionProvider session={session}>
      <AuthPageTracker />
      <TourProvider
        isDemoAccount={session.user?.isDemoAccount ?? false}
        hasSeenTour={dbUser?.hasSeenTour ?? false}
      >
        <AppShell currentUser={currentUser}>
          {children}
        </AppShell>
      </TourProvider>
    </ClientSessionProvider>
  );
}
```

### Pattern 2: Data Attributes for Tour Targeting

**What:** Add `data-tour="step-id"` attributes to existing elements that tour steps reference. The tour library queries `document.querySelector('[data-tour="nav-bills"]')` to find the anchor element.

**When to use:** Always. CSS selectors or component refs are fragile. Data attributes are explicit, greppable, and do not break if class names change.

**Elements needing data-tour attributes:**

| Step | Target Element | File | Attribute |
|------|---------------|------|-----------|
| 1. Navigation | Sidebar `<nav>` element | `Sidebar.tsx` line 295 | `data-tour="sidebar-nav"` |
| 2. Bills | Bills nav link | `Sidebar.tsx` NavLinks | `data-tour="nav-bills"` |
| 3. Budget | Budget nav link | `Sidebar.tsx` NavLinks | `data-tour="nav-budget"` |
| 4. Create Bill | "New Bill" button on /bills page | `components/bills/BillList.tsx` or equivalent | `data-tour="create-bill"` |
| 5. Exports | Export button/section | `components/bills/BillList.tsx` or equivalent | `data-tour="export-bills"` |
| 6. Settings | Settings nav link | `Sidebar.tsx` NavLinks | `data-tour="nav-settings"` |

**Example modification to NavLinks:**

```typescript
// In Sidebar.tsx NavLinks component
<a
  key={item.href}
  href={item.href}
  data-tour={`nav-${item.label.toLowerCase()}`}  // ← add this
  onClick={() => onClose?.()}
  className={cn(/* existing classes */)}
>
```

### Pattern 3: Single-Page Tour (No Cross-Route Navigation)

**What:** Keep all 6 tour steps anchored to elements visible on the dashboard/initial page, primarily sidebar nav items and the AppShell header. Do NOT navigate the user to /bills or /budget during the tour.

**When to use:** For a v1 lightweight tour. Cross-route tours add significant complexity (waiting for route transitions, handling loading states, back-button edge cases).

**Trade-offs:**
- PRO: All target elements exist in the DOM simultaneously (sidebar is always rendered). No async waiting, no navigation race conditions.
- PRO: Tour completes in seconds without disorienting page transitions.
- CON: Cannot point at page-specific elements like the "New Bill" button (it only exists on /bills). Mitigate by pointing at the Bills nav link and describing what the user will find there.
- CON: Less "hands-on" feeling. Acceptable per project requirement ("lightweight tooltips only").

**If cross-route navigation is needed later:** react-joyride 3.x supports a `beforeStep` callback that can call `router.push()` and return a Promise. The tour pauses until the Promise resolves and the target element appears. This is a v2 enhancement.

### Pattern 4: Tour State via Database Column (Not localStorage)

**What:** Store tour completion as `User.hasSeenTour: Boolean` in PostgreSQL. Read it in the server component layout. Write it via a POST endpoint when the user completes or skips the tour.

**When to use:** When the "always show for demo accounts" requirement exists and tour state must survive device/browser changes for real users.

**Trade-offs:**
- PRO: Works across devices and browsers. A user who completed the tour on desktop does not see it again on mobile.
- PRO: Server component can read it without client-side hydration delay. The TourProvider receives `hasSeenTour` as a prop from the server, so the initial render already knows whether to show the tour.
- PRO: Demo account bypass is clean: `if (isDemoAccount || !hasSeenTour) { autoStart() }`.
- CON: Requires a Prisma migration and a new API endpoint. Minimal overhead for a single boolean column.

**Why not localStorage:**
- Does not survive incognito mode or device switches.
- Demo accounts sharing a browser would have conflicting localStorage state.
- Cannot be read server-side, causing a flash of "tour started then immediately hidden" on hydration.

**Why not session/JWT:**
- JWT is already carrying 7+ custom fields. Adding more increases cookie size.
- Tour completion is permanent user state, not session state. If the user logs out and back in, the tour should still be marked complete.

---

## Data Flow

### Tour Initialization Flow

```
Server: layout.tsx
  1. auth() → session (has isDemoAccount)
  2. db.user.findUnique({ hasSeenTour }) → boolean
  3. Render <TourProvider isDemoAccount={isDemoAccount} hasSeenTour={hasSeenTour}>

Client: TourProvider
  4. On mount, evaluate: shouldAutoStart = isDemoAccount || !hasSeenTour
  5. If shouldAutoStart AND on dashboard route → set tourState.active = true
  6. Render children normally; TourOverlay reads tourState from context
```

### Tour Step Progression Flow

```
User clicks "Next" in TourTooltip
  1. TourProvider.nextStep() increments currentStepIndex
  2. TourOverlay reads new step from TOUR_STEPS[currentStepIndex]
  3. TourOverlay queries document.querySelector(`[data-tour="${step.target}"]`)
  4. If element found → position tooltip relative to element using Floating UI
  5. If element not found → skip to next step (defensive, should not happen in single-page mode)
```

### Tour Completion Flow

```
User clicks "Done" (last step) or "Skip" (any step)
  1. TourProvider.completeTour() sets tourState.active = false
  2. If NOT isDemoAccount:
     a. POST /api/tour/complete (fire-and-forget, no loading state needed)
     b. Server: auth(), prisma.user.update({ hasSeenTour: true })
  3. If isDemoAccount: no persistence (tour shows again next login)
```

### Key Data Flows

1. **hasSeenTour read:** Server component → prop → TourProvider (zero client-side fetch needed)
2. **hasSeenTour write:** TourProvider → fetch POST /api/tour/complete → DB update (fire-and-forget)
3. **isDemoAccount bypass:** Session JWT → server component → prop → TourProvider (existing data flow, no changes)

---

## Integration Points

### Existing Components Modified

| File | Change | Risk |
|------|--------|------|
| `app/(protected)/layout.tsx` | Add `hasSeenTour` to DB query select, wrap with `<TourProvider>` | LOW — additive, no existing behavior changes |
| `components/layout/AppShell.tsx` | Add `<TourOverlay />` as last child inside the flex container | LOW — additive, overlay is position:fixed |
| `components/layout/Sidebar.tsx` | Add `data-tour` attributes to nav links and `<nav>` element | ZERO — data attributes have no visual or behavioral effect |
| `prisma/schema.prisma` | Add `hasSeenTour Boolean @default(false)` to User model | LOW — additive column with default, no existing queries affected |

### New Components

| File | Purpose | Dependencies |
|------|---------|-------------|
| `components/tour/TourProvider.tsx` | Context + state machine | `lib/tour/steps.ts`, `lib/tour/types.ts` |
| `components/tour/TourOverlay.tsx` | Backdrop + positioning | `@floating-ui/react-dom`, `lib/tour/useTour.ts` |
| `components/tour/TourTooltip.tsx` | Speech-bubble UI | Tailwind only (no new deps) |
| `lib/tour/steps.ts` | Step definitions | `lib/tour/types.ts` |
| `lib/tour/types.ts` | TypeScript interfaces | None |
| `lib/tour/useTour.ts` | Context consumer hook | React |
| `app/api/tour/complete/route.ts` | Persist completion | `auth.ts`, `lib/db.ts` |

### External Dependencies

| Package | Purpose | Why This One |
|---------|---------|-------------|
| `@floating-ui/react-dom` | Position tooltip relative to target element | Lightweight (3.5 kB gzipped), handles scroll/resize/overflow. Already the positioning engine used by Radix and Headless UI. No full tour library needed because the tour logic is simple enough to own (6 fixed steps, no branching, no async targets). |

**Why not react-joyride:** react-joyride (v3.0.2, just released) is the most popular React tour library with 400K+ weekly npm downloads. It would work. However, for 6 fixed tooltip steps with no cross-route navigation, it is overkill: it brings its own state machine, theming system, and Floater dependency. The custom approach with Floating UI is ~200 lines of code total and gives full control over the speech-bubble design to match Tailwind CSS conventions. If the tour grows beyond 10 steps or needs cross-route navigation in v2, migrating to react-joyride would be straightforward because the `data-tour` targeting pattern is the same.

**Why not driver.js:** driver.js (v1.4.0) is lightweight and framework-agnostic. It handles spotlight overlays well. However, it uses its own CSS for styling (not Tailwind), does not integrate with React state (imperative API only), and the React wrapper (`driverjs-react`) is a community package with low adoption. The speech-bubble design would fight against driver.js defaults rather than leverage them.

---

## Anti-Patterns

### Anti-Pattern 1: Mounting Tour at Page Level

**What people do:** Put `<TourProvider>` inside individual page components (e.g., `/dashboard/page.tsx`).
**Why it is wrong:** The sidebar nav links live in AppShell, which is rendered by the layout. Page-level providers cannot access elements outside their subtree. Navigation between pages destroys and recreates the provider, losing tour state.
**Do this instead:** Mount TourProvider in `(protected)/layout.tsx`, above AppShell.

### Anti-Pattern 2: Using CSS Selectors for Targeting

**What people do:** Target tour steps with `.sidebar a:nth-child(2)` or `#bills-link`.
**Why it is wrong:** CSS selectors are fragile — reordering nav items, changing class names, or restructuring JSX breaks the tour silently. IDs pollute the global namespace.
**Do this instead:** Use `data-tour="nav-bills"` attributes. They are explicit, greppable, and decoupled from styling.

### Anti-Pattern 3: Navigating Between Routes During Tour

**What people do:** Step 1 points at sidebar, step 2 calls `router.push('/bills')` and points at the "New Bill" button, step 3 calls `router.push('/budget')`.
**Why it is wrong:** Race conditions between route transition and element mounting. Loading states interrupt the tour. Back button breaks tour state. Mobile navigation drawer opens/closes unexpectedly.
**Do this instead:** For v1, keep all steps targeting elements in the persistent shell (sidebar, header). Describe what each section contains in the tooltip text rather than navigating there.

### Anti-Pattern 4: Storing Tour State in localStorage

**What people do:** `localStorage.setItem('hasSeenTour', 'true')` on completion.
**Why it is wrong:** Does not survive incognito, device switches, or browser clears. Demo accounts sharing a browser get conflicting state. Cannot be read server-side, causing hydration mismatch (tour flashes then hides).
**Do this instead:** Database column `User.hasSeenTour` read in the server component layout.

### Anti-Pattern 5: Polling for Target Elements

**What people do:** `setInterval(() => document.querySelector(target), 100)` to wait for elements to appear.
**Why it is wrong:** Wasteful, introduces timing bugs, and accumulates if the element never appears.
**Do this instead:** In single-page mode, all targets exist immediately (sidebar is always rendered). If cross-route is added later, use `MutationObserver` with a timeout, or react-joyride which handles this internally.

---

## Suggested Build Order

The dependency graph is simple because the tour is additive.

```
Phase 1: Foundation (no dependencies)
  1. Prisma migration: add hasSeenTour to User          ← DB change, deploy-safe
  2. lib/tour/types.ts + lib/tour/steps.ts              ← data definitions
  3. POST /api/tour/complete endpoint                    ← simple API route

Phase 2: UI Components (depends on Phase 1 types)
  4. components/tour/TourTooltip.tsx                     ← pure UI, testable in isolation
  5. components/tour/TourOverlay.tsx                     ← positioning logic
  6. components/tour/TourProvider.tsx + lib/tour/useTour  ← state machine

Phase 3: Integration (depends on Phase 2 components)
  7. Add data-tour attributes to Sidebar.tsx nav links   ← zero-risk attribute additions
  8. Modify layout.tsx to query hasSeenTour + wrap with TourProvider
  9. Modify AppShell.tsx to render TourOverlay

Phase 4: Polish + Testing
  10. Integration test: tour completion endpoint
  11. Manual testing: demo account always-show, real account once-show
  12. Edge cases: mobile viewport, dark mode, RTL (if applicable)
```

**Phase ordering rationale:**
- Migration first because the API endpoint and layout query depend on the column existing.
- Types and steps before components because TourProvider imports step definitions.
- TourTooltip before TourOverlay because the overlay renders the tooltip.
- Data-tour attributes before layout integration so target elements are queryable when TourProvider mounts.
- Tests last because the feature is small enough to build and wire up first, then validate.

---

## Sources

- Codebase audit: `app/(protected)/layout.tsx`, `components/layout/AppShell.tsx`, `components/layout/Sidebar.tsx`, `prisma/schema.prisma`, `auth.ts`, `auth.config.ts`
- [react-joyride multi-route docs](https://react-joyride.com/multi-route) — multi-route patterns evaluated and deferred
- [react-joyride npm](https://www.npmjs.com/package/react-joyride) — v3.0.2, React 18 compatible
- [driver.js official site](https://driverjs.com/) — evaluated, not recommended for React integration
- [OnboardJS comparison](https://onboardjs.com/blog/5-best-react-onboarding-libraries-in-2025-compared) — library landscape overview
- [Floating UI](https://floating-ui.com/) — recommended positioning library
- [Sandro Roth tour library evaluation](https://sandroroth.com/blog/evaluating-tour-libraries/) — independent comparison

---
*Architecture research for: SetCash onboarding tour milestone*
*Researched: 2026-04-08*
