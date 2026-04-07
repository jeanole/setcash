# SetCash — Hardening Milestone

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

- [ ] Triage and fix all reproducible bugs from the 45+ tracked bug reports
- [ ] Close path traversal vulnerability in uploads endpoint
- [ ] Fix stale JWT role checks — re-verify roles on critical operations
- [ ] Extract duplicated bill helpers (saveAllocations, syncLegacyImageColumns) to shared module
- [ ] Replace N+1 sequential DB writes with batch operations (createMany)
- [ ] Replace synchronous file I/O with async equivalents in request handlers
- [ ] Move bill creation post-steps inside transaction scope
- [ ] Remove legacy columns (legacyId, motiveLegacy) after confirming no external readers
- [ ] Clean up dependencies (@types in deps, better-sqlite3 remnant)
- [ ] Pin next-auth to exact version to prevent accidental beta upgrades
- [ ] Add integration tests for critical paths (bill CRUD, auth, allocations, budget)
- [ ] Add path traversal guards to all file-serving endpoints
- [ ] Add automated cleanup for expired tokens (password reset, email verification)

### Out of Scope

- New features or UI enhancements — this milestone is hardening only
- Migration to object storage (S3/GCS) — scaling concern, not reliability
- E2E browser tests — add after integration test coverage improves
- CSRF token implementation — SameSite cookies provide partial protection; revisit in security milestone
- Automated database backups — ops concern, not application code

## Context

- 45+ bug reports tracked in `features/BUG-*.md`, status unknown (many may be stale or already fixed)
- Codebase audit (`.planning/codebase/CONCERNS.md`) identified security, performance, and reliability issues
- Only 3 of 87 API routes have tests — regression risk is high
- Bill creation flow is the most fragile area: file uploads + allocations + edit logs happen outside transaction
- next-auth is on beta channel (v5.0.0-beta.30) — pinning required
- Duplicated code in bill routes increases maintenance burden and divergence risk

## Constraints

- **Tech stack**: No framework changes — Next.js 14, Prisma, PostgreSQL stay as-is
- **Backwards compatibility**: No breaking changes to existing API contracts or data models
- **Data safety**: Legacy column removal requires migration with verification that no external system reads them
- **Testing**: Integration tests use real database (per project convention), not mocks

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Triage bugs before fixing | Many of 45+ bugs may be stale or duplicates — avoid wasted effort | — Pending |
| Hardening only, no new features | Focus drives quality; mixing features dilutes reliability work | — Pending |
| Integration tests over E2E | Faster to write, more stable, covers the critical gaps first | — Pending |

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
*Last updated: 2026-04-01 after initialization*
