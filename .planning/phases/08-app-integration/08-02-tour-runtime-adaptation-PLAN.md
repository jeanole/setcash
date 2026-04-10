---
phase: 08-app-integration
plan: 02
type: execute
wave: 2
depends_on:
  - 08-01
files_modified:
  - nextjs/components/providers/TourProvider.tsx
  - nextjs/components/tour/TourController.tsx
  - nextjs/lib/tour/steps.ts
  - nextjs/lib/tour/viewport.ts
autonomous: true
requirements:
  - INTG-02
  - INTG-03
user_setup: []

must_haves:
  truths:
    - "Auto-start only fires when pathname === '/dashboard' AND (isDemoAccount OR !hasSeenTour) AND status === 'authenticated' (D-11)"
    - "If post-login landing page is NOT /dashboard, TourProvider triggers exactly one router.push('/dashboard') before activating (D-07)"
    - "After conditions are met, activation waits ~150ms (settle delay) before setIsActive(true) (D-11)"
    - "On viewports <1024px the project-switcher step is skipped entirely (D-02)"
    - "On viewports <1024px the sidebar-nav step resolves to the visible element (hamburger button in Header), not a hidden desktop nav (D-02)"
    - "Tour NEVER opens or closes the mobile drawer — no UI state mutation (D-03)"
    - "Missing target triggers 3 retry attempts over ~500ms, then silent advance to next step (D-10)"
    - "If every step skips for missing targets, tour aborts WITHOUT calling completeTour() — hasSeenTour stays false (D-10)"
    - "budget-matrix step body copy reflects 'Spending by Category' overview, not literal budget matrix (D-09)"
    - "Step config in steps.ts remains the single source of truth; mobile skip logic lives in runtime, not in duplicated config (D-04)"
  artifacts:
    - path: "nextjs/components/providers/TourProvider.tsx"
      provides: "Pathname-gated auto-start with settle delay and one-shot dashboard push"
      contains: "usePathname"
    - path: "nextjs/components/tour/TourController.tsx"
      provides: "Retry + skip-forward, viewport-aware target resolution, abort-without-complete on total skip"
      contains: "requestAnimationFrame"
    - path: "nextjs/lib/tour/steps.ts"
      provides: "Updated budget-matrix step body; unchanged structure; adds optional desktopOnly flag consumed at runtime"
      contains: "Spending by Category"
    - path: "nextjs/lib/tour/viewport.ts"
      provides: "Small pure helpers: isDesktopViewport(), resolveVisibleTarget(selector)"
      exports: ["isDesktopViewport", "resolveVisibleTarget", "DESKTOP_MIN_WIDTH_PX"]
  key_links:
    - from: "TourProvider useEffect"
      to: "usePathname() and router.push('/dashboard')"
      via: "gating conditions + one-shot push"
      pattern: "usePathname\\(\\)"
    - from: "TourController step resolution"
      to: "lib/tour/viewport.ts resolveVisibleTarget"
      via: "import { resolveVisibleTarget, isDesktopViewport } from '@/lib/tour/viewport'"
      pattern: "resolveVisibleTarget"
    - from: "TourController missing-target handler"
      to: "runtime skip-forward (calls next() silently up to stepCount times, then aborts without complete())"
      via: "retry loop with up to 3 attempts spaced ~160ms apart"
      pattern: "setTimeout|requestAnimationFrame"
---

<objective>
Harden the tour runtime so it (a) auto-starts only under the correct combination of conditions (INTG-02), (b) adapts gracefully to mobile viewports at the 1024px breakpoint without mutating UI state (INTG-03), and (c) handles missing targets with retry-then-silent-skip-forward so a missing selector never produces a broken centered tooltip fallback.

Purpose: Close the gap between Phase 6 auto-start stub logic and real-world runtime conditions (race with first paint, landing page mismatch, viewport differences, missing targets on fast route changes). Also updates the `budget-matrix` step copy per D-09.

Output: Modified `TourProvider.tsx` (auto-start gating), modified `TourController.tsx` (viewport-aware target resolution + retry/skip-forward), new small helper module `lib/tour/viewport.ts`, and `lib/tour/steps.ts` content update for `budget-matrix`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/08-app-integration/08-CONTEXT.md
@.planning/phases/06-tour-infrastructure/06-CONTEXT.md
@.planning/phases/07-tour-ui-components/07-CONTEXT.md
@.planning/phases/08-app-integration/08-01-data-tour-attributes-PLAN.md
@nextjs/components/providers/TourProvider.tsx
@nextjs/components/tour/TourController.tsx
@nextjs/lib/tour/steps.ts

