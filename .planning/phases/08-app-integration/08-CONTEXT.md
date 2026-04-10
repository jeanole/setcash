# Phase 8: App Integration - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire the already-built tour (Phase 6 infrastructure, Phase 7 UI components) into the live SetCash application. Add `data-tour` attributes to real UI elements, make auto-start robust against race conditions and missing targets, adapt the tour for mobile viewports, and verify theme parity. This phase does NOT add new tour features — it only lands the existing tour inside the app.

</domain>

<decisions>
## Implementation Decisions

### Mobile Strategy
- **D-01:** Mobile breakpoint for tour adaptation is `lg:` = 1024px — matches the actual breakpoint where `Sidebar.tsx` hides the desktop sidebar (`hidden lg:flex`). INTG-03's "768px" figure is stale and must be corrected.
- **D-02:** On viewports < 1024px:
  - `project-switcher` step is **skipped entirely** (hidden inside closed drawer, no mobile analogue).
  - `sidebar-nav` step is **retargeted to the mobile hamburger button** (the toggle that opens the drawer). The user learns how to reach navigation without the tour controlling drawer state.
- **D-03:** No drawer auto-opening. Tour never mutates UI state (drawer open/closed) — it only highlights existing elements.
- **D-04:** Step-skipping on mobile is done by the tour runtime, not by duplicating the steps config. The step config stays a single source of truth; the runtime consults `window.matchMedia('(min-width: 1024px)')` (or equivalent) to decide whether a step is eligible.

### Cross-Page Target Flow
- **D-05:** Tour **always starts on `/dashboard`**. If auto-start fires while the user is on a different route, TourProvider waits for `usePathname() === '/dashboard'` before flipping `isActive` (or navigates there — see D-07).
- **D-06:** Tour does **NOT force-navigate between pages during the tour**. All steps must have their targets present on `/dashboard`. Steps whose targets don't exist on dashboard use the skip-forward mechanism (D-10).
- **D-07:** On first-login auto-start, if the post-login landing page is not `/dashboard`, TourProvider triggers a single `router.push('/dashboard')` before activating. After that, no further navigation is performed by the tour.

### data-tour Attribute Placement
- **D-08:** `data-tour` attributes attach to the **smallest visible interactive element** that represents the feature, not to semantic wrapper sections. Tighter spotlight, clearer UX.
- **D-09:** Mapping of the 6 steps to dashboard targets:
  - `sidebar-nav` → desktop: the `<nav>` inside desktop sidebar (`Sidebar.tsx`); mobile: the hamburger toggle button.
  - `project-switcher` → `ProjectSwitcher.tsx` root element (desktop only; skipped on mobile).
  - `submit-bill` → the "Submit bill" action inside `QuickActions.tsx` on the dashboard.
  - `bill-list` → `RecentBillsList.tsx` root element on the dashboard (not the full `/bills` page).
  - `budget-matrix` → **retargeted** to the "Spending by Category" chart container inside `DashboardClient.tsx`. Step body copy should be adjusted to reflect "spending overview" instead of literal budget matrix. `lib/tour/steps.ts` needs a content update as part of this phase.
  - `user-menu` → a profile button in `Header.tsx`. If Header does not currently expose a distinct profile button, introduce a minimal one as part of this phase (does not require a new modal — may open existing `ProfileModal`).

### Auto-Start & Missing Targets
- **D-10:** Missing-target handling: if the current step's target selector returns null, the tour runtime retries up to 3 times over ~500ms (requestAnimationFrame or short setTimeout loop). If still missing, **advance to next step silently**. If every step skips (tour ends without showing any step), **abort the tour without calling `completeTour()`** — `hasSeenTour` stays false so the user gets another chance on next login.
- **D-11:** Auto-start gating (update `TourProvider.tsx` effect):
  - Condition: `status === 'authenticated'` AND `(isDemoAccount || !hasSeenTour)` AND `usePathname() === '/dashboard'`.
  - After conditions met, add a ~150ms settle delay before `setIsActive(true)` to let the dashboard paint.
  - If auto-start fires on a non-dashboard route, trigger `router.push('/dashboard')` first (D-07), then the pathname-match branch activates it.
- **D-12:** Demo users bypass `hasSeenTour` per Phase 6 D-03 — unchanged. All of D-10 / D-11 applies equally to demo users.

### Theme Support
- **D-13:** Phase 7 components already use `dark:` modifiers and `--vb-*` CSS custom properties. Phase 8 does **verification only** — manual QA pass switching theme mid-tour. If contrast issues surface, patch inline via existing CSS vars. No new tour-specific design tokens.

### Requirements Drift Correction
- **D-14:** INTG-03 acceptance criterion must be updated in `.planning/REQUIREMENTS.md` from "below 768px" to "below 1024px" (or "at the lg: breakpoint") as part of this phase's tasks. Document the correction in the execution commit.

