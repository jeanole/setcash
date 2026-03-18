# Backend Implementation Plan — CR-28: Visit Analytics & Demo Tracking

## Feature
CR-28: Insights into Site Visits and Demo Usage
Spec: `features/PROJ-23-visit-analytics-demo-tracking.md` → `### CR-28` section

## Context Summary

### Existing Patterns
- **Superadmin auth:** `session.user.role !== 'superadmin'` → 403 (see `superadmin/system-config/route.ts`)
- **DB imports:** `import { db as prisma } from '@/lib/db'` (convention)
- **Rate limiting:** `createRateLimiter()` from `lib/ratelimit.ts`
- **Zod validation:** All inputs validated before processing
- **Superadmin tabs:** `TabType = 'projects' | 'users' | 'config'` — add `'analytics'`
- **`recharts`:** Already installed (`^3.8.0`)

### Demo Login Route
- `POST /api/auth/demo-login` — validates Turnstile token with Cloudflare, returns demo credentials
- Extension point: add `DemoLoginAttempt` logging after Turnstile check, before returning response

## User Decisions (from discussion)
1. **Display:** KPI numbers + simple daily charts + raw log table
2. **IP handling:** Country code only via `CF-IPCountry` header — no IP stored
3. **Pruning:** Manual prune button triggered by super-admin, 90-day retention default
4. **Public visit endpoint:** No auth required (landing page visitors not logged in)

## Open Bug Reports to Address
None for PROJ-23.

## Tables to Create (Prisma migration)

### VisitLog
| Column | Type | Notes |
|---|---|---|
| id | String (UUID) | Primary key, auto-generated |
| timestamp | DateTime | Default: now() |
| countryCode | String? | 2-letter ISO code from CF-IPCountry header, nullable |
| deviceType | String | "mobile", "desktop", or "bot" |
| path | String | Page path, e.g. "/" |

- Index on `timestamp` (for pruning + aggregation)
- No foreign keys — standalone table

### DemoLoginAttempt
| Column | Type | Notes |
|---|---|---|
| id | String (UUID) | Primary key, auto-generated |
| timestamp | DateTime | Default: now() |
| countryCode | String? | Same as above |
| turnstileSuccess | Boolean | Did Cloudflare Turnstile pass? |
| loginSuccess | Boolean | Did credential sign-in succeed? |

- Index on `timestamp` (for pruning + aggregation)
- No foreign keys — standalone table

## API Endpoints to Implement

### 1. POST `/api/analytics/visit` — Log a landing page visit

**File:** `nextjs/app/api/analytics/visit/route.ts`
**Auth:** None (public) — landing page visitors are not logged in
**Rate limit:** `visitLogLimiter` — 30 requests per minute per IP (prevents abuse)
**Input validation (Zod):**
```
{ path: z.string().max(200).optional().default("/") }
```
**Logic:**
1. Rate limit using IP from `x-forwarded-for` or `x-real-ip`
2. Read `CF-IPCountry` header → countryCode (or null)
3. Classify User-Agent → "mobile", "desktop", or "bot" (simple regex: check for common bot UA strings, then mobile keywords)
4. Insert `VisitLog` row
5. Return 204 No Content (fire-and-forget, no response body)

**Response:** `204 No Content`
**Errors:** 429 (rate limit), 500

### 2. GET `/api/admin/analytics` — Fetch analytics dashboard data

**File:** `nextjs/app/api/admin/analytics/route.ts`
**Auth:** Superadmin only (`session.user.role !== 'superadmin'` → 403)
**Query params:**
```
page: z.string().optional().transform(v => parseInt(v || '1')).pipe(z.number().int().min(1))
pageSize: z.string().optional().transform(v => parseInt(v || '25')).pipe(z.number().int().min(1).max(100))
```

**Logic:**
1. Auth + superadmin check
2. Compute KPIs:
   - Total visits (all time): `prisma.visitLog.count()`
   - Visits last 7 days: `prisma.visitLog.count({ where: { timestamp: { gte: 7daysAgo } } })`
   - Demo logins last 7 days: `prisma.demoLoginAttempt.count({ where: { timestamp: { gte: 7daysAgo } } })`
   - Demo success rate: count where `loginSuccess === true` / total demo logins last 7 days
3. Daily visit aggregates (last 30 days): group by date, count per day
   - Use raw query or Prisma groupBy with date truncation