<interfaces>
<!-- Current TourProvider exports — do NOT change the context surface (Phase 6 D-07). -->
Current useTour() return shape (TourProvider.tsx lines 8-16):
```typescript
interface TourContextValue {
  isActive: boolean;
  currentStep: number;
  stepCount: number;
  next: () => void;
  back: () => void;
  skip: () => void;
  complete: () => void;
}
```
This shape is consumed by TourController.tsx (line 73). Do NOT add new fields to the context. Runtime retry/skip-forward state lives inside TourController as local state; if TourProvider needs to expose a new abort primitive, add it as `abort: () => void` which sets `isActive = false` and `currentStep = 0` WITHOUT calling the `/api/tour/complete` endpoint.

Current step shape (lib/tour/steps.ts lines 5-11):
```typescript
export interface TourStep {
  id: string;
  targetSelector: string;
  title: string;
  body: string;
  placement: 'top' | 'bottom' | 'left' | 'right';
}
```
Adding an optional `desktopOnly?: boolean` field is backward compatible. Per D-04 the runtime consults this flag + matchMedia to skip on mobile — config stays single-source-of-truth.

next-auth session user shape (already augmented in Phase 6):
```typescript
session.user as { hasSeenTour?: boolean; isDemoAccount?: boolean }
```

next/navigation imports available:
```typescript
import { usePathname, useRouter } from 'next/navigation';
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create lib/tour/viewport.ts helpers and update steps.ts (budget-matrix body + desktopOnly flag)</name>
  <files>nextjs/lib/tour/viewport.ts, nextjs/lib/tour/steps.ts</files>

  <read_first>
    - nextjs/lib/tour/steps.ts (current structure of TourStep interface and TOUR_STEPS array)
    - .planning/phases/08-app-integration/08-CONTEXT.md (D-02, D-04, D-09)
    - nextjs/components/layout/Sidebar.tsx (confirm `hidden lg:flex` breakpoint at line 278 — the 1024px figure comes from Tailwind's `lg:` default)
  </read_first>

  <action>
Two files. Task 1 is foundation for Task 2 (TourController consumes these helpers).

**1. Create `nextjs/lib/tour/viewport.ts`** (new file) with exactly this content:

```typescript
// ---------------------------------------------------------------------------
// Tour viewport and target resolution helpers
// ---------------------------------------------------------------------------
// Purpose: Centralized logic for (a) detecting desktop vs mobile viewport at
// the Tailwind `lg:` breakpoint (1024px) and (b) resolving a data-tour
// selector to the single visible element when multiple elements share the
// same data-tour value across responsive variants (e.g., sidebar-nav lives
// on the desktop <nav> AND the mobile hamburger button — only one is
// rendered/visible at a time).
//
// Rationale: Per Phase 8 D-04, step-skipping on mobile is done by the tour
// runtime, not by duplicating the steps config. This module is the runtime's
// source of truth for viewport decisions.
// ---------------------------------------------------------------------------

export const DESKTOP_MIN_WIDTH_PX = 1024;

/**
 * Returns true when the current viewport is at or above the desktop
 * breakpoint (1024px), matching the Tailwind `lg:` breakpoint used by
 * Sidebar.tsx `hidden lg:flex` / `lg:hidden` patterns.
 *
 * Safe to call in SSR — returns false when `window` is undefined.
 */
export function isDesktopViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(`(min-width: ${DESKTOP_MIN_WIDTH_PX}px)`).matches;
}

/**
 * Resolves a CSS selector to the first VISIBLE element (one whose rendered
 * bounding box has non-zero width AND height). Returns null if no element
 * matches OR no matched element is visible.
 *
 * Why "visible" rather than `document.querySelector` directly: when the
 * same `data-tour` attribute lives on both a desktop-only and a mobile-only
 * element, the CSS-hidden one still exists in the DOM with zero bounding
 * box. `document.querySelector` returns the first match in source order,
 * which may be the wrong (hidden) element. Filtering to visible elements
 * lets the same selector work on both viewports without runtime duplication.
 */
