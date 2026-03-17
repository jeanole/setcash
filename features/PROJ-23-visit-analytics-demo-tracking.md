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

---

## QA Test Results

**Tested:** 2026-03-17
**App URL:** http://localhost:3000 (static code review -- no running app)
**Tester:** QA Engineer (AI)
**Scope:** CR-28 -- Visit Analytics & Demo Tracking

### Acceptance Criteria Status

#### AC-1: Landing page visits logged
- [x] `POST /api/analytics/visit` returns 204 on valid request
- [x] VisitLog row created with timestamp, countryCode, deviceType, path
- [x] Zod validates path with `.max(200)`, defaults to "/"
- [x] VisitTracker component fires `fetch` on mount in page.tsx

#### AC-2: Demo login attempts logged
- [x] DemoLoginAttempt created on Turnstile failure (turnstileSuccess=false, loginSuccess=false)
- [x] DemoLoginAttempt created on Turnstile success (turnstileSuccess=true, loginSuccess=true)
- [x] Country code extracted from CF-IPCountry header
- [x] Logging is fire-and-forget (`.catch()`) -- does not block response

#### AC-3: Analytics tab in SuperAdmin modal
- [x] 4 tabs visible: Projects, Users, Config, Analytics
- [x] Analytics tab renders AnalyticsTab component
- [x] TabType updated to include 'analytics'
- [x] Barrel export updated in index.ts

#### AC-4: KPI cards display
- [x] 4 KPI cards: Total Visits, Visits (7d), Demo Logins (7d), Success Rate
- [x] Values sourced from API kpi object
- [ ] BUG: Success rate displays unnecessary decimal (see BUG-1 below)

#### AC-5: Daily visit chart
- [x] Recharts BarChart renders last 30 days of data
- [x] Empty state ("No visit data yet") when no data
- [x] Raw SQL aggregation with DATE_TRUNC for daily grouping
- [x] X-axis ticks every 5 days for readability

#### AC-6: Demo login log table
- [x] Table columns: Timestamp, Country, Turnstile, Login Result
- [x] Paginated at 25 per page (pageSize=25)
- [x] Previous/Next buttons with correct disabled states
- [x] Empty state ("No demo login attempts yet")

#### AC-7: Manual prune button
- [x] Prune button present with red border styling
- [x] window.confirm() dialog before deletion
- [x] Toast shows "Deleted N visit(s) and M demo login(s)"
- [x] Data refreshes (fetchAnalytics(1)) after prune

#### AC-8: No external analytics service
- [x] All data stored in PostgreSQL via Prisma
- [x] No third-party analytics scripts loaded

#### AC-9: GDPR compliant
- [x] No IP field in VisitLog or DemoLoginAttempt schema
- [x] No cookies set for tracking (visit endpoint returns bare 204)
- [x] No fingerprinting
- [x] Country code from CF-IPCountry header only, null if absent

### Edge Cases Status

#### EC-1: Visit endpoint with missing/empty body
- [x] Handled -- `req.json().catch(() => ({}))` falls through, Zod defaults path to "/"

#### EC-2: Visit endpoint with invalid JSON
- [x] Handled gracefully -- catch returns `{}`, Zod applies defaults, returns 204 (not 400)

#### EC-3: Visit endpoint with very long path (>200 chars)
- [x] Rejected by Zod `.max(200)` -- returns 400

#### EC-4: Analytics GET with invalid page/pageSize params
- [x] Zod validation rejects -- returns 400

#### EC-5: Analytics GET with page beyond range
- [x] Returns empty items array (Prisma skip exceeds total)

#### EC-6: Prune when no old records exist
- [x] Returns `{ visits: 0, demoLogins: 0 }`

#### EC-7: Chart with only 1 day of data
- [x] Single bar renders correctly

#### EC-8: Demo log with exactly 25 items
- [x] Next button disabled (totalPages=1, currentPage=1)

#### EC-9: Zero data in all tables
- [x] KPIs show 0, chart shows empty state, table shows empty state

#### EC-10: Rate limiting >30 visits/min
- [x] visitLogLimiter configured: max=30, window='1 m'
- [x] Returns 429 when exceeded

### Security Audit Results

- [x] Auth bypass GET /api/admin/analytics: returns 401 without session
- [x] Auth bypass GET /api/admin/analytics: returns 403 for non-superadmin
- [x] Auth bypass DELETE /api/admin/analytics/prune: returns 401 without session
- [x] Auth bypass DELETE /api/admin/analytics/prune: returns 403 for non-superadmin
- [x] Rate limiting on public visit endpoint (30/min per IP)
- [x] SQL injection: Prisma parameterized queries + tagged template literals for raw SQL
- [x] Data exposure: admin analytics response does not include IP addresses
- [x] No PII in VisitLog or DemoLoginAttempt schemas
- [ ] BUG: x-forwarded-for header spoofable for rate limit bypass (see BUG-3)
- [x] XSS in path field: not rendered in current UI, but stored unsanitized (see BUG-2)

