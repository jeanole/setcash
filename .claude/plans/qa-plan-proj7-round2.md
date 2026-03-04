# QA Test Plan — PROJ-7 Round 2 (Bug Fix Verification)

## Feature
PROJ-7: Bills Feature — Bug Fix Verification  
Spec: `features/PROJ-7-bills-feature.md`

## Context Summary
- **Status:** In Progress — Bug fixes applied, need verification
- **Critical Bug Fixed:** BUG-10 — Hardcoded isAdmin now uses session role
- **Medium Bug Fixed:** BUG-11 — Rate limiting added to bill creation and analysis
- **Environment:** http://localhost:3001 (Docker test environment)

## User Guidance
- **Scope:** Focused verification of bug fixes + regression smoke test
- **Specific worries:** Verify isAdmin fix works correctly for all user roles
- **Test accounts:** 
  - Admin: admin@example.com / admin123
  - Need to verify regular user behavior (role = 'user')

## Bug Fixes to Verify

### BUG-10: isAdmin Fix (Critical)
**Fixed in:** `0493f33`
**Files changed:**
- `nextjs/app/(protected)/bills/page.tsx`
- `nextjs/app/(protected)/bills/[id]/page.tsx`

**Verification steps:**
1. Login as admin (role = 'admin' or 'superadmin')
   - Navigate to /bills — verify admin buttons visible
   - Navigate to /bills/[id] — verify Approve/Reject/Paid buttons visible
2. Login as regular user (role = 'user')
   - Navigate to /bills — verify admin buttons HIDDEN
   - Navigate to /bills/[id] — verify Approve/Reject/Paid buttons HIDDEN
3. Verify API still rejects unauthorized admin actions (403)

### BUG-11: Rate Limiting (Medium)
**Fixed in:** `0493f33`
**Files changed:**
- `nextjs/lib/ratelimit.ts` (new)
- `nextjs/app/api/bills/route.ts`
- `nextjs/app/api/bills/[id]/analyse/route.ts`

**Verification steps:**
1. Code review: Verify rate limiting middleware is applied
2. Verify limits: 10 req/min for bill creation, 5 req/min for analysis
3. Verify 429 response when limit exceeded (if testable)
4. Verify mock rate limiter allows requests in dev mode

## Regression Test Scope
Quick smoke test of core flows:
- Bill list loads correctly
- Bill creation works
- Bill detail page loads
- Image upload works
- No console errors

## Security Audit Scope
Focus on authorization:
- Confirm isAdmin check uses session.role
- Verify role-based access control works end-to-end
- Confirm rate limiting doesn't break legitimate usage

## Test Plan
1. **BUG-10 Verification** (Admin vs User role testing)
2. **BUG-11 Verification** (Rate limiting code review + basic test)
3. **Regression Smoke Test** (Core flows)
4. **Security Confirmation** (Authorization checks)

## Notes
- The previous QA found 14/16 AC passed — this round focuses on the 2 failures
- After fixes pass, feature should be production-ready
