# BUG-77: File Upload Validates Type by Extension Only, Not Magic Bytes

**Status:** Open
**Reported:** 2026-03-14
**Severity:** Low
**Skill Tag:** [Backend]
**Feature:** PROJ-7: Bills Feature

---

## Description

### Expected Behavior
File type validation should check actual file content (magic bytes), not just the client-supplied filename extension.

### Actual Behavior
`lib/upload.ts` filter checks `path.extname(part.originalFilename)` — a client-supplied value. An attacker can upload an HTML file renamed to `.jpg` and it will pass the filter. Mitigated in practice by `X-Content-Type-Options: nosniff` header.

## Environment

- **File:** `nextjs/lib/upload.ts` lines 55-58
- **Date:** 2026-03-14

## Root Cause

Extension-based check is easy to bypass.

## Fix

Use the `file-type` npm package to detect MIME type from magic bytes after initial receipt, and reject files whose detected type does not match the allowed list.
