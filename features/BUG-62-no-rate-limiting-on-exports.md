# BUG-62: No Rate Limiting on Export and Report Endpoints

**Status:** Open
**Reported:** 2026-03-14
**Severity:** Medium
**Skill Tag:** [Backend]
**Feature:** PROJ-8: Budget Matrix

---

## Description

### Expected Behavior
CPU/IO-intensive export endpoints (PDF, Excel, ZIP, Google Sheets) should be rate-limited to prevent resource exhaustion.

### Actual Behavior
None of the export or report generation endpoints apply rate limiting. Any authenticated user can trigger many concurrent PDF/Excel/ZIP generations or Google Sheets pushes.

## Environment

- **Files:**
  - `nextjs/app/api/reports/user/[email]/pdf/route.ts`
  - `nextjs/app/api/reports/budget-matrix/pdf/route.ts`
  - `nextjs/app/api/admin/export/excel/route.ts`
  - `nextjs/app/api/admin/export/images/route.ts`
  - `nextjs/app/api/admin/export/google-sheet/route.ts`
  - `nextjs/app/api/budget-matrix/bulk-update/route.ts`
- **Date:** 2026-03-14

## Root Cause

Rate limiters were added for bill creation and OCR analysis but not extended to export/report endpoints.

## Fix

Add rate limiters (e.g., 10 exports per minute per project) to all export endpoints using the existing `lib/ratelimit.ts` infrastructure.
