# PROJ-23: Visit Analytics & Demo Usage Tracking

**Status:** Deployed
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

**Resolution:** Deployed 2026-03-17

---

### CR-31: Visitor Origin & Intention Tracking
**Requested:** 2026-03-18 | **Priority:** High | **Status:** Deployed

**Current Behavior:** Analytics captures only visit count, country, device type, and path. No visibility into where visitors came from or what they interacted with.

**Desired Behavior:**
- Referrer domain captured per visit (traffic source attribution)
- UTM parameters captured per visit (campaign attribution)
- CTA click events tracked (demo button, sign-in)
- Scroll depth milestones tracked (25 / 50 / 75 / 100%)
- Time-on-page tracked (sendBeacon on unload)
- Authenticated page views tracked per route

**Rationale:** Provides actionable insight into traffic origin (organic, paid, social, direct) and visitor engagement quality. Helps evaluate content and campaign performance without third-party tools.

**Acceptance Criteria:**
- [x] `VisitLog` has `referrer`, `utmSource`, `utmMedium`, `utmCampaign` fields
- [x] `VisitTracker` sends referrer domain + UTM params from query string
- [x] `PageEvent` table stores CTA clicks, scroll depth, time-on-page, page_view events
- [x] `POST /api/analytics/event` endpoint (public, rate-limited)
- [x] `EventTracker` component: scroll depth milestones + sendBeacon time-on-page
- [x] `AuthPageTracker` component: authenticated page_view events on route change
- [x] `DemoLoginButton` calls `trackCta('demo_login_click')` on click
- [x] Admin analytics API returns `trafficSources` and `events` breakdown
- [x] `AnalyticsTab` shows: Top Referrers, UTM Sources, CTA Clicks, Scroll Depth, Top App Pages
- [x] Prune also deletes old `PageEvent` records

**Resolution:** Deployed 2026-03-18

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

### CR-32 QA Test Results

**Tested:** 2026-03-19
**App URL:** http://localhost:3000 (static code review -- no running app)
**Tester:** QA Engineer (AI)
**Scope:** CR-32 -- Enhanced Visitor Insights (browser, OS, screen resolution, language, session ID tracking)

#### Acceptance Criteria Status

##### AC-1: Browser detection from User-Agent
- [x] `parseBrowser()` correctly identifies Chrome, Safari, Firefox, Edge, Opera, Samsung Internet, Brave, Vivaldi, Yandex, IE
- [x] Returns null for unknown/bot UAs (null input returns null, no-match returns null)
- [x] Stored in VisitLog.browser field (schema + route confirmed)

##### AC-2: OS detection from User-Agent
- [x] `parseOS()` correctly identifies Windows, macOS, iOS, Android, Linux, ChromeOS
- [x] Returns null for unknown UAs
- [x] Stored in VisitLog.os field

##### AC-3: Screen resolution tracking
- [x] VisitTracker sends `window.screen.width` and `window.screen.height`
- [x] Validated by Zod: `z.number().int().min(0).max(10000).optional().nullable()`
- [x] Stored in VisitLog.screenWidth / screenHeight

##### AC-4: Language tracking
- [x] VisitTracker sends `navigator.language`
- [x] Validated by Zod: `z.string().max(20).optional().nullable()`
- [x] Stored in VisitLog.language

##### AC-5: Session ID tracking
- [x] `getSessionId()` generates UUID via `crypto.randomUUID()`, stored in sessionStorage
- [x] Same session ID reused across page navigations within same tab (sessionStorage persists)
- [x] New tab gets new session ID (sessionStorage is per-tab)
- [x] Sent in both visit and event requests (VisitTracker, EventTracker, AuthPageTracker all call `getSessionId()`)
- [x] Stored in VisitLog.sessionId and PageEvent.sessionId

##### AC-6: Unique Sessions KPI
- [x] Admin API returns `kpi.uniqueSessions` via `COUNT(DISTINCT sessionId)` for last 7 days
- [x] Displayed as 5th KPI card ("Unique Sessions (7d)") in AnalyticsTab

