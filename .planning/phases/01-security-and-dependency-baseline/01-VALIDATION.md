---
phase: 1
slug: security-and-dependency-baseline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-02
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29.7 with ts-jest 29.4.6 |
| **Config file** | `nextjs/jest.config.js` |
| **Quick run command** | `cd nextjs && npm test -- --testPathPattern="security" --forceExit` |
| **Full suite command** | `cd nextjs && npm test -- --forceExit` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd nextjs && npm test -- --testPathPattern="security" --forceExit`
- **After every plan wave:** Run `cd nextjs && npm test -- --forceExit`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | SEC-01 | unit | `cd nextjs && npx jest __tests__/lib/upload.test.ts --forceExit` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | SEC-02 | integration | `cd nextjs && npx jest __tests__/api/bills-status.test.ts --forceExit` | ❌ W0 | ⬜ pending |
| 01-03-01 | 03 | 1 | SEC-03 | smoke | inline node -e check | N/A | ⬜ pending |
| 01-03-02 | 03 | 1 | QUAL-04 | smoke | inline node -e check | N/A | ⬜ pending |
| 01-03-03 | 03 | 1 | QUAL-05 | smoke | inline node -e check | N/A | ⬜ pending |
| 01-04-01 | 04 | 2 | SEC-04 | integration | `cd nextjs && npx jest __tests__/api/origin-validation.test.ts --forceExit` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `nextjs/__tests__/lib/upload.test.ts` — unit tests for `assertPathWithin` helper (SEC-01)
- [ ] `nextjs/__tests__/api/bills-status.test.ts` — integration test for role demotion detection (SEC-02)
- [ ] `nextjs/__tests__/api/origin-validation.test.ts` — test that middleware rejects cross-origin mutations (SEC-04)

*Existing test infrastructure (Jest 29.7) covers framework needs.*

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
