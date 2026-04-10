---
phase: 08-app-integration
plan: 03
type: execute
wave: 3
depends_on:
  - 08-02
files_modified:
  - .planning/REQUIREMENTS.md
  - .planning/phases/08-app-integration/08-THEME-VERIFICATION.md
autonomous: false
requirements:
  - INTG-03
  - INTG-04
user_setup: []

must_haves:
  truths:
    - "REQUIREMENTS.md INTG-03 reflects the actual codebase breakpoint (1024px / lg:) instead of the stale 768px figure"
    - "A documented theme verification checklist exists for the execute-phase verifier to follow"
    - "No new tour-specific CSS tokens are introduced — Phase 7's dark: + --vb-* strategy is reused as-is (D-13)"
    - "Theme verification is user-performed (checkpoint), not automated — per D-13 this is a manual QA pass"
  artifacts:
    - path: ".planning/REQUIREMENTS.md"
      provides: "Corrected INTG-03 text"
      contains: "1024"
    - path: ".planning/phases/08-app-integration/08-THEME-VERIFICATION.md"
      provides: "Step-by-step theme QA checklist (what to toggle, what to watch for)"
  key_links:
    - from: ".planning/REQUIREMENTS.md INTG-03"
      to: "nextjs/components/layout/Sidebar.tsx 'hidden lg:flex' (line 278)"
      via: "matching textual breakpoint to Tailwind lg: default (1024px)"
      pattern: "1024"
---

<objective>
Close two small but important loose ends of Phase 8:

1. **Requirements drift correction (D-14):** Update `.planning/REQUIREMENTS.md` INTG-03 from the stale "768px" figure to the actual codebase breakpoint (1024px / the `lg:` Tailwind default). The 768px figure was a planning-stage assumption; reality uses `lg:` to divide desktop from mobile.
2. **Theme verification checklist (D-13):** Produce a documented manual QA pass that the execute-phase verifier agent will walk through — Phase 7 already implemented theme parity via `dark:` modifiers and `--vb-*` vars, so Phase 8 only verifies, it does not patch. If contrast issues surface, they are recorded as a follow-up and do not block this phase.

Purpose: Satisfy INTG-03 (mobile adaptation correctly specified) and INTG-04 (theme parity verified end-to-end with the live integrated tour from Plans 01+02).
Output: Edited REQUIREMENTS.md, new theme verification checklist file, and a human-verify checkpoint that captures the result.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/REQUIREMENTS.md
@.planning/phases/08-app-integration/08-CONTEXT.md
@.planning/phases/07-tour-ui-components/07-CONTEXT.md
@nextjs/components/tour/TourTooltip.tsx
@nextjs/components/tour/TourOverlay.tsx
@nextjs/app/globals.css

<interfaces>
<!-- Current REQUIREMENTS.md INTG-03 text (verbatim from line 28 of the file): -->
`- [ ] **INTG-03**: Tour steps adapt or skip gracefully on mobile viewports`

Note: The INTG-03 bullet in REQUIREMENTS.md itself does not contain "768px" — the 768px figure is mentioned in the ROADMAP.md Phase 8 success criterion #3: "On mobile viewports (below 768px)". The D-14 correction spans both files.

Actual breakpoint usage in the codebase:
- `nextjs/components/layout/Sidebar.tsx:278` → `className="hidden lg:flex ..."` (desktop sidebar hidden on <1024px)
- `nextjs/components/layout/Sidebar.tsx:321` → `className="lg:hidden fixed inset-0 ..."` (mobile drawer hidden on ≥1024px)
- `nextjs/components/layout/Header.tsx:37` → `className="lg:hidden ..."` (hamburger hidden on ≥1024px)

`lg:` is the Tailwind default breakpoint of 1024px.

