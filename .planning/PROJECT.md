# SetCash — Onboarding Tour Milestone

## What This Is

SetCash is a multi-tenant expense tracking and budget management app built with Next.js 14, PostgreSQL/Prisma, and NextAuth. Users submit expense bills with images; admins approve and process them; budgets are managed via a matrix view. Google Sheets sync, Telegram notifications, and PDF/Excel exports round out the feature set.

## Core Value

Every bill submission, approval, and budget calculation must be **correct, secure, and reliable** — financial data tolerates zero silent failures.

## Requirements

### Validated

- ✓ User authentication (email/password + Google OAuth) — existing
- ✓ Multi-tenant project isolation with role-based access (user/admin/superadmin) — existing
- ✓ Bill CRUD with image uploads, motive/category allocations — existing
- ✓ Bill approval workflow (draft → submitted → approved/rejected) — existing
- ✓ Budget matrix with motive/category grid and allocation tracking — existing
- ✓ Google Sheets export/sync for bills — existing
- ✓ Telegram bot notifications per project — existing
- ✓ PDF and Excel bill export — existing
- ✓ Superadmin dashboard for project/user management — existing
- ✓ Email verification and password reset flows — existing
- ✓ Analytics tracking (visit logs, page events) — existing
- ✓ Notification system with bell icon and preferences — existing
- ✓ OCR receipt scanning — existing
- ✓ VGeld (virtual currency) transfer system — existing

### Active

- [ ] 6-step guided onboarding tour with speech-bubble tooltips anchored to UI elements
- [ ] Tour progression controls (Next/Back/Skip/Done)
- [ ] Tour triggers on first login for new users, every login for demo/test users
- [ ] Tour state persisted per user (hasSeenTour flag)
- [ ] Tour content: sidebar nav, bill creation, budget matrix, approval workflow, exports, settings
- [ ] Callouts for Telegram notifications and AI/OCR integration in relevant steps

### Out of Scope

- Full interactive walkthrough with sandbox data — lightweight tooltips only
- Video tutorials or embedded help docs — keep it simple, one sentence per step
- Customizable tour content per project — single global tour for v1.1
- Tour analytics/tracking (which step users drop off) — defer to future milestone

## Current Milestone: v1.1 Onboarding Tour

**Goal:** Guide new users through SetCash's core features with a 6-step speech-bubble tooltip tour on first login (always for test/demo users).

**Target features:**
- 6-step guided tour with speech-bubble tooltips anchored to UI elements
- Step-by-step progression with Next/Back/Skip/Done controls
- Tour triggers: first login for new users, every login for demo/test users
- Tour content covering: navigation, bill creation, budget matrix, approval workflow, exports, settings — with callouts for Telegram and AI/OCR

## Context

- App already has a working demo login flow — tour should integrate with that
- UI uses Tailwind CSS v4, React 18, Next.js 14 App Router
- No existing tooltip/popover library in the project — will need a tour library or custom implementation
- Test/demo account detection available via `isDemoAccount` flag in session JWT

## Constraints

- **Tech stack**: No framework changes — Next.js 14, Prisma, PostgreSQL stay as-is
- **Backwards compatibility**: No breaking changes to existing API contracts or data models
- **Data safety**: Legacy column removal requires migration with verification that no external system reads them
- **Testing**: Integration tests use real database (per project convention), not mocks

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Lightweight tooltip tour, not interactive walkthrough | Minimal complexity, fast to build, non-intrusive UX | — Pending |
| Per-user tour state flag | Simple boolean tracks completion; demo users bypass it | — Pending |
| 6 fixed steps covering core workflow | Covers the critical path without overwhelming new users | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-09 after Phase 6 (Tour Infrastructure) complete — persistent backend, React context, step config all verified*
