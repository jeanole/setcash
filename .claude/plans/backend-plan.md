# Backend Implementation Plan — CR-25

## Feature
CR-25: Any User Can Create Transfer; Admin Confirms; Show Confirmed By
Feature spec: `features/PROJ-15-vgeld-advance-money.md`
Tech design revision: "## Tech Design Revision (CR-25)" in same file

## Context Summary
- V-Geld feature (PROJ-15) is fully implemented and passed QA Round 4
- Current model: admin-only creates transfers, no confirmation step
- Existing files:
  - `nextjs/app/api/vgeld/route.ts` — GET (list) + POST (create, admin-only)
  - `nextjs/app/api/vgeld/[id]/route.ts` — DELETE (admin-only)
  - `nextjs/app/api/vgeld/analysis/route.ts` — GET summary (no change needed)
  - `nextjs/app/api/vgeld/balance/route.ts` — GET balance (no change needed)
  - `nextjs/prisma/schema.prisma` — `Vgeld` model (lines 257-271)

## User Decisions
- Balance calculation is unchanged (all transfers count regardless of confirmed status)
- No separate status field — `confirmedBy IS NULL` = unconfirmed
- `confirmedBy` stores admin email (consistent with `createdBy` pattern)
- PATCH method for confirm endpoint
- Priority: Medium

## Open Bug Reports to Address
None.

## Step 1: Schema Change

Add one field to the existing `Vgeld` model in `nextjs/prisma/schema.prisma`:

```prisma
confirmedBy String?   // Email of admin who confirmed; null = unconfirmed
```

Place it after the `createdBy` field (line 265). Then generate a migration:
```bash
cd nextjs && npx prisma migrate dev --name add-vgeld-confirmed-by
```

## Step 2: Modify GET /api/vgeld

**File:** `nextjs/app/api/vgeld/route.ts`

In the `mapped` array (lines 60-67), add `confirmedBy` to the response object:
```
confirmedBy: t.confirmedBy ?? null,
```

No auth changes needed — GET already allows all project members.

## Step 3: Modify POST /api/vgeld

**File:** `nextjs/app/api/vgeld/route.ts`

Change the authorization check (lines 89-104) from admin-only to any project member:

**Current logic (remove):**
```
const isSuperAdmin = session.user.role === 'superadmin';
const isAdmin = membership?.role === 'admin' || membership?.role === 'owner';
if (!isSuperAdmin && !isAdmin) {
  return 403 'Forbidden: admin access required';
}
```

**New logic (replace with):**
```
if (!membership && session.user.role !== 'superadmin') {
  return 403 'Forbidden';
}
```

This is the same pattern used in GET — any project member can create.

Do NOT set `confirmedBy` on creation — it stays null until admin confirms.

## Step 4: Add PATCH handler for confirm

**File:** `nextjs/app/api/vgeld/[id]/route.ts` — add alongside existing DELETE

**Auth:** Admin/owner/superadmin only (same pattern as DELETE)
**Logic:**
1. Verify session → 401
2. Verify projectId → 400
3. Verify membership with admin/owner role or superadmin → 403
4. Find transfer by `id` WHERE `projectId` matches → 404 if not found
5. If `transfer.confirmedBy` is already set → 400 "Transfer already confirmed"
6. `prisma.vgeld.update({ where: { id }, data: { confirmedBy: session.user.email } })`
7. Return `{ ok: true, confirmedBy: session.user.email }`

No request body needed — the only input is the URL param `id`.

## Files NOT Modified
- `nextjs/app/api/vgeld/analysis/route.ts` — balance calculation unchanged
- `nextjs/app/api/vgeld/balance/route.ts` — balance calculation unchanged
- `nextjs/app/(protected)/vgeld/page.tsx` — frontend changes handled by /frontend

## Checklist
- [ ] Add `confirmedBy String?` to Vgeld model in schema.prisma
- [ ] Run `npx prisma migrate dev --name add-vgeld-confirmed-by`
- [ ] Modify GET /api/vgeld to include `confirmedBy` in response
- [ ] Modify POST /api/vgeld to allow any project member (not admin-only)
- [ ] Add PATCH handler in /api/vgeld/[id]/route.ts for confirm action
- [ ] PATCH checks admin/owner/superadmin role
- [ ] PATCH returns 400 if already confirmed
- [ ] PATCH returns 404 if transfer not found in project
- [ ] Verify TypeScript compiles (`npx tsc --noEmit`)