Phase 7 theme primitives already in place (from `nextjs/components/tour/TourTooltip.tsx`):
- `dark:` Tailwind modifiers for tooltip bg / text / arrow colors
- `var(--vb-*)` custom properties from `globals.css` for accent, shadow, border colors
- Dark mode activated by `[data-theme="dark"]` on `<html>` (set by ThemeProvider)
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Correct INTG-03 breakpoint in REQUIREMENTS.md and ROADMAP.md</name>
  <files>.planning/REQUIREMENTS.md, .planning/ROADMAP.md</files>

  <read_first>
    - .planning/REQUIREMENTS.md (line ~28, INTG-03 bullet — currently lacks a specific pixel figure)
    - .planning/ROADMAP.md (line ~131, Phase 8 success criterion #3 — contains "below 768px")
    - .planning/phases/08-app-integration/08-CONTEXT.md (D-01, D-14)
    - nextjs/components/layout/Sidebar.tsx line 278 (confirm `hidden lg:flex` is the authoritative breakpoint)
  </read_first>

  <action>
Two edits. Both add the correct 1024px figure and annotate the correction reason inline so the git history is self-explanatory.

**1. `.planning/REQUIREMENTS.md` — expand the INTG-03 bullet (line 28):**
Change:
```markdown
- [ ] **INTG-03**: Tour steps adapt or skip gracefully on mobile viewports
```
to:
```markdown
- [ ] **INTG-03**: Tour steps adapt or skip gracefully on viewports below 1024px (the Tailwind `lg:` breakpoint used by Sidebar.tsx `hidden lg:flex` / `lg:hidden`). Corrected from initial "768px" assumption per Phase 8 CONTEXT.md D-14.
```

**2. `.planning/ROADMAP.md` — Phase 8 success criterion #3 (line ~131):**
Change:
```markdown
  3. On mobile viewports (below 768px), tour steps that target elements not visible or not meaningful on mobile are either skipped or repositioned — the tour completes without broken positioning or invisible targets
```
to:
```markdown
  3. On mobile viewports (below 1024px, matching the Tailwind `lg:` breakpoint used by the sidebar), tour steps that target elements not visible or not meaningful on mobile are either skipped or repositioned — the tour completes without broken positioning or invisible targets
```

Do NOT rewrite any other requirement text. Do NOT change the traceability table at the bottom of REQUIREMENTS.md. Do NOT change any other roadmap content.
  </action>

  <verify>
    <automated>grep -q "below 1024px" .planning/REQUIREMENTS.md && grep -q "below 1024px" .planning/ROADMAP.md && ! grep -q "below 768px" .planning/ROADMAP.md</automated>
  </verify>

  <acceptance_criteria>
    - `grep -c "below 1024px" .planning/REQUIREMENTS.md` prints `1`
    - `grep -c "below 1024px" .planning/ROADMAP.md` prints `1`
    - `grep -c "below 768px" .planning/ROADMAP.md` prints `0`
    - `grep -c "D-14" .planning/REQUIREMENTS.md` prints `1` (annotation for git blame traceability)
    - The INTG-03 bullet text still starts with `- [ ] **INTG-03**:` (checkbox and ID unchanged)
    - `grep -c "| INTG-03 | Phase 8 | Pending |" .planning/REQUIREMENTS.md` prints `1` (traceability row untouched)
    - No other REQUIREMENTS.md bullets were edited (run `git diff .planning/REQUIREMENTS.md` and verify only the INTG-03 line changed)
    - No other ROADMAP.md lines were edited except success criterion #3 of Phase 8 (run `git diff .planning/ROADMAP.md` and verify only one line changed)
  </acceptance_criteria>

  <done>
    Both files consistently reference 1024px as the mobile/desktop divide, the correction is annotated with a D-14 reference, and no unrelated content was altered.
  </done>
</task>

<task type="auto">
  <name>Task 2: Create theme verification checklist file</name>
  <files>.planning/phases/08-app-integration/08-THEME-VERIFICATION.md</files>

  <read_first>
    - .planning/phases/07-tour-ui-components/07-CONTEXT.md (theme decisions)
    - .planning/phases/08-app-integration/08-CONTEXT.md (D-13)
    - nextjs/components/tour/TourTooltip.tsx (confirm `dark:` modifiers present)
    - nextjs/components/tour/TourOverlay.tsx (confirm overlay opacity logic)
    - nextjs/app/globals.css (confirm `--vb-*` tokens and `[data-theme="dark"]` selector exist)
  </read_first>

  <action>
Create `.planning/phases/08-app-integration/08-THEME-VERIFICATION.md` with exactly the following content. This file is consumed by the execute-phase verifier agent; it is NOT a runtime artifact.

```markdown
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
```

This file is the primary artifact of Task 2. No other files are created.
  </action>

  <verify>
    <automated>test -f .planning/phases/08-app-integration/08-THEME-VERIFICATION.md && grep -q "Theme Verification Checklist" .planning/phases/08-app-integration/08-THEME-VERIFICATION.md && grep -q "data-theme=\"dark\"" .planning/phases/08-app-integration/08-THEME-VERIFICATION.md && grep -q "sidebar-nav" .planning/phases/08-app-integration/08-THEME-VERIFICATION.md && grep -q "Silently advancing" .planning/phases/08-app-integration/08-THEME-VERIFICATION.md</automated>
  </verify>

  <acceptance_criteria>
    - File `.planning/phases/08-app-integration/08-THEME-VERIFICATION.md` exists
    - File contains 5 numbered verification steps (`grep -c '^### Step' .planning/phases/08-app-integration/08-THEME-VERIFICATION.md` prints `5`)
    - File references `[data-theme="dark"]` for dark mode activation pattern
    - File references the specific `data-tour` selectors from Plan 01 (`sidebar-nav`, `project-switcher`, `bill-list`) to ensure the verification actually tests Phase 8's work
    - File explicitly notes the "no automation" decision per D-13 (`grep -c "manual QA pass" .planning/phases/08-app-integration/08-THEME-VERIFICATION.md` prints at least `1`)
    - File includes the missing-target silent skip sanity check tied to Plan 02 Task 3
  </acceptance_criteria>

  <done>
    The theme verification checklist file exists with all 5 steps and is consumable by the execute-phase verifier agent without further interpretation.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Human theme verification pass</name>
  <files>.planning/phases/08-app-integration/08-THEME-VERIFICATION.md</files>

  <action>
Walk through the 5-step checklist in `.planning/phases/08-app-integration/08-THEME-VERIFICATION.md` against a running dev server (`cd nextjs && npm run dev`) with a demo account signed in. Observe light theme, dark theme, mid-tour theme switching, mobile viewport behavior, and the missing-target silent-skip sanity check. Record per-step pass/fail in the SUMMARY file produced for this plan.
  </action>

  <verify>
    <automated>test -f .planning/phases/08-app-integration/08-03-SUMMARY.md && grep -qE "approved|issues:" .planning/phases/08-app-integration/08-03-SUMMARY.md</automated>
  </verify>

  <done>
    User has walked through all 5 checklist steps and recorded the outcome (approved or issues:) in the plan SUMMARY. If issues were found, each has a disposition (block phase / file BUG / accept and continue).
  </done>

  <what-built>
Plans 01 and 02 wired the tour into the app (`data-tour` attributes, auto-start gating, mobile adaptation, retry+skip-forward, updated step copy). Plan 03 Task 2 produced `.planning/phases/08-app-integration/08-THEME-VERIFICATION.md` — a 5-step manual QA checklist.

This checkpoint asks the user to walk through that checklist against a running dev server.
  </what-built>

  <how-to-verify>
1. Pull the latest commits from Plans 01 + 02 + 03 Tasks 1-2
2. `cd nextjs && npm run dev`
3. Open `.planning/phases/08-app-integration/08-THEME-VERIFICATION.md` in a split pane
4. Walk through all 5 steps of the checklist, ticking boxes as you go
5. For each step, observe the tour in light theme first, then dark theme
6. Pay special attention to:
   - Mobile viewport (<1024px) skipping the `project-switcher` step
   - `sidebar-nav` step spotlighting the correct element on both desktop and mobile
   - Mid-tour theme switching (tooltip colors should update instantly)
   - Missing-target silent skip (delete a `data-tour` attribute in dev tools, see the retry warning + silent advance)

7. Record the outcome in your resume signal:
   - `approved` — all checklist items pass, no visual issues
   - `issues: <description>` — list what broke, attach screenshots if helpful, and indicate whether it blocks the phase
  </how-to-verify>

  <resume-signal>Type `approved` when all checklist items pass, or `issues: <description>` to list problems found.</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| planning docs → human readers | Static markdown; no code execution. |
| manual QA session → browser dev tools | User is the trusted actor; they are examining their own session in dev mode. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-08-10 | Information Disclosure | Theme verification checklist in planning/ | accept | Contains no secrets, selectors, or credentials — only UX validation steps. Severity: none. |
| T-08-11 | Tampering | REQUIREMENTS.md / ROADMAP.md edits | accept | Standard documentation edit path; git history preserves the pre-edit state. Annotation references D-14 for traceability. Severity: low. |

No high-severity threats. Plan passes security gate.
</threat_model>

<verification>
After all three tasks:

1. `git diff .planning/REQUIREMENTS.md` shows only one bullet changed, adding "below 1024px" and the D-14 reference
2. `git diff .planning/ROADMAP.md` shows only one line changed, 768→1024
3. The checklist file exists and contains 5 steps
4. The human verify checkpoint was approved (or any issues logged as BUG-*)
</verification>

<success_criteria>
- REQUIREMENTS.md and ROADMAP.md consistently say 1024px for INTG-03
- Theme verification checklist file exists and covers light, dark, mid-tour switching, mobile, and missing-target scenarios
- The human verify checkpoint returned `approved` OR any issues have been filed as BUG-* with a disposition
- No new tour-specific CSS tokens were introduced (D-13 preserved)
</success_criteria>

<output>
After completion, create `.planning/phases/08-app-integration/08-03-SUMMARY.md` documenting:
- The specific text changes in REQUIREMENTS.md and ROADMAP.md
- Link to the checklist file
- The human verify checkpoint outcome (approved / issues found)
- Any BUG-* filed as follow-ups
</output>
