# PROJ-23: Visit Analytics & Demo Usage Tracking

**Status:** Planned
**Priority:** Medium
**Created:** 2026-03-16
**Dependencies:** PROJ-22 (Demo / Test Account), PROJ-5 (Auth)

## Overview

Provide the super-admin with visibility into landing page visits and demo login usage — who clicked the demo button, when, and how often. Helps gauge interest and identify patterns without requiring a full third-party analytics setup.

## User Stories

- As a super-admin, I want to see how many people visited the landing page so I can gauge interest.
- As a super-admin, I want to see when demo logins were attempted and completed so I know who is testing the app.
- As a super-admin, I want a simple dashboard view of visit and demo usage stats so I don't have to dig through logs.

## Acceptance Criteria

- [ ] Landing page visits are logged (timestamp, anonymised IP/UA, no PII beyond what's needed)
- [ ] Each demo login attempt is logged (timestamp, Turnstile success/fail, login success/fail)
- [ ] Super-admin can view a stats page showing visit counts and demo usage over time
- [ ] Data is aggregated — daily/weekly totals visible
- [ ] No external analytics service required (self-hosted, stored in DB)
- [ ] Logs are automatically pruned after a configurable retention period (default: 90 days)
- [ ] GDPR-compliant — no full IP storage, no cookies for tracking, no fingerprinting

## Technical Notes

- New `VisitLog` and `DemoLoginAttempt` tables in Prisma schema
- Landing page hits tracked via a lightweight API route (`/api/analytics/visit`) called client-side on mount
- Demo login events already pass through `/api/auth/demo-login` — add logging there
- Super-admin analytics page under `/superadmin/analytics` or as a tab in the existing super-admin panel

## Change Requests

### CR-28: Insights into Site Visits and Demo Usage
**Requested:** 2026-03-16 | **Priority:** Medium | **Status:** Pending Review

**Current Behavior:** No visibility into landing page traffic or demo login activity.

**Desired Behavior:** Super-admin sees visit counts and demo login events (who, when, success/fail) in a simple dashboard.

**Rationale:** Helps the owner understand how many people discover and try the app, without relying on third-party tracking tools.

**Decisions:**
- **Display:** KPI numbers + simple daily bar/line charts + raw log table (visits and demo logins separately)
- **IP handling:** Resolve to country code only (e.g. `DE`, `US`) — no raw IP stored, GDPR-safe
- **Pruning:** Manual prune button in the Analytics tab — super-admin triggers it explicitly; default retention 90 days

**Acceptance Criteria:**
- [ ] Landing page visits logged: timestamp + country code + user-agent category (mobile/desktop) — no PII
- [ ] Demo login attempts logged: timestamp, Turnstile outcome, login outcome, country code
- [ ] New "Analytics" tab in the super-admin modal
- [ ] KPI cards: total visits (all time), visits (last 7 days), demo logins (last 7 days), demo success rate
- [ ] Daily visit chart (bar or line, last 30 days)
- [ ] Demo login log table: timestamp, country, Turnstile result, login result — paginated
- [ ] Manual prune button: deletes records older than 90 days, shows count of deleted rows
- [ ] No external analytics service — fully self-hosted in DB
- [ ] GDPR compliant — no full IP, no cookies, no fingerprinting

**Resolution:** Pending

---

#### Tech Design (CR-28)

##### A) Component Structure

```
SuperAdminModal
├── Tab bar: Projects | Users | Config | Analytics  ← add 4th tab
└── AnalyticsTab (new component)
    ├── KPI Cards Row
    │   ├── Total visits (all time)
    │   ├── Visits last 7 days
    │   ├── Demo logins last 7 days
    │   └── Demo success rate (last 7 days)
    ├── Daily Visits Chart
    │   └── Bar chart — last 30 days, one bar per day (recharts BarChart)
    ├── Demo Login Log Table
    │   ├── Columns: Timestamp | Country | Turnstile | Login result
    │   ├── Paginated (25 rows, newest first)
    │   └── Empty state: "No demo login attempts yet"
    └── Prune Section
        ├── "Delete records older than 90 days" button
        └── Result message: "Deleted N visit(s) and M demo login(s)"
```

##### B) Data Model

**Table 1: VisitLog**
```
Each landing page visit records:
- ID                — unique identifier
- Timestamp         — when the visit occurred
- Country code      — 2-letter code (e.g. "DE", "US"), or null if unresolvable
- Device type       — "mobile", "desktop", or "bot" (derived from User-Agent)
- Path              — which page was visited (e.g. "/")

Stored in: PostgreSQL via Prisma (no PII — no IP, no email, no cookies)
```

**Table 2: DemoLoginAttempt**
```
Each demo login attempt records:
- ID                  — unique identifier
- Timestamp           — when the attempt occurred
- Country code        — same as above
- Turnstile passed    — true / false (did Cloudflare verification succeed?)
- Login succeeded     — true / false (did the credential sign-in work?)

Stored in: PostgreSQL via Prisma
```

Both tables have an index on `timestamp` for fast pruning and aggregation queries.

##### C) API Routes

| Route | Method | Who | What |
|---|---|---|---|
| `/api/analytics/visit` | POST | Public (no auth) | Log a landing page visit — called client-side on mount |
| `/api/admin/analytics` | GET | Superadmin | Returns KPI numbers + daily aggregates (last 30d) + demo log (paginated) |
| `/api/admin/analytics/prune` | DELETE | Superadmin | Deletes records older than 90 days, returns `{ visits: N, demoLogins: M }` |

The existing `POST /api/auth/demo-login` route is extended to log a `DemoLoginAttempt` row after each attempt (success and failure).

##### D) Country Resolution

The app uses Cloudflare Turnstile, meaning traffic passes through Cloudflare's network. Cloudflare automatically adds a `CF-IPCountry` header to every request with the visitor's 2-letter country code. The visit and demo-login routes read this header — **no geoip package or external API call needed**.

If the header is absent (local dev, non-Cloudflare traffic), `countryCode` is stored as `null`.

##### E) Tech Decisions

| Decision | Choice | Reason |
|---|---|---|
| Chart library | `recharts` | Already installed — no new dependency |
| Country resolution | `CF-IPCountry` header | Free, zero-dependency, accurate — Cloudflare already does the work |
| No IP stored | Header read then discarded | GDPR-safe by design |
| Manual pruning | Button in UI | Gives super-admin explicit control; simpler than a cron job |
| Public visit endpoint | No auth required | Landing page visitors are not logged in; endpoint has no sensitive data to protect |
| UA classification | Simple regex (mobile/desktop/bot) | Lightweight; no library needed for 3-category classification |

##### F) Files That Change

```
nextjs/prisma/schema.prisma                         — add VisitLog + DemoLoginAttempt models
nextjs/prisma/migrations/...                        — generated migration
nextjs/app/api/analytics/visit/route.ts             — new: log visit (public POST)
nextjs/app/api/admin/analytics/route.ts             — new: GET stats + paginated log
nextjs/app/api/admin/analytics/prune/route.ts       — new: DELETE old records
nextjs/app/api/auth/demo-login/route.ts             — extend: log DemoLoginAttempt
nextjs/components/superadmin/AnalyticsTab.tsx       — new: full analytics UI
nextjs/components/superadmin/SuperAdminModal.tsx    — add Analytics tab
nextjs/components/superadmin/types.ts               — add 'analytics' to TabType
```

##### G) Dependencies
No new packages needed — `recharts` already installed, country from CF header.
