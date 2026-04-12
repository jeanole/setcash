# SetCash

## What This Is

SetCash is a multi-tenant expense tracking and budget management app built with Next.js 14, PostgreSQL/Prisma, and NextAuth. Users submit expense bills with images; admins approve and process them; budgets are managed via a matrix view. Google Sheets sync, Telegram notifications, PDF/Excel exports, and a guided onboarding tour round out the feature set.

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
- ✓ 6-step onboarding tour with tooltips, spotlight, keyboard nav — v1.1
- ✓ Tour auto-start for new/demo users with mobile adaptation — v1.1
- ✓ Tour theme support (light/dark via CSS variables) — v1.1

### Active

(None — next milestone will define new requirements)

### Out of Scope

- Full interactive walkthrough with sandbox data — lightweight tooltips only
- Video tutorials or embedded help docs — keep it simple, one sentence per step
- Customizable tour content per project — single global tour for v1.1
- Tour analytics/tracking (which step users drop off) — defer to future milestone

## Context

- v1.1 shipped 2026-04-12: 6-step onboarding tour (3 phases, 10 plans, +936 lines)
- Custom tour implementation — no external library dependency
- Theme support uses CSS variables (`--bg-surface`, `--border`, `--text-primary`) that respond to `[data-theme="dark"]`
- Tailwind v4 `dark:` modifier does NOT work with `[data-theme]` — always use CSS variables for theme-aware components

## Constraints

- **Tech stack**: No framework changes — Next.js 14, Prisma, PostgreSQL stay as-is
- **Backwards compatibility**: No breaking changes to existing API contracts or data models
- **Data safety**: Legacy column removal requires migration with verification that no external system reads them
- **Testing**: Integration tests use real database (per project convention), not mocks

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Lightweight tooltip tour, not interactive walkthrough | Minimal complexity, fast to build, non-intrusive UX | ✓ Good — shipped in 4 days |
| Per-user tour state flag | Simple boolean tracks completion; demo users bypass it | ✓ Good |
| 6 fixed steps covering core workflow | Covers the critical path without overwhelming new users | ✓ Good |
| CSS variables instead of Tailwind `dark:` | Tailwind v4 `dark:` doesn't respond to `[data-theme="dark"]` | ✓ Good — discovered during verification |
| desktopOnly step flag for project-switcher | Only element hidden on mobile; clean skip without special-casing | ✓ Good |
| Retry-3x-then-silent-skip | Graceful degradation for missing targets without blocking tour | ✓ Good |

## Evolution

This document evolves at phase transitions and milestone boundaries.

---
*Last updated: 2026-04-12 after v1.1 Onboarding Tour milestone complete*