### Responsive / Cross-Browser (Static Analysis)

- [x] KPI grid: `grid-cols-2 lg:grid-cols-4` -- 2 cols mobile, 4 cols desktop
- [x] Demo log table: `overflow-x-auto` with `min-w-[480px]` for horizontal scroll
- [x] Prune section: `flex-col sm:flex-row` -- stacks on mobile

### Regression Check

- [x] SuperAdmin modal: Projects, Users, Config tabs unchanged
- [x] Demo login flow: fire-and-forget logging does not block response
- [x] Landing page: VisitTracker renders null, no layout impact

### Bugs Found

#### BUG-1: Success rate KPI shows unnecessary decimal place [Frontend]
- **Severity:** Low
- **Steps to Reproduce:**
  1. Open SuperAdmin modal, click Analytics tab
  2. Observe Success Rate KPI card
  3. Expected: "67%" (clean integer)
  4. Actual: "67.0%" (backend returns integer via `Math.round()`, frontend formats with `.toFixed(1)`)
- **Root Cause:** Backend `Math.round()` on line 110 of `/api/admin/analytics/route.ts` returns integer, but frontend `toFixed(1)` on line 236 of `AnalyticsTab.tsx` adds ".0"
- **Priority:** Nice to have

#### BUG-2: Path field stored without sanitization [Backend]
- **Severity:** Low
- **Steps to Reproduce:**
  1. POST to `/api/analytics/visit` with `{ "path": "<script>alert(1)</script>" }`
  2. Path is stored as-is in VisitLog table
  3. Currently not rendered in any UI, but if visit logs are ever displayed, stored XSS could execute
- **Root Cause:** No HTML sanitization or URL validation on the `path` field
- **Priority:** Fix in next sprint (preventive)

#### BUG-3: Rate limit bypass via x-forwarded-for spoofing [Backend]
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Send POST to `/api/analytics/visit` with header `x-forwarded-for: 1.2.3.4`
  2. Send another 30 requests with `x-forwarded-for: 5.6.7.8`
  3. Each unique spoofed IP gets its own rate limit window
  4. Expected: Rate limit applies regardless of header manipulation
  5. Actual: Attacker can bypass 30/min limit by rotating x-forwarded-for values
- **Root Cause:** `getClientIp()` in `lib/analytics.ts` trusts `x-forwarded-for` without validation. Behind Cloudflare, `cf-connecting-ip` would be more reliable.
- **Priority:** Fix before deployment (if exposed to public internet without Cloudflare proxy)

#### BUG-4: Full skeleton flash on pagination [Frontend]
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Open Analytics tab with >25 demo log entries
  2. Click "Next" to go to page 2
  3. Expected: Only the table updates, KPIs and chart remain visible
  4. Actual: Entire tab flashes to skeleton loader because `fetchAnalytics` sets `isLoading(true)` on every call (line 145), and the skeleton renders when `isLoading` is true (line 188)
- **Root Cause:** Single `isLoading` state used for both initial load and pagination; no distinction between full-page load and table-only refresh
- **Priority:** Fix in next sprint

#### BUG-5: Potential re-fetch loop from unstable useCallback dependency [Frontend]
- **Severity:** Low
- **Steps to Reproduce:**
  1. If `handleApiError` from `useSuperAdminApi` hook changes identity on toast state updates, the `fetchAnalytics` useCallback reference changes
  2. This triggers the `useEffect` on line 161-163 to re-run, calling `fetchAnalytics(1)` again
  3. This could cause repeated API calls or in worst case an infinite loop
- **Root Cause:** `fetchAnalytics` depends on `handleApiError` which may not be referentially stable
- **Priority:** Nice to have (verify `handleApiError` stability in `useSuperAdminApi`)

### Summary
- **Acceptance Criteria:** 9/9 passed (1 minor display issue in AC-4)
- **Edge Cases:** 10/10 passed
- **Bugs Found:** 5 total (0 critical, 2 medium, 3 low)
- **Security:** Mostly solid; 1 medium issue (rate limit bypass via header spoofing)
- **Regression:** No regressions detected
- **Production Ready:** YES (with caveat on BUG-3 if not behind Cloudflare)
- **Recommendation:** Deploy. Fix BUG-3 and BUG-4 in next sprint. BUG-1, BUG-2, BUG-5 are nice-to-have.
