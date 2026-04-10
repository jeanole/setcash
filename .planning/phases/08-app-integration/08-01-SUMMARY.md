---
phase: 08-app-integration
plan: 01
subsystem: tour-host-markup
tags: [tour, data-tour, onboarding, dashboard, layout, intg-01]
dependency-graph:
  requires:
    - phase-06 tour infrastructure (TourProvider, TOUR_STEPS schema)
    - phase-07 tour UI components (TourController, TourOverlay, TourTooltip)
  provides:
    - data-tour selectors resolvable from document.querySelector on /dashboard
    - stable DOM hook points for plan 08-02 runtime adaptation
  affects:
    - nextjs/components/layout/Sidebar.tsx
    - nextjs/components/layout/Header.tsx
    - nextjs/components/layout/ProjectSwitcher.tsx
    - nextjs/components/dashboard/QuickActions.tsx
    - nextjs/components/dashboard/RecentBillsList.tsx
    - nextjs/components/dashboard/DashboardClient.tsx
tech-stack:
  added: []
  patterns:
    - Conditional attribute rendering via ternary returning undefined (React elides undefined attrs)
    - Shared static selector across desktop and mobile variants of one feature (sidebar-nav)
    - Static string literal selectors only (no user input interpolation)
key-files:
  created: []
  modified:
    - nextjs/components/layout/Sidebar.tsx
    - nextjs/components/layout/Header.tsx
    - nextjs/components/layout/ProjectSwitcher.tsx
    - nextjs/components/dashboard/QuickActions.tsx
    - nextjs/components/dashboard/RecentBillsList.tsx
    - nextjs/components/dashboard/DashboardClient.tsx
decisions:
  - Conditional submit-bill binding uses ACTIONS[].label literal comparison to avoid touching the const schema
  - Sidebar desktop `<nav>` carries sidebar-nav; mobile hamburger in Header carries same literal — shared selector resolved by visibility at runtime (plan 08-02)
  - budget-matrix retargeted to Spending by Category chart container (per D-09) — attribute id kept historical, no change in steps.ts here
  - No data-tour added to demo-account static project name div (per plan note; it is not a project switcher)
  - No data-tour added to mobile `<nav aria-label="Mobile main menu">` (drawer hidden by default; hamburger is the mobile target)
metrics:
  tasks_completed: 2
  files_modified: 6
  lines_added: 7
  lines_removed: 4
  commits: 2
  duration: 78m
  completed: 2026-04-10
requirements:
  - INTG-01
---

# Phase 8 Plan 01: data-tour attributes Summary

Attach static `data-tour` attributes to six dashboard-visible host components so Plan 08-02's tour runtime can locate every TOUR_STEPS target via `document.querySelector` on `/dashboard`.

## Objective Satisfaction

The six `TOUR_STEPS` target selectors (`sidebar-nav`, `project-switcher`, `submit-bill`, `bill-list`, `budget-matrix`, `user-menu`) are now grep-findable in `nextjs/components/` and attached to the smallest visible interactive element per D-08. No runtime logic was touched — that is Plan 08-02's scope.

## Files Modified

| File | Attribute | Element | Commit |
|---|---|---|---|
| `nextjs/components/layout/Sidebar.tsx` | `data-tour="sidebar-nav"` | Desktop `<nav aria-label="Main menu">` at line 295 | cc4883d |
| `nextjs/components/layout/Header.tsx` | `data-tour="sidebar-nav"` | Mobile hamburger `<button onClick={onMenuToggle}>` at line 36 | cc4883d |
| `nextjs/components/layout/Header.tsx` | `data-tour="user-menu"` | Profile `<button onClick={onProfileOpen}>` at line 67 | cc4883d |
| `nextjs/components/layout/ProjectSwitcher.tsx` | `data-tour="project-switcher"` | Root `<div ref={containerRef}>` at line 81 | cc4883d |
| `nextjs/components/dashboard/QuickActions.tsx` | `data-tour="submit-bill"` (conditional) | `<Link>` inside `ACTIONS.map` at line 48; emitted only when `action.label === 'New Bill'` | 09f1283 |
| `nextjs/components/dashboard/RecentBillsList.tsx` | `data-tour="bill-list"` | Root card `<div>` at line 12 | 09f1283 |
| `nextjs/components/dashboard/DashboardClient.tsx` | `data-tour="budget-matrix"` | "Spending by Category" chart container `<div>` at line 120 | 09f1283 |

## Attribute Bindings (grep counts)

