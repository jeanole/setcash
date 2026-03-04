# BUG-11: Missing Rate Limiting on Bill Creation and Re-analysis

**Status:** Resolved  
**Reported:** 2026-03-04  
**Severity:** Medium  
**Skill Tag:** [Backend]  
**Feature:** PROJ-7: Bills Feature

## Description

### Expected Behavior
API endpoints should have rate limiting to prevent abuse through rapid requests.

### Actual Behavior
No rate limiting is implemented on bill creation or re-analysis endpoints.

### Affected Endpoints
- `POST /api/bills` - Bill creation
- `POST /api/bills/[id]/analyse` - OCR re-analysis

### Impact
- Potential for abuse through rapid bill creation
- Repeated OCR analysis could exhaust API quotas
- Denial of service risk

### Recommended Fix
Implement rate limiting using `@upstash/ratelimit` or similar:
- Bill creation: 10 requests per minute per user
- Re-analysis: 5 requests per minute per user

---

## Resolution
**Status:** Resolved  
**Resolved Date:** 2026-03-04  
**Fixed In:** TBD  
**Fix Description:** 
- Added `@upstash/ratelimit` and `@upstash/redis` dependencies
- Created `nextjs/lib/ratelimit.ts` utility with configurable rate limiters
- Implemented rate limiting on `POST /api/bills` (10 req/min per user)
- Implemented rate limiting on `POST /api/bills/[id]/analyse` (5 req/min per user)
- Returns HTTP 429 "Too Many Requests" when rate limit is exceeded
- Added mock rate limiter for local development when Redis is not configured