##### AC-7: Browser breakdown in admin API
- [x] Returns top 10 browsers with counts (last 30 days, non-null)
- [x] Displayed in "Browsers" SimpleTable

##### AC-8: OS breakdown in admin API
- [x] Returns top 10 OS with counts (last 30 days, non-null)
- [x] Displayed in "Operating Systems" SimpleTable

##### AC-9: Device type breakdown in admin API
- [x] Returns device types with counts (last 30 days)
- [x] Displayed in "Device Types" SimpleTable

##### AC-10: Country breakdown in admin API
- [x] Returns top 15 countries with counts (last 30 days, non-null)
- [x] Displayed in "Countries" SimpleTable

##### AC-11: Language breakdown in admin API
- [x] Returns top 10 languages with counts (last 30 days, non-null)
- [x] Displayed in "Languages" SimpleTable

##### AC-12: Screen resolution breakdown in admin API
- [x] Concatenates `screenWidth || 'x' || screenHeight` as resolution label in SQL
- [x] Returns top 10 resolutions (last 30 days, non-null screenWidth AND screenHeight)
- [x] Displayed in "Screen Resolutions" SimpleTable

##### AC-13: Dashboard layout
- [x] Visitor Insights section with 6 tables in 3x2 grid (`md:grid-cols-3` x 2 rows)
- [x] KPI row expanded to 5 columns on desktop (`grid-cols-2 lg:grid-cols-5`)

#### Edge Cases Status

##### EC-1: Visit with null/missing new fields
- [x] All new fields nullable in Prisma schema (`String?`, `Int?`)
- [x] All new fields optional in Zod (`optional().nullable()`)

##### EC-2: Screen dimensions at boundary
- [x] screenWidth=0 accepted (`min(0)`)
- [x] screenWidth=10000 accepted (`max(10000)`)
- [x] screenWidth=10001 rejected by Zod
- [x] screenWidth=-1 rejected by Zod

##### EC-3: Language string edge cases
- [x] `"en-US"` accepted (5 chars, under max 20)
- [x] 21-char string rejected by Zod `max(20)`
- [x] null/undefined accepted, stored as null

##### EC-4: Session ID validation
- [x] Max 64 chars enforced (`z.string().max(64)`) on both visit and event endpoints
- [x] 65-char sessionId rejected

##### EC-5: parseBrowser edge cases
- [x] Null UA returns null
- [x] Empty string returns null (no regex matches)
- [x] Chrome-like UA with "Edg/" returns "Edge" (Edge check at line 39 precedes Chrome at line 47)

##### EC-6: parseOS edge cases
- [x] iPad UA returns "iOS" (`/iPhone|iPad|iPod/` matches)
- [x] Chromebook UA returns "ChromeOS" (`/CrOS/` matches)
- [x] Null returns null

##### EC-7: Admin API with no visitor insights data
- [x] All 6 breakdown arrays return empty `[]` (`.map()` over empty raw results)
- [x] uniqueSessions KPI returns 0 (`Number(uniqueSessionsLast7Days[0]?.count ?? 0)`)

##### EC-8: sessionStorage unavailable (SSR context)
- [x] `getSessionId()` returns `''` when `typeof window === 'undefined'`

#### Security Audit Results

##### SEC-1: New fields input validation
- [x] All new Zod schemas properly constrain input types and sizes
- [x] No SQL injection via new fields -- Prisma parameterized queries used throughout

##### SEC-2: No PII leakage
- [x] Screen resolution, browser, OS, language are non-PII
- [x] Session ID is random UUID, not linked to user identity
- [x] sessionStorage cleared on tab close

##### SEC-3: Admin API authorization
- [x] New aggregation queries only accessible to superadmin (role check on admin analytics GET)
- [x] No new public endpoints added

