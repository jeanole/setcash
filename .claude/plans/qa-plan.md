# QA Test Plan

## Bug Fix Verification
BUG-9: Rate limiting not applied to auth endpoints

## Context Summary

### The Fix
Commit `41632c2` moved rate limiting from middleware (which was excluded by matcher) to the API route level:
- **Created**: `nextjs/app/api/auth/callback/credentials/route.ts`
- **Modified**: `nextjs/middleware.ts` (removed dead rate limiting code)

### Rate Limiting Rules
- 5 attempts per 60 seconds per IP
- 6th attempt returns 429 with `Retry-After: 60` header
- After 60 seconds, counter resets

## User Guidance
- **Scope**: Rate limiting only — verify the fix works
- **Test accounts**: admin@example.com / admin123
- **No specific worries**

## Tests to Execute

### 1. Rate Limiting Functional Test

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | POST invalid credentials (wrong password) | Returns error (401/redirect) |
| 2 | POST invalid credentials (2nd attempt) | Returns error |
| 3 | POST invalid credentials (3rd attempt) | Returns error |
| 4 | POST invalid credentials (4th attempt) | Returns error |
| 5 | POST invalid credentials (5th attempt) | Returns error |
| 6 | POST invalid credentials (6th attempt) | Returns 429 "Too many login attempts" |
| 7 | Check response headers | Has `Retry-After: 60` |

### 2. Rate Limit Reset Test

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Trigger rate limit (6 failed attempts) | 429 returned |
| 2 | Wait 60 seconds | - |
| 3 | POST invalid credentials again | Returns error (not 429) — counter reset |

### 3. Valid Login Test

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Reset rate limit (wait if needed) | - |
| 2 | POST valid credentials | Login succeeds (200/redirect to /dashboard) |
| 3 | Check session cookie | `authjs.session-token` set |

### 4. Regression Test

| Test | Expected Result |
|------|-----------------|
| `/api/auth/session` without auth | Returns 200 (public endpoint) |
| `/api/auth/providers` | Returns 200 with provider list |
| `/dashboard` without auth | Redirects to /login |
| `/api/health` | Returns 200 without auth |

## Success Criteria

- [ ] 6th failed login attempt returns 429
- [ ] 429 response includes `Retry-After: 60` header
- [ ] After 60s, rate limit resets
- [ ] Valid login works normally
- [ ] No regressions in other auth endpoints

## Test Environment

- **URL**: http://localhost:3001
- **Docker**: `docker-compose -f docker-compose.test.yml up --build`
- **Endpoint**: POST `/api/auth/callback/credentials`
