# BUG-69: Invite Route Creates Its Own PrismaClient Instead of Using Shared Singleton

**Status:** Open
**Reported:** 2026-03-14
**Severity:** Medium
**Skill Tag:** [Backend]
**Feature:** PROJ-10: Members, Projects & Settings

---

## Description

### Expected Behavior
All API routes should import the shared Prisma singleton from `@/lib/db` to use the shared connection pool.

### Actual Behavior
`nextjs/app/api/projects/[id]/invite/route.ts` lines 8-10 create their own `PrismaClient` instance using the `globalForPrisma` pattern, duplicating the singleton logic instead of using the centralized `lib/db.ts` import.

## Environment

- **File:** `nextjs/app/api/projects/[id]/invite/route.ts` lines 8-10
- **Date:** 2026-03-14

## Root Cause

Copy-paste of the singleton initialization code instead of importing from `lib/db`.

## Fix

Replace the local PrismaClient initialization with:
```ts
import { prisma } from '@/lib/db';
```