##### SEC-4: Raw SQL injection in new queries
- [x] All 6 new queries use Prisma tagged template literals (parameterized)
- [x] Resolution concatenation done in SQL using column references and string literal -- no user input interpolation
- [x] Date parameters passed as parameterized values

##### SEC-5: Empty string sessionId data quality
- [ ] BUG: Empty string sessionId not coerced to null (see BUG-6 below)

#### Responsive / Cross-Browser (Static Analysis)

- [x] KPI grid: `grid-cols-2 lg:grid-cols-5` -- 2 cols mobile, 5 cols desktop
- [x] Visitor Insights grids: `grid-cols-1 md:grid-cols-3` -- stacks on mobile, 3 cols on tablet+
- [x] SimpleTable: `overflow-hidden` on container, `truncate max-w-[240px]` on label cells -- handles long text
- [x] Demo log table: `overflow-x-auto` with `min-w-[480px]` for horizontal scroll on mobile
- [ ] BUG: Skeleton loader KPI grid mismatch (see BUG-7 below)

#### Regression Check

- [x] Visit tracking still fires on landing page (VisitTracker unchanged fire-on-mount, now with additional fields)
- [x] Event tracking (scroll, CTA, time-on-page) still works (EventTracker, trackCta unchanged)
- [x] AuthPageTracker still sends page_view events with sessionId
- [x] Demo login logging unaffected (no changes to demo login route)
- [x] Prune deletes from all 3 tables (VisitLog, DemoLoginAttempt, PageEvent) in transaction
- [x] Existing 4 KPI cards still display correctly, 5th added without displacing others
- [x] Previous BUG-4 (full skeleton flash on pagination) has been fixed -- `isInitialLoad` and `isPaging` now separated

#### Bugs Found

##### BUG-6: Empty string sessionId stored instead of null [Backend]
- **Severity:** Low
- **Location:** `nextjs/app/api/analytics/visit/route.ts` line 60, `nextjs/app/api/analytics/event/route.ts` line 49
- **Steps to Reproduce:**
  1. POST to `/api/analytics/visit` with `{ "sessionId": "" }`
  2. Zod accepts empty string (no `.min(1)` constraint)
  3. `sessionId ?? null` does not coerce `""` to null (`??` only triggers on null/undefined)
  4. Empty string `""` is stored in the database
- **Impact:** `COUNT(DISTINCT sessionId)` in the unique sessions KPI would count `""` as a valid session, potentially inflating the unique sessions count. In practice, `getSessionId()` always returns a UUID on the client side, but a manual API caller could send `""`.
- **Root Cause:** Missing `.min(1)` or `.transform(v => v || null)` on the sessionId Zod field
- **Priority:** Nice to have

##### BUG-7: Skeleton loader shows 4 KPI cards instead of 5 [Frontend]
- **Severity:** Low
- **Location:** `nextjs/components/superadmin/AnalyticsTab.tsx` lines 177-185
- **Steps to Reproduce:**
  1. Open SuperAdmin modal, click Analytics tab
  2. During initial load, skeleton renders with `grid-cols-2 lg:grid-cols-4` and 4 skeleton cards
  3. Once data loads, actual KPI row renders with `grid-cols-2 lg:grid-cols-5` and 5 cards
  4. Layout shift: skeleton snaps from 4-column to 5-column grid on load completion
- **Root Cause:** `AnalyticsSkeleton` was not updated to match the new 5-KPI layout. The skeleton still uses the CR-28 layout with 4 cards.
- **Priority:** Nice to have

#### Summary
- **Acceptance Criteria:** 13/13 passed
- **Edge Cases:** 8/8 passed
- **Security:** 4/4 passed (1 minor data quality note)
- **Bugs Found:** 2 total (0 critical, 0 high, 0 medium, 2 low)
- **Regression:** No regressions detected; previous BUG-4 confirmed fixed
- **Production Ready:** YES
- **Recommendation:** Deploy. BUG-6 and BUG-7 are cosmetic/edge-case issues suitable for a future cleanup pass. No blocking issues found.
