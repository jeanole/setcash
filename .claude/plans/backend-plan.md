# Backend Implementation Plan

## Bug Fix
BUG-9: Rate limiting not applied to auth endpoints

## Context Summary

### Root Cause
The middleware.ts has rate limiting code for `/api/auth/callback/credentials`, but the matcher config excludes ALL `/api/auth/*` routes:

```javascript
matcher: ['/((?!api/auth|_next/static|...).*))']
```

This means the middleware never executes for the credentials callback, so rate limiting is never triggered.

### Current State
- Rate limiting code exists in middleware.ts (5 attempts per 60s per IP)
- Matcher excludes `/api/auth/*` routes
- The credentials callback needs rate limiting to prevent brute force

## Solution

Move rate limiting from middleware to the API route level:

1. **Create dedicated credentials route** that wraps NextAuth with rate limiting
2. **Remove rate limiting from middleware** (keep auth protection)
3. **Update NextAuth config** to expose credentials provider separately

## Implementation Steps

### 1. Create `nextjs/app/api/auth/callback/credentials/route.ts`

New file that:
- Implements in-memory rate limiting (same logic as middleware)
- Wraps the credentials authorization
- Returns 429 when rate limited
- Falls through to NextAuth handler when allowed

### 2. Update `nextjs/middleware.ts`

Remove the rate limiting code block (lines 40-56) since it never executes anyway.

### 3. Update `nextjs/auth.ts` (if needed)

Ensure credentials provider is properly configured for external authorization.

## Testing

After fix:
1. 5 failed login attempts from same IP should succeed
2. 6th attempt should return 429 "Too many login attempts"
3. After 60 seconds, attempts should succeed again
4. Valid login should work normally
5. Other auth endpoints (/api/auth/session, etc.) should not be rate limited

## Checklist

- [ ] Create credentials API route with rate limiting
- [ ] Remove rate limiting from middleware
- [ ] Test rate limiting works (5 attempts, then 429)
- [ ] Test valid login still works
- [ ] Test other auth endpoints unaffected
