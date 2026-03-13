# BUG-12: Docker Test Container Build Fails with TypeScript Errors

**Status:** Resolved
**Reported:** 2026-03-05
**Severity:** High
**Skill Tag:** Backend
**Feature:** PROJ-4: Next.js App Scaffold + PostgreSQL + Docker

---

## Description

### Expected Behavior
Running `docker-compose -f docker-compose.test.yml up -d` should successfully build and start the Next.js test container with PostgreSQL.

### Actual Behavior
The Docker build fails with TypeScript compilation errors:

1. **Import Error:** Multiple API routes try to import `prisma` from `@/lib/db`, but it's not exported
   - Affected files: `members/[memberId]/route.ts`, `members/route.ts`, `positions/[posId]/route.ts`, `positions/route.ts`, `resign/route.ts`, `projects/[id]/route.ts`, `projects/route.ts`, `projects/switch/route.ts`

2. **Type Error (blocking):** In `app/(protected)/settings/page.tsx` line 35:
   ```
   Type error: Property 'sessionToken' does not exist on type 'Session'.
   ```
   Code: `'Cookie': \`next-auth.session-token=${session.sessionToken}\``

## Steps to Reproduce

1. Run `docker-compose -f docker-compose.test.yml up -d`
2. Build proceeds through npm install and Prisma generate
3. Build fails at `npm run build` step with TypeScript errors

## Environment

- **Docker:** Docker Compose test configuration
- **Service:** setcash-next (Next.js app)
- **Base Image:** node:20-alpine
- **Date/Time:** 2026-03-05

## Additional Context

Error log excerpt:
```
./app/api/projects/[id]/members/[memberId]/route.ts
Attempted import error: 'prisma' is not exported from '@/lib/db'

./app/(protected)/settings/page.tsx:35:52
Type error: Property 'sessionToken' does not exist on type 'Session'.
```

The issue is in the Next.js migration code (`nextjs/` directory), which is work-in-progress. The `session` object from NextAuth's `getServerSession()` doesn't expose `sessionToken` in its type definition.

---

## Resolution

**Status:** Open
**Resolved Date:** —
**Fixed In:** —
**Fix Description:** —
