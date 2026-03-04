# BUG-10: Hardcoded isAdmin Flag Exposes Admin UI to All Users

**Status:** Resolved  
**Reported:** 2026-03-04  
**Severity:** Critical  
**Skill Tag:** [Frontend]  
**Feature:** PROJ-7: Bills Feature

## Description

### Expected Behavior
Admin buttons (Approve, Reject, Mark Paid, Re-analyse) should only be visible to users with `role === 'admin'` or `role === 'superadmin'`.

### Actual Behavior
The `isAdmin` flag is hardcoded to `true` in both bill pages, causing all users to see admin controls regardless of their actual role.

### Affected Files
1. `nextjs/app/(protected)/bills/page.tsx` (line 72)
2. `nextjs/app/(protected)/bills/[id]/page.tsx` (line 125)

### Steps to Reproduce
1. Log in as a non-admin user (role = 'user')
2. Navigate to `/bills`
3. Observe admin buttons are visible
4. Navigate to any `/bills/[id]`
5. Observe admin action buttons (Approve, Reject, Mark Paid) are visible

### Root Cause
```typescript
// Line 72 in page.tsx and line 125 in [id]/page.tsx
const isAdmin = true; // TODO: Get from auth context
```

### Fix Required
Replace with proper auth context check:
```typescript
const isAdmin = session?.user?.role === 'admin' || session?.user?.role === 'superadmin';
```

### Impact
- **Security:** Non-admin users can see admin controls (though API correctly rejects unauthorized actions)
- **UX:** Confusing interface for regular users
- **Deployment Blocker:** YES - This is a critical security issue

---

## Resolution
**Status:** Resolved  
**Resolved Date:** 2026-03-04  
**Fixed In:** 0493f33  
**Fix Description:**
- Replaced hardcoded `isAdmin = true` with `useSession()` hook from `next-auth/react`
- `isAdmin` now correctly checks `session?.user?.role === 'admin' || session?.user?.role === 'superadmin'`
- Applied fix to both files:
  - `nextjs/app/(protected)/bills/page.tsx`
  - `nextjs/app/(protected)/bills/[id]/page.tsx`
- Admin buttons now only display for users with 'admin' or 'superadmin' role
