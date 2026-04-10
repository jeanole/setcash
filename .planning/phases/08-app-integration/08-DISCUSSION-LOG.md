# Phase 8: App Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 08-CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-10
**Phase:** 08-app-integration
**Areas discussed:** Mobile strategy, Cross-page target flow, Auto-start & missing targets, data-tour placement, Theme, Spec drift

---

## Mobile Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Skip + retarget hamburger | Skip project-switcher, retarget sidebar-nav to mobile hamburger button. 5 steps on mobile. | ✓ |
| Auto-open drawer for sidebar steps | Programmatically open the drawer, anchor tooltip inside it, close on Next. Preserves all 6 steps. | |
| Skip all sidebar steps on mobile | Drop both sidebar-nav and project-switcher on mobile. 4 steps. | |

| Option | Description | Selected |
|--------|-------------|----------|
| lg: 1024px | Match Sidebar.tsx actual breakpoint (`hidden lg:flex`). Code wins over spec. | ✓ |
| md: 768px (per INTG-03) | Honor INTG-03 literally. Requires separate handling in the 768–1023 band. | |

**Notes:** Mobile strategy drove the INTG-03 spec-drift decision — the 768px figure in REQUIREMENTS.md doesn't match the code's lg: breakpoint, and updating the spec is cheaper than adding a new responsive zone.

---

## Cross-Page Target Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Start on dashboard, skip missing | Tour starts on /dashboard; steps whose targets don't resolve are skipped. | ✓ |
| Force-navigate per step | Each step has a route; tour router.push()es before showing. | |
| Start on dashboard, retarget everything | Update step config so every target exists on /dashboard. | |

| Option | Description | Selected |
|--------|-------------|----------|
| Always /dashboard | Tour navigates to /dashboard once before starting. Predictable. | ✓ |
| Wherever the user lands | Tour starts wherever NextAuth routes to. | |

**Notes:** Combined with D-09 in CONTEXT.md, the "skip missing" decision became "retarget to dashboard equivalents where possible, skip as last resort" — `bill-list` → RecentBillsList, `submit-bill` → QuickActions, `budget-matrix` → Spending by Category chart (retargeted with body-copy update).

---

## Auto-Start & Missing Targets

| Option | Description | Selected |
|--------|-------------|----------|
| Skip step forward automatically | Retry ~500ms/3 tries, then advance. Abort gracefully without marking hasSeenTour if all steps skip. | ✓ |
| Block tour until target mounts | Wait indefinitely. | |
| Abort the whole tour on first miss | One miss kills the tour. | |

| Option | Description | Selected |
|--------|-------------|----------|
| Delay until pathname === /dashboard + 150ms settle | Gated auto-start. Layout has painted. | ✓ |
| Fire immediately on session load | Current Phase 6 behavior. Relies on per-step retry. | |
| Wait for window 'load' event | Strictest, slower. | |

**Notes:** The "abort without marking hasSeenTour" clause is important — if every step skips, the user deserves another try on next login rather than silently consuming their one onboarding shot.

---

## data-tour Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Profile button in Header | Attach user-menu to an existing (or new minimal) profile button. Introduce if missing. | ✓ |
| NotificationBell in Header | Reuse existing element, but mismatches step body copy. | |
| Entire Header (wrapper) | Broad target, poor UX. | |

| Option | Description | Selected |
|--------|-------------|----------|
| Smallest visible interactive element | Tight spotlight, clearer UX. | ✓ |
| Semantic wrapper/section | Broader spotlight, less precise. | |

| Option | Description | Selected |
|--------|-------------|----------|
| Retarget budget-matrix to spending chart | Point at "Spending by Category" chart on dashboard; update step body copy. Keep 6 steps. | ✓ |
| Skip on dashboard | Let missing-target skip drop it. Tour is 5 steps. | |
| Force-navigate to /budget | Exception to the no-navigation rule. | |

**Notes:** The profile-button-in-Header decision may require introducing a minimal button in Header.tsx if none exists. That scope is explicitly allowed by Phase 8 — tying tour anchors to real UI.

---

## Theme

| Option | Description | Selected |
|--------|-------------|----------|
| Verify only, no changes | Manual QA pass. Patch via existing CSS vars if contrast issues appear. | ✓ |
| Add dedicated tour CSS vars | Introduce --vb-tour-* tokens. | |

**Notes:** Phase 7 already handled dark mode via `dark:` + `--vb-*` vars. Phase 8 adds no new abstraction — just verification.

---

## Spec Drift (INTG-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Update INTG-03 to 1024px | Amend REQUIREMENTS.md to match the code's lg: breakpoint. | ✓ |
| Add md:lg: handling zone | Treat 768–1023 as a separate tablet zone. | |
| Keep 768 in spec, handle both | Leave spec alone. Confusing. | |

**Notes:** Spec drift correction is tracked as D-14 and will be applied as part of Phase 8 execution, not deferred.

---

## Claude's Discretion
- Retry mechanism (timer vs rAF vs MutationObserver) for missing-target detection
- Exact styling of the new profile button if one is added to Header.tsx
- Whether the 1024px breakpoint is exposed as a shared constant or inlined
- Updated wording for `budget-matrix` step body copy

## Deferred Ideas
- Multi-page tour with per-step routing (v2)
- Dedicated `--vb-tour-*` CSS variables (only if contrast issues appear)
- Separate 768–1023 tablet handling zone
- TOUR-01 through TOUR-04 (already deferred to v2 per REQUIREMENTS.md)
