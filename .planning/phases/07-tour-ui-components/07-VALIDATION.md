---
phase: 07
slug: tour-ui-components
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-09
---

# Phase 07 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (ts-jest) |
| **Config file** | `nextjs/jest.config.js` |
| **Quick run command** | `cd nextjs && npx jest --passWithNoTests --no-coverage -q` |
| **Full suite command** | `cd nextjs && npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd nextjs && npx tsc --noEmit`
- **After every plan wave:** Run `cd nextjs && npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | UI-02 | — | N/A | visual | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 07-02-01 | 02 | 1 | UI-01 | — | N/A | visual | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 07-03-01 | 03 | 2 | UI-03, UI-04 | — | Focus trap prevents interaction outside tooltip | visual | `npx tsc --noEmit` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test framework or stubs needed — Phase 7 components are visual and validated via TypeScript compilation + manual browser testing.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Tooltip anchors to target element with arrow | UI-01 | Visual positioning requires browser | Open tour, verify tooltip appears near target with arrow pointing at it |
| Spotlight cutout highlights target | UI-02 | SVG overlay rendering requires browser | Open tour, verify dimmed overlay with rounded-rect cutout around target |
| Next/Back/Skip/Done buttons work correctly | UI-03 | Button conditional logic is visual | Step through tour, verify no Back on step 1, Done on last step |
| Escape dismisses, arrow keys navigate, focus trapped | UI-04 | Keyboard interaction requires browser | Press Escape (dismisses), Left/Right (navigates), Tab (stays in tooltip) |
| Tooltip repositions on window resize | UI-01 | Resize behavior requires browser | Resize window while tour is active, verify tooltip stays anchored |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
