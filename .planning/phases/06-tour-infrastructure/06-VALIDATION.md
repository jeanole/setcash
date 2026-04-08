---
phase: 6
slug: tour-infrastructure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-08
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29.7 + ts-jest 29.4.6 |
| **Config file** | `nextjs/jest.config.js` |
| **Quick run command** | `cd nextjs && npx jest --testPathPattern tour --no-coverage -x` |
| **Full suite command** | `cd nextjs && npm run test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd nextjs && npx jest --testPathPattern tour --no-coverage -x`
- **After every plan wave:** Run `cd nextjs && npm run test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 6-01-01 | 01 | 1 | INFRA-01 | T-6-01 | hasSeenTour default false in schema | integration | `npx jest __tests__/api/tour-complete.test.ts -x` | ❌ W0 | ⬜ pending |
| 6-01-02 | 01 | 1 | INFRA-01 | — | hasSeenTour in JWT/session pipeline | integration | `npx jest __tests__/api/tour-complete.test.ts -x` | ❌ W0 | ⬜ pending |
| 6-02-01 | 02 | 1 | INFRA-02 | T-6-02 | POST returns 401 without session | integration | `npx jest __tests__/api/tour-complete.test.ts -x` | ❌ W0 | ⬜ pending |
| 6-02-02 | 02 | 1 | INFRA-02 | T-6-03 | Rate limiter on completion endpoint | integration | `npx jest __tests__/api/tour-complete.test.ts -x` | ❌ W0 | ⬜ pending |
| 6-03-01 | 03 | 2 | INFRA-03 | — | TourProvider exposes context API | unit | `npx jest __tests__/lib/tour-provider.test.ts -x` | ❌ W0 | ⬜ pending |
| 6-04-01 | 04 | 2 | INFRA-04 | — | TOUR_STEPS has 6 entries with required fields | unit | `npx jest __tests__/lib/tour-steps.test.ts -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `nextjs/__tests__/api/tour-complete.test.ts` — stubs for INFRA-01, INFRA-02
- [ ] `nextjs/__tests__/lib/tour-steps.test.ts` — stubs for INFRA-04
- [ ] `nextjs/__tests__/lib/tour-provider.test.ts` — stubs for INFRA-03

*Existing Jest infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Tour state survives logout/login cycle | INFRA-01 | Requires full browser auth flow | 1. Login, complete tour via POST. 2. Logout, login again. 3. Check session.user.hasSeenTour is true |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
