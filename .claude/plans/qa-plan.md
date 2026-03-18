# QA Test Plan — CR-28: Visit Analytics & Demo Tracking

## Feature
CR-28: Insights into Site Visits and Demo Usage
Spec: `features/PROJ-23-visit-analytics-demo-tracking.md`

## Context Summary
- Backend committed: `3526f5b` — Prisma models, 3 API routes, lib/analytics.ts, rate limiter, demo-login extension
- Frontend committed: `780dce4` — AnalyticsTab, SuperAdminModal update, VisitTracker, types/barrel
- Dependencies: PROJ-22 (Demo account), PROJ-5 (Auth)

## User Guidance
- Full scope: test all acceptance criteria, edge cases, security, and regression
- Credentials: localhost:3000 / default admin

## Acceptance Criteria to Test

### AC-1: Landing page visits logged
- Visit `POST /api/analytics/visit` with `{ path: "/" }` → 204
- Verify VisitLog row created with timestamp, path, deviceType, countryCode
- Test: `VisitTracker` component fires on landing page mount

### AC-2: Demo login attempts logged
- Attempt demo login → `DemoLoginAttempt` row created
- Both Turnstile success/fail and login success/fail recorded

### AC-3: Analytics tab in SuperAdmin modal
- SuperAdmin modal shows 4 tabs: Projects, Users, Config, Analytics
- Clicking Analytics tab renders AnalyticsTab component

### AC-4: KPI cards display
- 4 KPI cards: Total Visits, Visits (7d), Demo Logins (7d), Success Rate
- Values match actual DB counts

### AC-5: Daily visit chart
- Bar chart shows last 30 days of visit data
- Empty state shown when no data
- Recharts BarChart renders correctly

### AC-6: Demo login log table
- Table shows timestamp, country, turnstile result, login result
- Paginated at 25 per page
- Pagination controls work (Previous/Next)
- Empty state shown when no data

### AC-7: Manual prune button
- Prune button deletes records >90 days
- Confirmation dialog shown before deletion
- Toast shows count of deleted records
- Data refreshes after prune

### AC-8: No external analytics service
- All data stored in PostgreSQL via Prisma
- No third-party analytics scripts loaded

### AC-9: GDPR compliant
- No full IP stored in VisitLog or DemoLoginAttempt
- No cookies set for tracking
- No fingerprinting
- Country code derived from CF-IPCountry header only

## Edge Cases to Test
- Visit endpoint with missing/empty body → should still work (204)
- Visit endpoint with invalid JSON → 400
- Visit endpoint with very long path string → truncated or rejected
- Analytics GET with invalid page/pageSize params → 400
- Analytics GET with page beyond range → empty items array
- Prune when no old records exist → returns { visits: 0, demoLogins: 0 }
- Chart with only 1 day of data → single bar renders
- Demo log with exactly 25 items → no Next button or Next disabled
- AnalyticsTab loaded with zero data in all tables → all empty states shown
- Rate limiting: >30 visits/min from same IP → 429

## Security Audit Scope
- **Auth bypass:** GET /api/admin/analytics without auth → 401
- **Auth bypass:** GET /api/admin/analytics as non-superadmin → 403
- **Auth bypass:** DELETE /api/admin/analytics/prune without auth → 401
- **Auth bypass:** DELETE /api/admin/analytics/prune as non-superadmin → 403
- **Public endpoint abuse:** POST /api/analytics/visit rate limiting works (30/min)
- **Injection:** POST /api/analytics/visit with XSS in path field → sanitized/safe
- **SQL injection:** POST /api/analytics/visit with SQL in body → parameterized query safe
- **Data exposure:** GET /api/admin/analytics does not leak IP addresses
- **No PII:** VisitLog and DemoLoginAttempt schemas contain no email/IP fields

## Regression Test Scope
- SuperAdmin modal still opens and all existing tabs (Projects, Users, Config) work
- Demo login flow still works end-to-end
- Landing page still renders correctly with VisitTracker added

## Responsive / Cross-Browser Scope
- KPI grid: 2 cols on mobile (375px), 4 cols on desktop (1440px)
- Demo log table: horizontal scroll on mobile
- Prune section: stacks vertically on mobile

## Bug Report Template
Reference: .claude/skills/qa/test-template.md
