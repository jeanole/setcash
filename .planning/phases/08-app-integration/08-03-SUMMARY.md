---
phase: 08-app-integration
plan: 03
subsystem: requirements-correction-theme-verify
tags: [docs, requirements, theme, verification, intg-03, intg-04]
dependency-graph:
  requires:
    - plan-08-01 data-tour attributes
    - plan-08-02 tour runtime adaptation
  provides:
    - Corrected INTG-03 breakpoint (1024px) in REQUIREMENTS.md and ROADMAP.md
    - Theme verification checklist for manual QA
  affects:
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - .planning/phases/08-app-integration/08-THEME-VERIFICATION.md
tech-stack:
  added: []
  patterns: []
key-files:
  created:
    - .planning/phases/08-app-integration/08-THEME-VERIFICATION.md
  modified:
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
decisions:
  - Theme verification (Task 3) deferred by user — will be performed as manual QA before milestone close
metrics:
  tasks_completed: 2
  tasks_deferred: 1
  files_created: 1
  files_modified: 2
  commits: 2
  completed: 2026-04-12
requirements:
  - INTG-03
  - INTG-04
---

# Phase 8 Plan 03: Requirements Correction + Theme Verify Summary

Close two loose ends: correct the stale 768px breakpoint in planning docs to 1024px (matching the actual Tailwind `lg:` breakpoint), and produce a theme verification checklist for manual QA.

## Objective Satisfaction

- **Task 1 (INTG-03 correction):** REQUIREMENTS.md and ROADMAP.md both updated to reference "below 1024px" with D-14 annotation. The stale "768px" figure is gone from ROADMAP.md.
- **Task 2 (theme verification checklist):** `08-THEME-VERIFICATION.md` created with 5 verification steps covering light theme, mid-tour toggle, dark theme fresh activation, mobile viewport in dark theme, and missing-target silent skip.
- **Task 3 (human verification pass):** DEFERRED — user chose to skip manual theme verification at this time. To be performed before milestone close.

## Deferred: Theme Verification (Task 3)

The 5-step manual QA checklist exists at `.planning/phases/08-app-integration/08-THEME-VERIFICATION.md` but has not been executed against a running dev server. User elected to defer this verification and complete the phase.

**Impact:** INTG-04 (theme parity) is implemented via Phase 7's `dark:` modifiers and `--vb-*` tokens but not yet visually confirmed end-to-end. No code changes are blocked by this — it is a QA-only gap.

**Follow-up:** Run the checklist before `/gsd-complete-milestone` for v1.1.

## Commits

- `cdb4e04` — docs(08-03): correct INTG-03 breakpoint from 768px to 1024px
- `e4e01ca` — docs(08-03): add theme verification checklist for Phase 8

## Self-Check: PASSED (Tasks 1-2)

- REQUIREMENTS.md contains "below 1024px": YES
- ROADMAP.md contains "below 1024px": YES
- ROADMAP.md contains "below 768px": NO (corrected)
- 08-THEME-VERIFICATION.md exists with 5 steps: YES
- Task 3 human verification: DEFERRED
