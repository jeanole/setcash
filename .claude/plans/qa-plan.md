# QA Test Plan — CR-32: Enhanced Visitor Insights

## Feature
CR-32 on PROJ-23 (Visit Analytics & Demo Usage Tracking)
Spec: `features/PROJ-23-visit-analytics-demo-tracking.md`

## Context Summary
- PROJ-23 base deployed 2026-03-16, CR-28 deployed 2026-03-17, CR-31 deployed 2026-03-18
- CR-32 adds: browser, OS, screen resolution, language, session ID tracking
- No new API endpoints — extends existing visit + event endpoints
- New aggregation queries in admin analytics API
- New dashboard section in AnalyticsTab

## Files Changed
- `nextjs/prisma/schema.prisma` — new fields on VisitLog + PageEvent
- `nextjs/prisma/migrations/20260319000000_add_visitor_insights_fields/migration.sql`
- `nextjs/lib/analytics.ts` — `parseBrowser()`, `parseOS()` functions
- `nextjs/lib/sessionId.ts` — per-tab session ID via sessionStorage
- `nextjs/app/api/analytics/visit/route.ts` — accepts + stores new fields
- `nextjs/app/api/analytics/event/route.ts` — accepts sessionId
- `nextjs/app/api/admin/analytics/route.ts` — 6 new aggregation queries + uniqueSessions KPI
- `nextjs/components/analytics/VisitTracker.tsx` — sends screen, language, sessionId
- `nextjs/components/analytics/EventTracker.tsx` — sends sessionId
- `nextjs/components/analytics/AuthPageTracker.tsx` — sends sessionId
- `nextjs/components/superadmin/AnalyticsTab.tsx` — new Visitor Insights section

## Acceptance Criteria to Test

### AC-1: Browser detection from User-Agent
- `parseBrowser()` correctly identifies Chrome, Safari, Firefox, Edge, Opera, Samsung Internet, Brave, Vivaldi, Yandex, IE
- Returns null for unknown/bot UAs
- Stored in VisitLog.browser field

### AC-2: OS detection from User-Agent
- `parseOS()` correctly identifies Windows, macOS, iOS, Android, Linux, ChromeOS
- Returns null for unknown UAs
- Stored in VisitLog.os field

### AC-3: Screen resolution tracking
- VisitTracker sends `window.screen.width` and `window.screen.height`
- Validated by Zod: int, min 0, max 10000
- Stored in VisitLog.screenWidth / screenHeight

### AC-4: Language tracking
- VisitTracker sends `navigator.language`
- Validated by Zod: max 20 chars
- Stored in VisitLog.language

### AC-5: Session ID tracking
- `getSessionId()` generates UUID via crypto.randomUUID(), stored in sessionStorage
- Same session ID reused across page navigations within same tab
- New tab gets new session ID
- Sent in both visit and event requests
- Stored in VisitLog.sessionId and PageEvent.sessionId

### AC-6: Unique Sessions KPI
- Admin API returns `kpi.uniqueSessions` — COUNT(DISTINCT sessionId) for last 7 days
- Displayed as 5th KPI card in AnalyticsTab

### AC-7: Browser breakdown in admin API
- Returns top 10 browsers with counts (last 30 days, non-null)
- Displayed in "Browsers" SimpleTable

### AC-8: OS breakdown in admin API
- Returns top 10 OS with counts (last 30 days, non-null)
- Displayed in "Operating Systems" SimpleTable

### AC-9: Device type breakdown in admin API
- Returns device types (mobile/desktop/bot) with counts (last 30 days)
- Displayed in "Device Types" SimpleTable

### AC-10: Country breakdown in admin API
- Returns top 15 countries with counts (last 30 days, non-null)
- Displayed in "Countries" SimpleTable

### AC-11: Language breakdown in admin API
- Returns top 10 languages with counts (last 30 days, non-null)
- Displayed in "Languages" SimpleTable

### AC-12: Screen resolution breakdown in admin API
- Concatenates `screenWidth || 'x' || screenHeight` as resolution label
- Returns top 10 resolutions (last 30 days, non-null)
- Displayed in "Screen Resolutions" SimpleTable

### AC-13: Dashboard layout
- Visitor Insights section with 6 tables in 3x2 grid
- KPI row expanded to 5 columns on desktop (grid-cols-2 lg:grid-cols-5)

## Edge Cases to Test

### EC-1: Visit with null/missing new fields
- Existing visits without browser/os/screen/language/sessionId should still work
- All new fields are optional (nullable in schema, optional in Zod)

### EC-2: Screen dimensions at boundary
- screenWidth=0, screenHeight=0 → accepted
- screenWidth=10000 → accepted
- screenWidth=10001 → rejected by Zod
- screenWidth=-1 → rejected by Zod

### EC-3: Language string edge cases
- `"en-US"` → accepted (normal)
- 21-char string → rejected by Zod max(20)
- null/undefined → accepted, stored as null

### EC-4: Session ID validation
- Max 64 chars enforced
- 65-char sessionId → rejected by Zod

### EC-5: parseBrowser edge cases
- Null UA → returns null
- Empty string → returns null (no match)
- Chrome-like UA with "Edg/" → returns "Edge" (not Chrome)

### EC-6: parseOS edge cases
- iPad UA → returns "iOS"
- Chromebook UA → returns "ChromeOS"
- Null → returns null

### EC-7: Admin API with no visitor insights data
- All 6 new breakdown arrays should return empty `[]`
- uniqueSessions KPI should return 0

### EC-8: sessionStorage unavailable (SSR context)
- `getSessionId()` returns '' for typeof window === 'undefined'

## Security Audit Scope

### SEC-1: New fields input validation
- All new Zod schemas properly constrain input types and sizes
- No SQL injection via new fields (Prisma parameterized queries)

### SEC-2: No PII leakage
- Screen resolution, browser, OS, language are non-PII
- Session ID is random UUID, not linked to user identity
- sessionStorage cleared on tab close

### SEC-3: Admin API authorization
- New aggregation queries only accessible to superadmin
- No new public endpoints added

### SEC-4: Raw SQL injection in new queries
- All 6 new queries use Prisma tagged template literals (parameterized)
- Resolution concatenation done in SQL (no user input interpolation)

## Regression Test Scope
- Existing analytics features (CR-28, CR-31) still work
- Visit tracking still fires on landing page
- Event tracking (scroll, CTA, time-on-page) still works
- Demo login logging unaffected
- Prune still deletes from all 3 tables
- Existing KPI cards still display correctly

## Bug Report Template
Use severity levels: Critical, High, Medium, Low
Tag with responsible skill: [Frontend], [Backend], [Architecture]