export function resolveVisibleTarget(selector: string): Element | null {
  if (typeof document === 'undefined') return null;
  const candidates = document.querySelectorAll(selector);
  for (const el of Array.from(candidates)) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return el;
    }
  }
  return null;
}
```

**2. Modify `nextjs/lib/tour/steps.ts`** to:
   (a) Add optional `desktopOnly?: boolean` field to the `TourStep` interface
   (b) Update the `budget-matrix` step body copy per D-09
   (c) Mark `project-switcher` as `desktopOnly: true` per D-02

   Change the interface block (lines 5-11):
   ```typescript
   export interface TourStep {
     id: string;
     targetSelector: string;
     title: string;
     body: string;
     placement: 'top' | 'bottom' | 'left' | 'right';
   }
   ```
   to:
   ```typescript
   export interface TourStep {
     id: string;
     targetSelector: string;
     title: string;
     body: string;
     placement: 'top' | 'bottom' | 'left' | 'right';
     /**
      * When true, the step is skipped entirely on viewports below the
      * desktop breakpoint (1024px). See lib/tour/viewport.ts and Phase 8
      * D-02 / D-04 for rationale. Undefined or false = shown on all viewports.
      */
     desktopOnly?: boolean;
   }
   ```

   Change the `budget-matrix` step (lines 35-41):
   ```typescript
   {
     id: 'budget-matrix',
     targetSelector: '[data-tour="budget-matrix"]',
     title: 'Budget Overview',
     body: 'See how spending compares to your budget across all categories.',
     placement: 'bottom',
   },
   ```
   to:
   ```typescript
   {
     id: 'budget-matrix',
     targetSelector: '[data-tour="budget-matrix"]',
     title: 'Spending Overview',
     body: 'See your spending broken down by category at a glance. Open Budget from the sidebar for the full matrix view.',
     placement: 'bottom',
   },
   ```
   (Title changes to match the dashboard chart's actual subject; body mentions that the full budget matrix lives in /budget without forcing navigation.)

   Change the `project-switcher` step (lines 42-48) to add `desktopOnly: true`:
   ```typescript
   {
     id: 'project-switcher',
     targetSelector: '[data-tour="project-switcher"]',
     title: 'Switch Projects',
     body: 'If you belong to multiple projects, switch between them here.',
     placement: 'bottom',
   },
   ```
   becomes:
   ```typescript
   {
     id: 'project-switcher',
     targetSelector: '[data-tour="project-switcher"]',
     title: 'Switch Projects',
     body: 'If you belong to multiple projects, switch between them here.',
     placement: 'bottom',
     desktopOnly: true,
   },
   ```

   Do NOT mark `sidebar-nav` as desktopOnly — it has a mobile analogue (hamburger button from Plan 01). Do NOT add desktopOnly to any other step. The `as const` assertion on line 56 stays.
  </action>

  <verify>
    <automated>cd nextjs && test -f lib/tour/viewport.ts && grep -q 'DESKTOP_MIN_WIDTH_PX = 1024' lib/tour/viewport.ts && grep -q 'resolveVisibleTarget' lib/tour/viewport.ts && grep -q 'isDesktopViewport' lib/tour/viewport.ts && grep -q 'desktopOnly?: boolean' lib/tour/steps.ts && grep -q 'desktopOnly: true' lib/tour/steps.ts && grep -q 'Spending Overview' lib/tour/steps.ts && npx tsc --noEmit</automated>
  </verify>

  <acceptance_criteria>
    - `nextjs/lib/tour/viewport.ts` file exists
    - `grep -c 'export function isDesktopViewport' nextjs/lib/tour/viewport.ts` prints `1`
    - `grep -c 'export function resolveVisibleTarget' nextjs/lib/tour/viewport.ts` prints `1`
    - `grep -c 'export const DESKTOP_MIN_WIDTH_PX = 1024' nextjs/lib/tour/viewport.ts` prints `1`
    - `viewport.ts` has the SSR guard: `grep -c "typeof window === 'undefined'" nextjs/lib/tour/viewport.ts` prints at least `1`
    - `resolveVisibleTarget` uses `getBoundingClientRect()` and filters on `width > 0 && height > 0` (grep for `width > 0 && height > 0` in viewport.ts)
    - `grep -c 'desktopOnly?: boolean' nextjs/lib/tour/steps.ts` prints `1`
    - `grep -c 'desktopOnly: true' nextjs/lib/tour/steps.ts` prints exactly `1` (only project-switcher)
    - `grep -n 'desktopOnly: true' nextjs/lib/tour/steps.ts` appears within the `project-switcher` step block (verify the preceding `id: 'project-switcher'` line)
    - `grep -c "title: 'Spending Overview'" nextjs/lib/tour/steps.ts` prints `1`
    - `grep -c "id: 'budget-matrix'" nextjs/lib/tour/steps.ts` prints `1` (id unchanged)
    - `cd nextjs && npx tsc --noEmit` exits 0
    - `cd nextjs && npm run lint` exits 0
  </acceptance_criteria>

  <done>
    The viewport helper module exists with both exports and an SSR guard; the steps file has the `desktopOnly` optional field, the `project-switcher` step carries `desktopOnly: true`, and the `budget-matrix` step has the updated title and body copy. TypeScript and ESLint clean.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Auto-start gating + one-shot dashboard push + settle delay in TourProvider.tsx</name>
  <files>nextjs/components/providers/TourProvider.tsx</files>

  <read_first>
    - nextjs/components/providers/TourProvider.tsx (current useEffect body lines 34-45)
    - .planning/phases/06-tour-infrastructure/06-CONTEXT.md (D-03 demo bypass, D-09 session-based init)
    - .planning/phases/08-app-integration/08-CONTEXT.md (D-05, D-07, D-11, D-12)
    - nextjs/app/(protected)/layout.tsx (to confirm TourProvider is mounted inside the protected layout so usePathname is valid)
  </read_first>

  <action>
Modify `TourProvider.tsx` to tighten the auto-start logic per D-11. The context value shape stays identical; only the useEffect body changes and two new imports are added.

**1. Add imports at the top of the file (after line 3, before the Phase 6 imports):**
```typescript
import { usePathname, useRouter } from 'next/navigation';
```
Final import block should look like:
```typescript
'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import { TOUR_STEPS } from '@/lib/tour/steps';
import { completeTour } from '@/lib/api/tour';
```
Note: add `useRef` to the existing react import — it's needed to guard against the one-shot push firing twice on fast re-renders.

**2. Inside the `TourProvider` function body, after the existing useState lines, add:**
```typescript
const pathname = usePathname();
const router = useRouter();
const hasPushedRef = useRef(false);
const autoStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
```

**3. Replace the entire existing auto-start useEffect (current lines 34-45) with this hardened version:**
```typescript
// Auto-start gating — Phase 8 D-11:
//   status === 'authenticated'
//   AND (isDemoAccount OR !hasSeenTour)    (Phase 6 D-03)
//   AND pathname === '/dashboard'           (D-05)
// If pathname is not /dashboard, trigger a one-shot router.push('/dashboard') (D-07),
// then wait for the effect to re-run after the route change.
// On match, wait ~150ms for the dashboard to paint before setIsActive(true) (D-11).
useEffect(() => {
  if (status !== 'authenticated' || !session?.user) return;

  const user = session.user as { hasSeenTour?: boolean; isDemoAccount?: boolean };
  const isDemoAccount = user.isDemoAccount ?? false;
  const hasSeenTour = user.hasSeenTour ?? false;

  // Eligibility check — D-12: demo users bypass hasSeenTour
  const eligible = isDemoAccount || !hasSeenTour;
  if (!eligible) return;

  // Already active — do not re-trigger
  if (isActive) return;

  // Pathname gate — D-05/D-07
  if (pathname !== '/dashboard') {
    // One-shot push to /dashboard; effect re-runs after navigation
    if (!hasPushedRef.current) {
      hasPushedRef.current = true;
      router.push('/dashboard');
    }
    return;
  }

  // Settle delay — D-11: let the dashboard paint before activating
  if (autoStartTimerRef.current) clearTimeout(autoStartTimerRef.current);
  autoStartTimerRef.current = setTimeout(() => {
    setIsActive(true);
    setCurrentStep(0);
    autoStartTimerRef.current = null;
  }, 150);

  return () => {
    if (autoStartTimerRef.current) {
      clearTimeout(autoStartTimerRef.current);
      autoStartTimerRef.current = null;
    }
  };
}, [status, session, pathname, router, isActive]);
```

**4. Do NOT modify the `next`, `back`, `skip`, `handleComplete` callbacks or the `value` object. The context surface is unchanged per Phase 6 D-07. The new refs are internal to the provider.**

**5. Add a new `abort` function (for use by TourController — see Task 3) BEFORE the `value` object:**
```typescript
// Abort tour WITHOUT marking hasSeenTour — used when every step skips for
// missing targets (Phase 8 D-10). Unlike skip() / handleComplete(), this
// does NOT call /api/tour/complete, so the user gets another chance on
// next login.
const abort = useCallback(() => {
  setIsActive(false);
  setCurrentStep(0);
  hasPushedRef.current = false;
}, []);
```
And add `abort` to the context value and the `TourContextValue` interface:
```typescript
interface TourContextValue {
  isActive: boolean;
  currentStep: number;
  stepCount: number;
  next: () => void;
  back: () => void;
  skip: () => void;
  complete: () => void;
  abort: () => void;
}
```
```typescript
const value: TourContextValue = {
  isActive,
  currentStep,
  stepCount,
  next,
  back,
  skip,
  complete: handleComplete,
  abort,
};
```
Rationale: The context surface gains ONE new method (`abort`). Phase 6 D-07 said "minimal context API surface" — `abort` is the minimum required addition to express D-10's "abort without calling completeTour" semantics. All existing consumers (TourController, TourTooltip) remain compatible.
  </action>

  <verify>
    <automated>cd nextjs && grep -q 'usePathname' components/providers/TourProvider.tsx && grep -q 'useRouter' components/providers/TourProvider.tsx && grep -q "pathname !== '/dashboard'" components/providers/TourProvider.tsx && grep -q "router.push('/dashboard')" components/providers/TourProvider.tsx && grep -q 'hasPushedRef' components/providers/TourProvider.tsx && grep -q '150' components/providers/TourProvider.tsx && grep -q 'abort: () => void' components/providers/TourProvider.tsx && grep -q 'abort,' components/providers/TourProvider.tsx && npx tsc --noEmit && npm run lint</automated>
  </verify>

  <acceptance_criteria>
    - `grep -c "import { usePathname, useRouter } from 'next/navigation'" nextjs/components/providers/TourProvider.tsx` prints `1`
    - `grep -c 'useRef' nextjs/components/providers/TourProvider.tsx` prints at least `2` (import + hasPushedRef declaration)
    - `grep -c "pathname !== '/dashboard'" nextjs/components/providers/TourProvider.tsx` prints `1`
    - `grep -c "router.push('/dashboard')" nextjs/components/providers/TourProvider.tsx` prints `1`
    - `grep -c 'hasPushedRef.current = true' nextjs/components/providers/TourProvider.tsx` prints `1`
    - `grep -c 'setTimeout' nextjs/components/providers/TourProvider.tsx` prints at least `1` (settle delay)
    - `grep -c '150' nextjs/components/providers/TourProvider.tsx` prints at least `1` (settle timeout value)
    - `grep -c 'isDemoAccount || !hasSeenTour' nextjs/components/providers/TourProvider.tsx` prints `1`
    - `grep -c 'abort: () => void' nextjs/components/providers/TourProvider.tsx` prints `1`
    - `grep -c 'abort,' nextjs/components/providers/TourProvider.tsx` prints at least `1`
    - Cleanup function clears the timeout: `grep -A1 'return () =>' nextjs/components/providers/TourProvider.tsx | grep -q 'clearTimeout'`
    - `cd nextjs && npx tsc --noEmit` exits 0
    - `cd nextjs && npm run lint` exits 0
  </acceptance_criteria>

  <done>
    TourProvider auto-start effect gates on pathname, performs a one-shot push to /dashboard, applies a 150ms settle delay, exposes a new `abort` method, and the existing context consumers still compile. Demo bypass and hasSeenTour logic preserved per Phase 6 D-03.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Viewport-aware target resolution + retry/skip-forward in TourController.tsx</name>
  <files>nextjs/components/tour/TourController.tsx</files>

  <read_first>
    - nextjs/components/tour/TourController.tsx (current target resolution effect lines 97-145 — contains the fallback-to-center behavior that must be replaced)
    - nextjs/lib/tour/viewport.ts (the helpers created in Task 1)
    - nextjs/lib/tour/steps.ts (updated with desktopOnly field in Task 1)
    - .planning/phases/08-app-integration/08-CONTEXT.md (D-02, D-03, D-10)
  </read_first>

  <action>
Modify `TourController.tsx` to:
  (a) Use `resolveVisibleTarget` instead of `document.querySelector` for step-target lookups,
  (b) Skip `desktopOnly` steps when `isDesktopViewport()` is false,
  (c) Implement retry-3-times-over-~500ms then silent skip-forward for missing targets,
  (d) Abort without completing when every remaining step skips.

Do NOT change positioning math, keyboard handling, focus management, resize handling, or the TourOverlay/TourTooltip render — only the target-resolution effect block.

**1. Add imports at the top of the file (after the existing imports):**
```typescript
import { resolveVisibleTarget, isDesktopViewport } from '@/lib/tour/viewport';
```

**2. Extract `abort` from useTour():**
Change line 73:
```typescript
const { isActive, currentStep, stepCount, next, back, skip, complete } = useTour();
```
to:
```typescript
const { isActive, currentStep, stepCount, next, back, skip, complete, abort } = useTour();
```

**3. Add a ref to track how many consecutive silent skips have occurred in this tour activation (used to detect "every step skipped"):**
Right after the existing `mountedRef` (around line 82), add:
```typescript
// Counts silent skip-forwards during the current activation. Reset to 0
// when the user performs any non-silent action (next/back/click). If it
// reaches stepCount, the tour aborts without marking completion (D-10).
const silentSkipCountRef = useRef(0);
```

**4. REPLACE the current target resolution effect (lines 97-145, the one starting `// Target location and positioning` and ending at the return-cleanup for scrollTimeout) with this new retry-aware version:**
```typescript
// ---------------------------------------------------------------------------
// Target location and positioning — Phase 8 D-02, D-04, D-10
// ---------------------------------------------------------------------------
// Behavior:
//   1. If step has desktopOnly=true AND viewport is mobile (<1024px), skip
//      forward silently (D-02).
//   2. Use resolveVisibleTarget (handles sidebar-nav dual-binding where the
//      same selector lives on both desktop nav and mobile hamburger — we
//      want the one with a non-zero bounding box).
//   3. If target is null, retry up to 3 times at ~160ms intervals (~500ms
//      total budget). On final failure, silently advance via next() and
//      increment silentSkipCountRef.
//   4. If silentSkipCountRef reaches stepCount, abort() the tour WITHOUT
//      calling completeTour — hasSeenTour stays false (D-10).
//   5. On successful resolution, reset silentSkipCountRef to 0.
useEffect(() => {
  if (!isActive) return;

  // Clean up aria-describedby on previous target
  if (prevSelectorRef.current) {
    const prevTarget = document.querySelector(prevSelectorRef.current);
    if (prevTarget) {
      prevTarget.removeAttribute('aria-describedby');
    }
  }

  // Guard: if every step has been silently skipped, abort without complete
  if (silentSkipCountRef.current >= stepCount) {
    silentSkipCountRef.current = 0;
    abort();
    return;
  }

  // Guard: desktopOnly steps on mobile — skip forward silently
  if (step.desktopOnly && !isDesktopViewport()) {
    silentSkipCountRef.current += 1;
    if (currentStep < stepCount - 1) {
      // Defer to next tick so we do not setState during render
      const skipTimer = setTimeout(() => {
        if (mountedRef.current) next();
      }, 0);
      return () => clearTimeout(skipTimer);
    }
    // Last step is desktopOnly and skipped — abort without complete
    silentSkipCountRef.current = 0;
    const abortTimer = setTimeout(() => {
      if (mountedRef.current) abort();
    }, 0);
    return () => clearTimeout(abortTimer);
  }

  // Retry loop: up to 3 attempts at ~160ms intervals (~500ms total)
  let attempts = 0;
  const maxAttempts = 3;
  const retryIntervalMs = 160;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let scrollTimer: ReturnType<typeof setTimeout> | null = null;

  const tryResolve = () => {
    if (!mountedRef.current) return;

    const targetEl = resolveVisibleTarget(step.targetSelector);

    if (!targetEl) {
      attempts += 1;
      if (attempts < maxAttempts) {
        retryTimer = setTimeout(tryResolve, retryIntervalMs);
        return;
      }
      // Final failure — silent skip-forward (D-10)
      console.warn(
        `Tour target not found after ${maxAttempts} attempts: ${step.targetSelector}. Silently advancing.`,
      );
      silentSkipCountRef.current += 1;
      setTargetRect(null); // clear any stale rect
      if (currentStep < stepCount - 1) {
        // Advance to next step on next tick
        const advanceTimer = setTimeout(() => {
          if (mountedRef.current) next();
        }, 0);
        retryTimer = advanceTimer;
        return;
      }
      // Last step and still missing — abort without complete
      silentSkipCountRef.current = 0;
      const abortTimer = setTimeout(() => {
        if (mountedRef.current) abort();
      }, 0);
      retryTimer = abortTimer;
      return;
    }

    // Target found — successful resolution resets the silent-skip counter
    silentSkipCountRef.current = 0;

    // Set aria-describedby on target element (preserved from Phase 7 D-14)
    targetEl.setAttribute('aria-describedby', 'tour-tooltip-body');
    prevSelectorRef.current = step.targetSelector;

    const measureAndSet = () => {
      if (!mountedRef.current) return;
      const rect = targetEl.getBoundingClientRect();
      setTargetRect(rect);
    };

    // Auto-scroll if target is off-screen (preserved from Phase 7 D-07)
    if (!isInViewport(targetEl)) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      scrollTimer = setTimeout(measureAndSet, 300);
    } else {
      measureAndSet();
    }
  };

  tryResolve();

  return () => {
    if (retryTimer) clearTimeout(retryTimer);
    if (scrollTimer) clearTimeout(scrollTimer);
  };
}, [isActive, currentStep, step, stepCount, next, abort]);
```

