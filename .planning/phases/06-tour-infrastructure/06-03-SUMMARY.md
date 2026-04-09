---
phase: 06-tour-infrastructure
plan: 03
subsystem: tour-api
tags: [api, rate-limiting, tour, client-wrapper]
dependency_graph:
  requires: [06-01]
  provides: [POST /api/tour/complete, completeTour client wrapper]
  affects: [nextjs/lib/ratelimit.ts]
tech_stack:
  added: []
  patterns: [rate-limited POST endpoint, client API wrapper]
key_files:
  created:
    - nextjs/app/api/tour/complete/route.ts
    - nextjs/lib/api/tour.ts
  modified:
    - nextjs/lib/ratelimit.ts
decisions:
  - No Zod validation needed — endpoint takes no request body (per D-10)
  - Inline error handling in tour.ts rather than importing fetchWithError — single-function module
metrics:
  duration: ~7 minutes
  completed: "2026-04-09T06:45:00Z"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 06 Plan 03: Tour Completion API Summary

POST /api/tour/complete endpoint with auth gate, rate limiting (5/min), and client-side completeTour() wrapper for TourProvider consumption.

## What Was Done

### Task 1: Rate limiter config and POST endpoint

Added `tourComplete` rate limiter configuration (5 requests per minute per user) to `nextjs/lib/ratelimit.ts` and exported `tourCompleteLimiter` instance.

Created `nextjs/app/api/tour/complete/route.ts` with:
- Auth check via `getCurrentUser()` returning 401 if unauthenticated
- Rate limiting via `tourCompleteLimiter.limit(email)` returning 429 on excess
- `db.user.update({ where: { id }, data: { hasSeenTour: true } })` for idempotent completion
- Standard error handling with 500 catch-all

### Task 2: Client-side API wrapper

Created `nextjs/lib/api/tour.ts` with `completeTour()` async function that:
- Calls `POST /api/tour/complete` with no body
- Throws on non-OK response with error message from response body
- Returns `{ success: boolean }` on success

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 558aeac | feat(06-03): add POST /api/tour/complete endpoint with rate limiting |
| 2 | 0c23093 | feat(06-03): create client-side completeTour() API wrapper |

## Verification

- `npx tsc --noEmit` passes cleanly
- All grep checks for tourComplete, tourCompleteLimiter, getCurrentUser, hasSeenTour, completeTour pass
- Endpoint follows existing API route patterns (auth first, rate limit, then business logic)
- Client wrapper follows existing fetchWithError pattern from bills API

## Deviations from Plan

None - plan executed exactly as written.

## Threat Model Compliance

| Threat | Mitigation | Status |
|--------|-----------|--------|
| T-6-03 Spoofing | getCurrentUser() auth check, 401 on missing session | Implemented |
| T-6-04 DoS | tourCompleteLimiter 5 req/min per user email | Implemented |
| T-6-05 Elevation of Privilege | where: { id: sessionUser.id } scopes to own user only | Implemented |

## Self-Check: PASSED

- FOUND: nextjs/app/api/tour/complete/route.ts
- FOUND: nextjs/lib/api/tour.ts
- FOUND: nextjs/lib/ratelimit.ts (modified)
- FOUND: commit 558aeac (task 1)
- FOUND: commit 0c23093 (task 2)
