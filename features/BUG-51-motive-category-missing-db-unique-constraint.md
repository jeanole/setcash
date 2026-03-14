# BUG-51: No Database Unique Constraint on Motive/Category (projectId, name)

**Status:** Open
**Reported:** 2026-03-14
**Severity:** High
**Skill Tag:** [Backend]
**Feature:** PROJ-9: Categories & Motives Admin Pages

---

## Description

### Expected Behavior
It should be impossible to create two motives or categories with the same name in the same project, even under concurrent requests.

### Actual Behavior
Only an application-level `findFirst` duplicate check exists. Two concurrent POST requests from different admins can both pass the check and both insert, creating duplicate names.

## Steps to Reproduce

1. Send two simultaneous `POST /api/projects/<id>/motives` requests with the same name
2. Both return 201 — two motives with identical names are created

## Environment

- **File:** `nextjs/prisma/schema.prisma` lines 209-221 (Motive), 223-235 (Category)
- **Date:** 2026-03-14

## Root Cause

Neither `Motive` nor `Category` model has `@@unique([projectId, name])`. The `ProjectPosition` model at line 114 correctly has this constraint — it was missed for Motive/Category.

## Fix

Add to `schema.prisma`:
```prisma
model Motive {
  // ...existing fields...
  @@unique([projectId, name])
}

model Category {
  // ...existing fields...
  @@unique([projectId, name])
}
```
Then run `npx prisma migrate dev`.
