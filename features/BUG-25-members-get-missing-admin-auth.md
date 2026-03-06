# BUG-25: GET Members API Missing Admin-Only Authorization

## Status: Resolved
**Severity:** Medium
**Feature:** PROJ-10 (Members, Projects & Settings)
**Reported:** 2026-03-06
**Found in:** QA Round 2 Security Audit (PROJ-10)

## Description

`GET /api/projects/[id]/members` returns the full member list (email, role,
position) to any authenticated project member, including regular users with
the `user` role. The spec states member management is "Admin/Owner only".

## Steps to Reproduce

1. Sign in as a regular user (role: `user`) who is a member of a project
2. `GET /api/projects/{projectId}/members`
3. Full member list is returned: `[{ email, role, positionId, positionName }]`

## Expected

HTTP 403 with `"Forbidden: admin or owner role required"`

## Root Cause

The GET handler in `nextjs/app/api/projects/[id]/members/route.ts` checks
only that the user is a project member, not that they are an admin or owner:

```typescript
// Current (permissive):
const member = await prisma.projectMember.findUnique({ ... });
if (!member) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

// Missing:
if (member.role === 'user') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
```

## Impact

Information disclosure: regular users can enumerate all member emails, roles,
and positions via direct API call, even though the Members tab is hidden in
the UI. Low exploitability (requires valid session), but violates the
principle of least privilege.

## Fix

Add role check after the membership check in the GET handler:

```typescript
if (!member || (member.role === 'user' && !isSuperAdmin)) {
  return NextResponse.json({ error: 'Forbidden: admin or owner role required' }, { status: 403 });
}
```

## Files Affected

- `nextjs/app/api/projects/[id]/members/route.ts` (GET handler)
