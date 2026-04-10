# Requirements: SetCash Onboarding Tour

**Defined:** 2026-04-08
**Core Value:** Every bill submission, approval, and budget calculation must be correct, secure, and reliable — financial data tolerates zero silent failures.

## v1.1 Requirements

Requirements for onboarding tour milestone. Each maps to roadmap phases.

### Tour Infrastructure

- [ ] **INFRA-01**: User's tour completion state is persisted in the database (hasSeenTour boolean)
- [ ] **INFRA-02**: User can mark tour as completed via API endpoint
- [ ] **INFRA-03**: Tour state is managed through a React context provider
- [ ] **INFRA-04**: Tour steps are defined in a centralized configuration with target selectors and content

### Tour UI

- [ ] **UI-01**: User sees a speech-bubble tooltip with arrow positioned next to the target element
- [ ] **UI-02**: User sees the target element highlighted with a spotlight overlay dimming the background
- [ ] **UI-03**: User can navigate the tour with Next, Back, Skip, and Done controls
- [ ] **UI-04**: User can navigate and dismiss the tour using keyboard (Esc, arrow keys)

### Integration

- [ ] **INTG-01**: Existing UI elements have data-tour attributes for tour targeting
- [ ] **INTG-02**: Tour auto-starts on first login for new users and on every login for demo/test users
- [ ] **INTG-03**: Tour steps adapt or skip gracefully on viewports below 1024px (the Tailwind `lg:` breakpoint used by Sidebar.tsx `hidden lg:flex` / `lg:hidden`). Corrected from initial "768px" assumption per Phase 8 CONTEXT.md D-14.
- [ ] **INTG-04**: Tour tooltips and overlay match the current theme (light/dark mode)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Tour Enhancements

- **TOUR-01**: Admin can customize tour content per project
- **TOUR-02**: Tour analytics tracking (step completion rates, drop-off points)
- **TOUR-03**: Multi-language tour content (i18n)
- **TOUR-04**: Context-sensitive tooltips that appear on specific actions (not just onboarding)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Interactive sandbox/walkthrough | Lightweight tooltips only — avoid complexity |
| Video tutorials or embedded help docs | One sentence per step, keep it simple |
| Per-project customizable tour content | Single global tour for v1.1 |
| Tour analytics/tracking | Defer to future milestone |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 6 | Pending |
| INFRA-02 | Phase 6 | Pending |
| INFRA-03 | Phase 6 | Pending |
| INFRA-04 | Phase 6 | Pending |
| UI-01 | Phase 7 | Pending |
| UI-02 | Phase 7 | Pending |
| UI-03 | Phase 7 | Pending |
| UI-04 | Phase 7 | Pending |
| INTG-01 | Phase 8 | Pending |
| INTG-02 | Phase 8 | Pending |
| INTG-03 | Phase 8 | Pending |
| INTG-04 | Phase 8 | Pending |

**Coverage:**
- v1.1 requirements: 12 total
- Mapped to phases: 12
- Unmapped: 0

---
*Requirements defined: 2026-04-08*
*Last updated: 2026-04-08 after roadmap creation*
