# Milestones

## v1.1 — Onboarding Tour

**Shipped:** 2026-04-12
**Phases:** 3 (6-8) | **Plans:** 10 | **Lines:** +936

**Delivered:** 6-step guided onboarding tour with speech-bubble tooltips, spotlight overlay, keyboard navigation, auto-start on first login, mobile adaptation, and dark/light theme support.

**Key accomplishments:**
1. Tour infrastructure — hasSeenTour persisted in DB, wired through JWT/session, TourProvider context
2. Tour step configuration — 6 steps in centralized config with selectors, titles, placement
3. Tour API — POST /api/tour/complete with rate limiting
4. Tour UI — SVG mask spotlight, speech-bubble tooltip with arrow, keyboard nav, focus trapping
5. App integration — data-tour attributes, auto-start gating, viewport-aware target resolution
6. Resilience — retry-3x-then-skip, desktopOnly flag, abort-without-complete, CSS variable theme parity

**Archive:** [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md) | [milestones/v1.1-REQUIREMENTS.md](milestones/v1.1-REQUIREMENTS.md)