**5. Do NOT touch** the tooltip-positioning effect (lines 150-161), the resize handler (lines 166-194), the keyboard handler (lines 199-239), the focus management (lines 244-254), the final aria cleanup (lines 259-267), or the render block (lines 272-291).

**6. The resize handler (lines 166-194) currently also does `document.querySelector(step.targetSelector)` and falls back to center if null. Update it to use `resolveVisibleTarget` for consistency — but keep the center fallback there (resize is a transient mid-tour event, not an initial load, and we do NOT want to trigger the skip-forward loop on a momentary resize glitch):**
Change:
```typescript
const targetEl = document.querySelector(step.targetSelector);
if (targetEl) {
  const rect = targetEl.getBoundingClientRect();
  setTargetRect(rect);
} else {
  setTargetRect(null);
  setTooltipPosition({
    top: window.innerHeight / 2 - 100,
    left: window.innerWidth / 2 - 170,
  });
}
```
to:
```typescript
const targetEl = resolveVisibleTarget(step.targetSelector);
if (targetEl) {
  const rect = targetEl.getBoundingClientRect();
  setTargetRect(rect);
} else {
  setTargetRect(null);
  setTooltipPosition({
    top: window.innerHeight / 2 - 100,
    left: window.innerWidth / 2 - 170,
  });
}
```
Just the `document.querySelector` → `resolveVisibleTarget` swap. Do NOT add retry or skip-forward here.
  </action>

  <verify>
    <automated>cd nextjs && grep -q "from '@/lib/tour/viewport'" components/tour/TourController.tsx && grep -q 'resolveVisibleTarget' components/tour/TourController.tsx && grep -q 'isDesktopViewport' components/tour/TourController.tsx && grep -q 'silentSkipCountRef' components/tour/TourController.tsx && grep -q 'maxAttempts = 3' components/tour/TourController.tsx && grep -q 'retryIntervalMs = 160' components/tour/TourController.tsx && grep -q 'abort()' components/tour/TourController.tsx && grep -q 'step.desktopOnly' components/tour/TourController.tsx && npx tsc --noEmit && npm run lint</automated>
  </verify>

  <acceptance_criteria>
    - `grep -c "import { resolveVisibleTarget, isDesktopViewport } from '@/lib/tour/viewport'" nextjs/components/tour/TourController.tsx` prints `1`
    - `grep -c 'abort }' nextjs/components/tour/TourController.tsx || grep -c ', abort' nextjs/components/tour/TourController.tsx` shows abort is destructured from useTour
    - `grep -c 'silentSkipCountRef' nextjs/components/tour/TourController.tsx` prints at least `4` (declaration + increments + resets + comparison)
    - `grep -c 'maxAttempts = 3' nextjs/components/tour/TourController.tsx` prints `1`
    - `grep -c '160' nextjs/components/tour/TourController.tsx` prints at least `1` (retry interval)
    - `grep -c 'step.desktopOnly && !isDesktopViewport' nextjs/components/tour/TourController.tsx` prints `1`
    - `grep -c 'resolveVisibleTarget(step.targetSelector)' nextjs/components/tour/TourController.tsx` prints at least `2` (main resolution + resize handler)
    - `grep -c 'silentSkipCountRef.current >= stepCount' nextjs/components/tour/TourController.tsx` prints `1`
    - `grep -c 'silentSkipCountRef.current = 0' nextjs/components/tour/TourController.tsx` prints at least `1` (reset on successful resolution)
    - Retry path does NOT call `complete()` — `grep -B1 -A1 'abort()' nextjs/components/tour/TourController.tsx` shows abort, never `complete()` in the missing-target branch
    - `cd nextjs && npx tsc --noEmit` exits 0
    - `cd nextjs && npm run lint` exits 0
  </acceptance_criteria>

  <done>
    TourController uses the viewport helpers, retries missing targets 3x over ~500ms, silently advances on final failure, tracks consecutive silent skips, aborts (without marking complete) when every step skips, skips desktopOnly steps on mobile, and does not break any existing Phase 7 behavior (positioning, keyboard, focus, aria).
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| session.user (JWT) → TourProvider state | Already-validated server data — no untrusted input. |
| URL pathname (usePathname) → gate condition | Compared against hard-coded literal `'/dashboard'`; attacker-controllable path cannot bypass the gate to activate on a wrong route (it just does nothing). |
| CSS selector (step.targetSelector) → document.querySelector(All) | Selectors are static literals from TOUR_STEPS; they are never derived from user input. Even if they were, `querySelectorAll` with a CSS selector cannot execute code. |
| router.push('/dashboard') | Static literal argument; no open-redirect vector. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-08-04 | Tampering | TourProvider auto-start gating | accept | The `eligible` computation reads `hasSeenTour` and `isDemoAccount` from the JWT session — already validated server-side by NextAuth. A malicious client flipping these in dev tools only affects their own session. Severity: low. |
| T-08-05 | Denial of Service | Retry loop in TourController | mitigate | `maxAttempts = 3` is a hard literal upper bound; total retry window is bounded at ~500ms. No unbounded re-entry because `silentSkipCountRef.current >= stepCount` aborts after every step has been tried once. Severity: low. Mitigation location: `TourController.tsx` retry effect. |
| T-08-06 | Tampering | CSS selector injection via targetSelector | accept | All selectors are hard-coded literals in `lib/tour/steps.ts`. No user input path reaches `document.querySelectorAll`. Severity: low. |
| T-08-07 | Elevation of Privilege | One-shot `router.push('/dashboard')` | accept | Destination is a static literal `'/dashboard'`; an authenticated user already has access to it (protected route). Severity: low. |
| T-08-08 | Information Disclosure | `console.warn` logging of missing targets | accept | Warning emits only the selector string (e.g. `[data-tour="sidebar-nav"]`) — no PII, no session data. Severity: low. |
| T-08-09 | Spoofing | Demo user bypass of `hasSeenTour` | accept | `isDemoAccount` is JWT-backed per Phase 6; cannot be faked client-side. Already audited in Phase 6. Severity: low. |

