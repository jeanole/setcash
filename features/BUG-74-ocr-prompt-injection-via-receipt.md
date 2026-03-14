# BUG-74: OCR AI Response Parsed With Relaxed Regex — Prompt Injection Risk

**Status:** Open
**Reported:** 2026-03-14
**Severity:** Low
**Skill Tag:** [Backend]
**Feature:** PROJ-19: OCR / AI Bill Analysis (Next.js)

---

## Description

### Expected Behavior
AI-extracted field values should be sanitized before storage to prevent unexpected data from entering the database via crafted receipts.

### Actual Behavior
`parseOcrResponse` extracts JSON with `cleaned.match(/\{[\s\S]*\}/)` and writes string fields (vendor, item, type, date) directly to the database. A carefully crafted receipt image could induce the AI to return unexpected values in these fields.

## Environment

- **File:** `nextjs/lib/ocr.ts` lines 296-311
- **Date:** 2026-03-14

## Root Cause

No post-parse sanitization of AI-returned string fields beyond type casting. Prisma parameterization prevents SQL injection; React auto-escaping prevents XSS. This is a data quality and defense-in-depth concern.

## Fix

Add field-level validation after parsing:
- `vendor`, `item`: max length, strip control characters
- `type`: validate against known enum values
- `date`: validate as parseable date string before storing