### Claude's Discretion
- Exact mechanism for the retry-then-skip loop in D-10 (timer vs rAF vs MutationObserver)
- Exact placement and styling of the new profile button in Header if one needs adding (D-09, `user-menu`)
- Whether to expose the 1024px breakpoint as a CSS var / constant or inline the media query
- Updated wording for `budget-matrix` step body in `lib/tour/steps.ts` (D-09)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 6 & 7 artifacts (consumed by this phase)
- `nextjs/components/providers/TourProvider.tsx` — Auto-start effect lives here; D-10/D-11 modify it
- `nextjs/lib/tour/steps.ts` — `TOUR_STEPS` array; `budget-matrix` body copy updated per D-09
- `nextjs/components/tour/TourController.tsx` — Orchestrator that reads current step and renders overlay/tooltip
- `nextjs/components/tour/TourOverlay.tsx` — Spotlight cutout
- `nextjs/components/tour/TourTooltip.tsx` — Tooltip with theme classes already in place
- `.planning/phases/06-tour-infrastructure/06-CONTEXT.md` — D-03 demo bypass, D-09 JWT session gating
- `.planning/phases/07-tour-ui-components/07-CONTEXT.md` — Theme strategy (`dark:` + `--vb-*` vars)

### Target host components (get data-tour attributes)
- `nextjs/components/layout/Sidebar.tsx` — desktop sidebar `<nav>` (sidebar-nav desktop) and mobile hamburger button (sidebar-nav mobile)
- `nextjs/components/layout/ProjectSwitcher.tsx` — project-switcher target (desktop only)
- `nextjs/components/layout/Header.tsx` — host for user-menu profile button
- `nextjs/components/dashboard/QuickActions.tsx` — submit-bill target
- `nextjs/components/dashboard/RecentBillsList.tsx` — bill-list target
- `nextjs/components/dashboard/DashboardClient.tsx` — budget-matrix retargeted to Spending by Category chart container

### Theme & responsive patterns
- `nextjs/components/layout/ThemeProvider.tsx` — `data-theme` attribute on `<html>`, `theme` state
- `nextjs/app/globals.css` — `--vb-*` design tokens, dark mode via `[data-theme="dark"]`
- Sidebar.tsx lines ~278 / ~321 — existing `hidden lg:flex` / `lg:hidden` breakpoint pattern to mirror

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — INTG-01 through INTG-04 (INTG-03 drift to be corrected per D-14)
- `.planning/ROADMAP.md` §Phase 8 — Goal + success criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TourProvider` auto-start effect is already written — Phase 8 extends its condition set (add pathname check + settle delay)
- `useSession()` already exposes `hasSeenTour` and `isDemoAccount` (Phase 6 D-02)
- `usePathname` and `useRouter` from `next/navigation` available in any `'use client'` component
- `cn()` utility from `@/lib/utils` for conditional classes
- Dashboard's `KpiCard`, `QuickActions`, `RecentBillsList` are all rendered unconditionally on `/dashboard` — safe targets

### Established Patterns
- Responsive breakpoints in the app use `lg:` (1024px) as the "mobile vs desktop" divide, NOT `md:` (768px). Tour must follow the same convention.
- Theming via `data-theme="dark"` selector + `--vb-*` CSS custom properties; Phase 7 UI already honors this.
- Dashboard is Server Component → Client Component (`DashboardClient`). `data-tour` attributes land on the client components.

### Integration Points
- `TourProvider.tsx` useEffect — add pathname gate + settle delay
- `lib/tour/steps.ts` — update `budget-matrix` body copy; no structural change to schema
- 6 host components — each gets a `data-tour` attribute on the smallest interactive element
- `Header.tsx` — may need a minimal profile button if one doesn't exist
- `.planning/REQUIREMENTS.md` INTG-03 — text edit from "768px" → "1024px" to match reality

</code_context>

<specifics>
## Specific Ideas

- "Tour never mutates UI state" — tour must not open the mobile drawer programmatically. It only highlights what's already visible.
- "Smallest visible interactive element" — tighter spotlight is the design preference.
- The tour stopping without marking `hasSeenTour` when every step skips — give the user a second chance rather than silently burning their one onboarding shot.

</specifics>

<deferred>
## Deferred Ideas

- Force-navigating between pages for a richer multi-page tour — out of scope; would require per-step routing and transition handling. Revisit if v2 tour expands beyond dashboard.
- Dedicated `--vb-tour-*` CSS variables — skipped in favor of reusing existing tokens (D-13). Revisit only if contrast issues appear.
- Introducing a separate 768–1023px "tablet" handling zone — not worth the complexity; tour uses binary < lg / ≥ lg split.
- TOUR-01 through TOUR-04 (admin customization, analytics, i18n, context-sensitive tooltips) — already deferred to v2 per REQUIREMENTS.md.

</deferred>

---

*Phase: 08-app-integration*
*Context gathered: 2026-04-10*
