# Phase 6: Tour Infrastructure - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-08
**Phase:** 06-tour-infrastructure
**Areas discussed:** Tour state persistence, Step configuration format, TourProvider design, API endpoint design

---

## Tour State Persistence

| Option | Description | Selected |
|--------|-------------|----------|
| Column on User model | Add hasSeenTour Boolean to existing User table. Simple, one migration. Matches isDemoAccount pattern. | ✓ |
| Separate TourState table | New table with userId + tourId + completedAt. More flexible for multiple tours. | |

**User's choice:** Column on User model
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, add to JWT | Available on client via useSession() without extra API calls. Follows isDemoAccount pattern. | ✓ |
| No, fetch on demand | Keep JWT lean. TourProvider fetches tour state from API on mount. | |

**User's choice:** Yes, add to JWT
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Ignore the flag for demo users | Demo users always see tour regardless of hasSeenTour. Flag is written but overridden by isDemoAccount check. | ✓ |
| Reset flag on each login | Login hook clears hasSeenTour for demo accounts. | |

**User's choice:** Ignore the flag for demo users
**Notes:** None

---

## Step Configuration Format

| Option | Description | Selected |
|--------|-------------|----------|
| Single config file | e.g. lib/tour/steps.ts — one array of step objects. Matches INFRA-04 requirement. | ✓ |
| JSON config file | e.g. data/tour-steps.json — pure data, loses TypeScript type checking. | |

**User's choice:** Single config file
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Selector + title + body + placement | Minimal and sufficient for speech-bubble positioning. | ✓ |
| Add page route field | Same plus route field for cross-page navigation in Phase 8. | |
| Add optional media field | Same plus optional image/icon per step. | |

**User's choice:** Selector + title + body + placement
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| TypeScript interface + as const | Define TourStep interface, export typed TOUR_STEPS array. | ✓ |
| Zod schema | Runtime validation, overkill for static config. | |

**User's choice:** TypeScript interface + as const
**Notes:** None

---

## TourProvider Design

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal: state + nav callbacks | isActive, currentStep, stepCount, next(), back(), skip(), complete(). Small API surface. | ✓ |
| Extended: add step metadata | Same plus currentStepConfig on context. | |
| You decide | Claude picks the right API surface. | |

**User's choice:** Minimal: state + nav callbacks
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Inside protected layout | Add TourProvider in layout.tsx wrapping AppShell children. Follows ClientSessionProvider pattern. | ✓ |
| Inside AppShell | Mount inside AppShell.tsx. Keeps layout clean but mixes concerns. | |

**User's choice:** Inside protected layout
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| From session via useSession() | Reads hasSeenTour from JWT. No extra API call. Consistent with isDemoAccount pattern. | ✓ |
| Prop from server layout | Layout fetches from DB and passes as prop. | |

**User's choice:** From session via useSession()
**Notes:** None

---

## API Endpoint Design

| Option | Description | Selected |
|--------|-------------|----------|
| POST /api/tour/complete | Simple POST, no body. Sets hasSeenTour=true. Idempotent. Standard API pattern. | ✓ |
| PATCH /api/users/me with tour field | Extend existing endpoint. Mixes tour logic with profile updates. | |

**User's choice:** POST /api/tour/complete
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| No, rely on JWT session | hasSeenTour in JWT, no separate GET needed. | ✓ |
| Yes, add GET /api/tour/status | Returns tour state. Adds redundancy. | |

**User's choice:** No, rely on JWT session
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| No, update locally | TourProvider sets isActive=false after POST. JWT catches up on next refresh. | ✓ |
| Yes, force session update | Call update() from next-auth after POST. | |

**User's choice:** No, update locally
**Notes:** None

---

## Claude's Discretion

- Rate limiting strategy for tour completion endpoint
- Exact file placement within lib/tour/ directory
- Whether step IDs use array index or explicit string identifiers

## Deferred Ideas

None — discussion stayed within phase scope
