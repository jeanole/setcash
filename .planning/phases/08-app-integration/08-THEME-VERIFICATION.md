# Phase 8 — Theme Verification Checklist

**Purpose:** Manual QA pass confirming that the tour tooltip and overlay render correctly in both light and dark themes with the integrated tour (post-Plan 01 + Plan 02). Per Phase 8 D-13, this phase does NOT introduce new tour-specific design tokens — Phase 7's `dark:` modifiers and `--vb-*` custom properties are reused as-is.

**Scope:** Verification only. If contrast issues surface, they are recorded in `features/BUG-*.md` as follow-ups. Plan 03 does not patch visual issues; if a blocker is found, this plan returns NEEDS REVISION instead.

---

## Pre-requisites

1. Plans 08-01 and 08-02 have been executed and committed.
2. `cd nextjs && npm run dev` starts cleanly.
3. A demo account (`isDemoAccount = true`) exists — the tour fires on every login for demo users, which is the simplest way to retrigger the tour without database manipulation.

## Verification Steps

### Step 1 — Light theme tour activation
1. Sign in as the demo user.
2. Confirm landing on `/dashboard` (or observe a single redirect if landing elsewhere).
3. After ~150ms, the tour should activate with step 1 (`sidebar-nav`).
4. Observe the tooltip:
   - [ ] Tooltip background is light (white / near-white per `--vb-*` token)
   - [ ] Tooltip body text is dark and readable
   - [ ] Arrow color matches the tooltip background
   - [ ] Overlay dims the rest of the page without obscuring the spotlit target
   - [ ] Buttons (Skip / Back / Next / Done) use the app's primary accent color

### Step 2 — Theme toggle MID-TOUR
1. Without dismissing the tour, toggle the theme via the existing theme switcher (or set `data-theme="dark"` on `<html>` via dev tools).
2. Observe:
   - [ ] Tooltip background flips to dark
   - [ ] Body text remains readable (light on dark)
   - [ ] Arrow color updates to match new background
   - [ ] Overlay opacity does not cause the target to become invisible
   - [ ] No flashing / layout shift — transition is clean (expected, because `dark:` classes are instant)

### Step 3 — Dark theme fresh activation
1. Set theme to dark before login.
2. Sign out, sign in again as the demo user.
3. The tour re-activates in dark theme.
4. Step through all 6 steps (Next button) on a ≥1024px viewport. For each step:
   - [ ] Tooltip renders with readable contrast
   - [ ] Spotlight cutout is crisp
   - [ ] Text is legible against the tooltip background
   - [ ] Step indicator dots are visible

### Step 4 — Mobile viewport in dark theme
1. Resize the browser to <1024px (or use dev tools device mode, e.g. 390×844).
2. Reload. Tour should reactivate (demo user).
3. Verify:
   - [ ] Step 1 (`sidebar-nav`) spotlights the hamburger button in the header, NOT a hidden desktop nav
   - [ ] `project-switcher` step is SKIPPED (step index advances without flashing a broken tooltip)
   - [ ] All other steps render within the viewport bounds (no tooltip clipped off-screen)
   - [ ] Dark theme still applies correctly on mobile

### Step 5 — Missing target silent skip (sanity check)
1. In dev tools, manually remove one of the `data-tour` attributes from a target mid-tour (e.g. inspect `[data-tour="bill-list"]` and delete the attribute).
2. Click Next until that step would show.
3. Verify:
   - [ ] After ~500ms retry window, the tour silently advances (no centered fallback tooltip)
   - [ ] Console shows the warning: `Tour target not found after 3 attempts: [data-tour="bill-list"]. Silently advancing.`
   - [ ] Tour continues to the next step without UI breakage
   - [ ] Only if ALL remaining targets are removed: tour aborts and `hasSeenTour` is still false (verify via `useSession()` in dev tools or re-login to see the tour trigger again)

## Outcome Recording

At the bottom of the SUMMARY for this plan, record:
- `[ ] All checklist items pass` → phase complete
- `[ ] Issues found: <description, screenshot paths>` → log BUG-* and decide whether to block the phase

## Notes for the verifier agent

- Do NOT attempt to automate this check via Puppeteer/Playwright — per D-13 this is intentionally a manual QA pass, and the test harness is out of scope for this phase.
- The checklist is authoritative; any deviation must be recorded in SUMMARY with rationale.
