# QA Test Plan

## Feature
PROJ-5: NextAuth.js Authentication
Feature spec: `features/PROJ-5-nextauth-authentication.md`

## Context Summary

### Previous QA Status
The previous QA (2026-03-03) was **blocked by a stale Docker image** - the PROJ-5 code was in git but the running container was built from PROJ-4. All live tests failed with 404s or showed placeholder content.

### Recent Fixes Applied
Commit `ffbf654` indicates these bugs were fixed:
- Middleware auth bypass issues
- Rate limiting on auth endpoints  
- Security headers (X-Frame-Options, HSTS, etc.)
- Dockerfile migration deployment

### Current Status
- PROJ-5 marked as "Complete" in INDEX.md
- Docker image should now contain all PROJ-5 code
- Need to verify all previously-blocked tests now pass

## User Guidance
- **Scope**: Focus on previously failed/blocked items from last QA
- **Test accounts**: Default admin from seed (admin@example.com / admin123)
- **Specific worries**: None

## Previously Failed Items to Re-Test

### Critical - Docker/Image Issues (Should be Fixed)

| Item | Previous Status | What to Test |
|------|-----------------|--------------|
| BUG-1 | Docker image stale | Rebuild and verify login page shows LoginForm (not placeholder) |
| BUG-2 | API routes 404 | Verify `/api/auth/session`, `/api/auth/providers` return JSON |
| BUG-3 | /dashboard accessible without auth | Verify unauthenticated requests redirect to /login |
| BUG-4 | isActive column missing | Verify migration runs on container startup |

### High Priority - Auth Functionality (Previously Blocked)

| Item | Previous Status | What to Test |
|------|-----------------|--------------|
| AC-1 | Live endpoints 404 | Test all NextAuth endpoints live |
| AC-2 | Cannot live-test login | Test email + password login flow |
| AC-6 | Middleware not protecting | Verify protected route redirects |
| AC-7 | Login page placeholder | Verify LoginForm renders with fields |

### Medium/Low Priority (Verify Fixes)

| Item | Previous Status | What to Test |
|------|-----------------|--------------|
| BUG-5 | /api/health not public | Verify health endpoint returns 200 without auth |
| BUG-9 | No rate limiting | Test that 5+ failed logins trigger rate limit |
| BUG-10 | No security headers | Verify HSTS, X-Frame-Options present |
| BUG-11 | No Zod validation | Verify email format validation works |
| BUG-12 | Nested SessionProviders | Verify only one SessionProvider exists |

## Edge Cases to Test

| Edge Case | Previous Status | What to Test |
|-----------|-----------------|--------------|
| EC-1 | Cannot live-test Google-only | Create Google user, try credentials login |
| EC-2 | isActive column missing | Test disabled account login (if possible) |
| EC-5 | Google users no project | Create new Google user, verify behavior |

## Security Audit Scope

Focus on items that were previously flagged:

1. **Rate Limiting** (BUG-9 fix verification)
   - Test 5 failed logins from same IP
   - Verify 6th attempt is blocked with 429

2. **Security Headers** (BUG-10 fix verification)
   - Verify Strict-Transport-Security header present
   - Verify X-Frame-Options: DENY
   - Verify X-Content-Type-Options: nosniff

3. **Protected Route Bypass** (BUG-3 fix verification)
   - Test /dashboard without session cookie
   - Verify 302 redirect to /login
   - Test with invalid session cookie

4. **Input Validation** (BUG-11 fix verification)
   - Test invalid email format
   - Test SQL injection in email field
   - Test XSS in email field

5. **Exposed Secrets**
   - Verify no secrets in API responses
   - Verify passwordHash not in JWT/session

## Regression Test Scope

Minimal - only verify PROJ-4 health endpoint still works:
- `GET /api/health` returns `{"status":"ok"}`
- `GET /` returns 200

## Test Environment

- **URL**: http://localhost:3001
- **Docker**: `docker-compose -f docker-compose.test.yml up --build`
- **Credentials**: admin@example.com / admin123

## Bug Report Template

Use format from `.claude/skills/bug-report/SKILL.md`:
- Tag with skill: [Backend], [Frontend], or [Deploy]
- Include severity: Critical, High, Medium, Low
- Reference the original bug ID if it's a regression (e.g., "BUG-4 regression")
