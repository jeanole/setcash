# BUG-52: Motive/Category Name Not Trimmed — Whitespace-Only Names Accepted

**Status:** Open
**Reported:** 2026-03-14
**Severity:** High
**Skill Tag:** [Backend]
**Feature:** PROJ-9: Categories & Motives Admin Pages

---

## Description

### Expected Behavior
Leading/trailing whitespace should be trimmed from names. Whitespace-only names should be rejected.

### Actual Behavior
The Zod schema `z.string().min(1).max(100)` has no `.trim()`. A name of `"  "` (two spaces) passes `min(1)` validation and is stored. `" Equipment "` and `"Equipment"` are treated as different, unique names.

## Steps to Reproduce

1. `POST /api/projects/<id>/motives` with `{ "name": "  " }` — returns 201
2. `POST /api/projects/<id>/motives` with `{ "name": " Equipment " }` — creates separate motive from "Equipment"

## Environment

- **Files:**
  - `nextjs/app/api/projects/[id]/motives/route.ts` lines 6-9
  - `nextjs/app/api/projects/[id]/motives/[motiveId]/route.ts` lines 6-8
  - `nextjs/app/api/projects/[id]/categories/route.ts` (equivalent)
  - `nextjs/app/api/projects/[id]/categories/[categoryId]/route.ts` (equivalent)
- **Date:** 2026-03-14

## Root Cause

`.trim()` not chained in Zod schema definition.

## Fix

Update all four Zod schemas:
```ts
name: z.string().trim().min(1).max(100)
```
