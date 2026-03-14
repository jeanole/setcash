# BUG-61: User PDF Content-Disposition Filename Built from Unsanitized Email

**Status:** Open
**Reported:** 2026-03-14
**Severity:** Medium
**Skill Tag:** [Backend]
**Feature:** PROJ-11: Reports & Exports

---

## Description

### Expected Behavior
The `Content-Disposition` header filename should contain only safe characters.

### Actual Behavior
The filename is built from `targetEmail.split('@')[0]` without sanitizing special characters. Email local parts can contain `"`, `\`, or CRLF sequences, which are placed directly into the HTTP response header, enabling potential header injection.

## Environment

- **File:** `nextjs/app/api/reports/user/[email]/pdf/route.ts` line 407
- **Date:** 2026-03-14

## Root Cause

No sanitization step between email extraction and header value construction.

## Fix

Sanitize the local part before using in the filename:
```ts
const safeName = emailLocal.replace(/[^a-zA-Z0-9_\-]/g, '_');
```
