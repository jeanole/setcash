---
phase: 06-tour-infrastructure
plan: 04
subsystem: tour-provider
tags: [react-context, tour, provider, layout]
dependency_graph:
  requires: [06-01, 06-02]
  provides: [TourProvider, useTour]
  affects: [nextjs/app/(protected)/layout.tsx]
tech_stack:
  added: []
  patterns: [react-context, fire-and-forget-api]
key_files:
  created:
    - nextjs/components/providers/TourProvider.tsx
    - nextjs/lib/api/tour.ts
  modified:
    - nextjs/app/(protected)/layout.tsx
decisions:
  - TourProvider placed inside AppShell (not wrapping it) since it provides context to page children, not to the shell itself
  - Created lib/api/tour.ts client wrapper inline as blocking dependency from Plan 03 (parallel execution)
metrics:
  duration: 7m
  completed: 2026-04-09T06:48:00Z
  tasks: 2/2
  files: 3
---

# Phase 06 Plan 04: TourProvider Context Summary

React context provider for onboarding tour state with useTour hook, mounted in protected layout for all authenticated pages.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create TourProvider context with useTour hook | 5150c3c | nextjs/components/providers/TourProvider.tsx, nextjs/lib/api/tour.ts |
| 2 | Mount TourProvider in protected layout | 9238cda | nextjs/app/(protected)/layout.tsx |

## What Was Built

### TourProvider (nextjs/components/providers/TourProvider.tsx)

- React context provider exposing: `isActive`, `currentStep`, `stepCount`, `next()`, `back()`, `skip()`, `complete()`
- Reads `hasSeenTour` and `isDemoAccount` from `useSession()` to determine initial activation
- Demo/test users see the tour regardless of `hasSeenTour` value
- Non-demo users with `hasSeenTour=false` see the tour; `hasSeenTour=true` do not
- Tour does not activate while session is loading (status must be `authenticated`)
- `complete()` and `skip()` set `isActive=false` locally and fire `completeTour()` API call (fire-and-forget)
- `useTour()` hook throws if used outside TourProvider

### Layout Integration (nextjs/app/(protected)/layout.tsx)

- TourProvider wraps `{children}` inside AppShell
- Inside ClientSessionProvider for useSession() access
- All protected page components can now consume `useTour()`

### Client API Wrapper (nextjs/lib/api/tour.ts)

- `completeTour()` function calls POST /api/tour/complete
- Created as blocking dependency fix (Plan 03 executes in parallel)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created lib/api/tour.ts client wrapper**
- **Found during:** Task 1
- **Issue:** Plan 04 imports `completeTour` from `@/lib/api/tour`, but that file is created by Plan 03 which runs in parallel and had not yet been merged
- **Fix:** Created the file matching Plan 03's spec so TourProvider compiles; identical file will merge cleanly when worktrees consolidate
- **Files created:** nextjs/lib/api/tour.ts
- **Commit:** 5150c3c

## Verification Results

- TourProvider.tsx contains: createContext, useTour, useSession, completeTour, TOUR_STEPS, isDemoAccount
- layout.tsx imports TourProvider and wraps children inside AppShell
- TypeScript compilation: pre-existing test file errors only (missing Jest types); no errors from new files

## Self-Check: PASSED

- FOUND: nextjs/components/providers/TourProvider.tsx
- FOUND: nextjs/lib/api/tour.ts
- FOUND: nextjs/app/(protected)/layout.tsx
- FOUND: .planning/phases/06-tour-infrastructure/06-04-SUMMARY.md
- FOUND: commit 5150c3c
- FOUND: commit 9238cda