No high-severity threats. Plan passes security gate.
</threat_model>

<verification>
After all three tasks:

1. Build: `cd nextjs && npx tsc --noEmit` exits 0
2. Lint: `cd nextjs && npm run lint` exits 0
3. Unit sanity of new helpers:
   ```
   cd nextjs && node -e "
     const { isDesktopViewport, DESKTOP_MIN_WIDTH_PX, resolveVisibleTarget } = require('./lib/tour/viewport');
     console.log('DESKTOP_MIN_WIDTH_PX:', DESKTOP_MIN_WIDTH_PX);
     console.log('isDesktopViewport (SSR guard):', isDesktopViewport());
     console.log('resolveVisibleTarget (SSR guard):', resolveVisibleTarget('.nothing'));
   "
   ```
   Expected: `1024`, `false`, `null`. (Node has no window/document; verifies SSR guards.)
   Note: if the helper is ESM-only, run via a small TS harness or skip this check and rely on the type-check + lint.
4. Grep verification of key behaviors:
   - `grep -c "pathname !== '/dashboard'" nextjs/components/providers/TourProvider.tsx` = 1
   - `grep -c "silentSkipCountRef" nextjs/components/tour/TourController.tsx` ≥ 4
   - `grep -c "desktopOnly: true" nextjs/lib/tour/steps.ts` = 1
5. Manual spot-check: load `/dashboard` as a demo user in dev; tour should activate after ~150ms, step 1 should spotlight the sidebar nav on desktop, and (after resizing the browser below 1024px then refreshing) skip the project-switcher step. (This step is documented; the execute-phase verifier will run it.)
</verification>

<success_criteria>
- TourProvider gates auto-start on pathname and settle delay; performs at most one router.push when landing off /dashboard
- TourController handles missing targets via retry (3x, ~500ms) then silent skip-forward
- When every step skips, the tour aborts WITHOUT calling completeTour — hasSeenTour stays false
- `desktopOnly` steps (currently: project-switcher) are skipped on viewports <1024px
- `sidebar-nav` step resolves to whichever of its two bindings (desktop nav / mobile hamburger) is visible
- `budget-matrix` step body matches the dashboard's "Spending by Category" chart
- No UI state is mutated by the tour (no drawer opened, no route navigation beyond the one-shot /dashboard push)
- Full TS build and lint pass
</success_criteria>

<output>
After completion, create `.planning/phases/08-app-integration/08-02-SUMMARY.md` documenting: files modified, the retry/skip-forward mechanism, viewport resolution behavior, and any deviations.
</output>