4. Demo login log (paginated): `prisma.demoLoginAttempt.findMany({ orderBy: { timestamp: 'desc' }, take: pageSize, skip: (page-1)*pageSize })`
5. Total demo login count for pagination

**Response:**
```
{
  kpi: {
    totalVisits: number,
    visitsLast7Days: number,
    demoLoginsLast7Days: number,
    demoSuccessRate: number (0-100)
  },
  dailyVisits: [ { date: "2026-03-17", count: 42 }, ... ],  // last 30 days
  demoLog: {
    items: [ { id, timestamp, countryCode, turnstileSuccess, loginSuccess }, ... ],
    total: number,
    page: number,
    pageSize: number
  }
}
```
**Errors:** 401, 403, 500

### 3. DELETE `/api/admin/analytics/prune` — Delete old records

**File:** `nextjs/app/api/admin/analytics/prune/route.ts`
**Auth:** Superadmin only
**Logic:**
1. Auth + superadmin check
2. Calculate cutoff: `new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)`
3. Delete in transaction:
   - `prisma.visitLog.deleteMany({ where: { timestamp: { lt: cutoff } } })`
   - `prisma.demoLoginAttempt.deleteMany({ where: { timestamp: { lt: cutoff } } })`
4. Return counts

**Response:** `200 { visits: N, demoLogins: M }`
**Errors:** 401, 403, 500

### 4. Extend POST `/api/auth/demo-login` — Add attempt logging

**File:** `nextjs/app/api/auth/demo-login/route.ts` (existing, modify)
**Logic changes:**
1. Read `CF-IPCountry` header + `x-forwarded-for` for rate limit
2. After Turnstile check:
   - If Turnstile fails → `prisma.demoLoginAttempt.create({ turnstileSuccess: false, loginSuccess: false })`
   - If Turnstile passes → `prisma.demoLoginAttempt.create({ turnstileSuccess: true, loginSuccess: true })`
   - (Login is always true if Turnstile passes, since demo credentials are hardcoded)
3. Country code from `CF-IPCountry` header

## Rate Limiting Addition

**File:** `nextjs/lib/ratelimit.ts`
- Add: `visitLog: { max: 30, window: '1 m', name: 'visit_log' }`
- Export: `visitLogLimiter`

## UA Classification Utility

**File:** `nextjs/lib/analytics.ts`

Function `classifyUA(userAgent: string | null): 'mobile' | 'desktop' | 'bot'`
- Check for common bot indicators: "bot", "crawler", "spider", "Googlebot", etc.
- Check for mobile indicators: "Mobile", "Android", "iPhone", "iPad"
- Default: "desktop"

Function `getCountryCode(req: NextRequest): string | null`
- Read `CF-IPCountry` header (Cloudflare automatic)
- Return 2-letter code or null

## Frontend Integration (done in /frontend phase)
- New `AnalyticsTab` component in SuperAdminModal
- `TabType` extended to include `'analytics'`

## Implementation Order
1. Add `VisitLog` + `DemoLoginAttempt` to `prisma/schema.prisma`
2. Run `npx prisma migrate dev --name add-analytics-tables`
3. Create `lib/analytics.ts` — UA classifier + country helper
4. Add `visitLog` rate limiter to `lib/ratelimit.ts`
5. Create `POST /api/analytics/visit/route.ts`
6. Create `GET /api/admin/analytics/route.ts`
7. Create `DELETE /api/admin/analytics/prune/route.ts`
8. Extend `POST /api/auth/demo-login/route.ts` with attempt logging

## Checklist
- [ ] Prisma schema updated with both new models
- [ ] Migration generated and applied
- [ ] All API routes validate input with Zod
- [ ] Superadmin-only routes check `session.user.role === 'superadmin'`
- [ ] Public visit route has rate limiting (30/min per IP)
- [ ] No IP addresses stored anywhere
- [ ] Country code from CF-IPCountry header only
- [ ] UA classification is simple regex (no external package)
- [ ] Demo login route logs attempts (both success and failure)
- [ ] Analytics GET returns KPIs, daily aggregates, paginated demo log
- [ ] Prune deletes records older than 90 days in a transaction
- [ ] Indexes on timestamp columns in both tables
- [ ] No secrets in source code
- [ ] TypeScript compiles cleanly