- `data-tour="sidebar-nav"`: 2 (desktop nav + mobile hamburger — D-02 shared selector)
- `data-tour="project-switcher"`: 1 (desktop only, non-demo branch)
- `data-tour="submit-bill"`: 1 (conditional, via `'submit-bill'` literal in QuickActions.tsx)
- `data-tour="bill-list"`: 1
- `data-tour="budget-matrix"`: 1 (Category chart only, NOT Motive chart)
- `data-tour="user-menu"`: 1

All attributes are static string literals. The single dynamic form (`data-tour={action.label === 'New Bill' ? 'submit-bill' : undefined}`) compares against a hard-coded in-file constant, satisfying T-08-01/T-08-03 accept dispositions from the threat register.

## Verification

### TypeScript

`cd nextjs && npx tsc --noEmit` — no errors in any of the 6 modified files. 25 pre-existing errors from unrelated files (auth.ts `hasSeenTour` column, components/tour/TourTooltip.tsx RefObject typing, e2e/fixtures/auth.setup.ts Playwright types) were present before this plan and are out of scope per the SCOPE BOUNDARY rule.

### Selector presence sweep

```
sidebar-nav: 2
project-switcher: 1
submit-bill: 0 (conditional, counted as 1 via 'submit-bill' literal grep)
bill-list: 1
budget-matrix: 1
user-menu: 1
```

Matches plan verification expectations exactly.

### Dynamic data-tour audit

Only one dynamic `data-tour={...}` exists across `nextjs/components/` and it compares `action.label` (an in-file literal) against the string `'New Bill'`. No data-tour value derives from session, URL, or props.

## Deviations from Plan

### [Rule 3 - Blocking] ESLint cannot run

The `npm run lint` verification step could not execute because the project has no `.eslintrc*` file. Running `next lint` drops into an interactive "How would you like to configure ESLint?" prompt that cannot be answered from a non-TTY agent shell. This is a pre-existing repository condition, not caused by this plan's edits. TypeScript was used as the primary automated gate and passes cleanly for all 6 modified files.

Recommendation for a future plan: add a minimal `.eslintrc.json` extending `next/core-web-vitals` so CI and agent workflows can lint. Out of scope for 08-01.

### [Environment] Worktree needed node_modules symlink

The agent worktree at `.claude/worktrees/agent-a4ed1f4c/nextjs/` had no `node_modules` directory. I symlinked the main repo's `nextjs/node_modules` into the worktree so `npx tsc --noEmit` could resolve Next.js, React, and Prisma types. This does not affect any tracked file — the symlink is a local filesystem artifact only.

### [Base alignment] Soft reset to expected base

On entry, the worktree HEAD was at `adda773` but the orchestrator's expected base was `8f7fcb9`. A `git reset --soft 8f7fcb9` followed by `git checkout HEAD -- .planning/ nextjs/components/tour/` (to restore tracked files that had been deleted from the worktree filesystem) brought the worktree into the correct state before any edits. No conflicting edits occurred.

## Auth Gates

None. This plan is pure markup; no external services, APIs, or authenticated flows were touched.

## Known Stubs

None. This plan adds attributes only; no placeholder text, empty data sources, or hardcoded mock values were introduced.

## Deferred Issues

The 25 pre-existing TypeScript errors (unrelated to this plan) remain. Summary:
- `nextjs/auth.ts:356,366` — `hasSeenTour` field missing from Prisma-generated `UserSelect`/`User` types. Likely fixed by running `npx prisma generate` (pre-existing from Phase 6 schema change that added the column).
- `nextjs/components/tour/TourTooltip.tsx:81` — React 18 `RefObject<HTMLDivElement | null>` vs `LegacyRef` typing mismatch. Pre-existing from Phase 7.
- `nextjs/e2e/fixtures/auth.setup.ts:20-55` — Playwright `TestDetails` / `Page` type inference issues. Pre-existing.

All three pre-date Plan 08-01. Log in deferred-items if the phase wants to track them.

## Commits

- `cc4883d` — feat(08-01): add data-tour attributes to layout components
- `09f1283` — feat(08-01): add data-tour attributes to dashboard components

## Self-Check: PASSED

- nextjs/components/layout/Sidebar.tsx: FOUND (data-tour="sidebar-nav" at line 295)
- nextjs/components/layout/Header.tsx: FOUND (sidebar-nav + user-menu)
- nextjs/components/layout/ProjectSwitcher.tsx: FOUND (project-switcher at line 81)
- nextjs/components/dashboard/QuickActions.tsx: FOUND (conditional submit-bill at line 48)
- nextjs/components/dashboard/RecentBillsList.tsx: FOUND (bill-list at line 12)
- nextjs/components/dashboard/DashboardClient.tsx: FOUND (budget-matrix at line 120)
- Commit cc4883d: FOUND
- Commit 09f1283: FOUND
