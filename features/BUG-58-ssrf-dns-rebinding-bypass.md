# BUG-58: SSRF Check Does Not Resolve DNS — DNS Rebinding Bypass Possible

**Status:** Open
**Reported:** 2026-03-14
**Severity:** Medium
**Skill Tag:** [Backend]
**Feature:** PROJ-19: OCR / AI Bill Analysis (Next.js)

---

## Description

### Expected Behavior
The SSRF protection for custom OCR provider URLs should block access to private/internal IP ranges even when a public hostname resolves to a private IP.

### Actual Behavior
`isPrivateUrl()` validates the hostname string against known private IP patterns but does not perform DNS resolution before making the HTTP request. An attacker could register `evil.example.com` resolving to `169.254.169.254` (AWS metadata) — the hostname check passes but the actual request hits the internal service.

## Steps to Reproduce

1. As an admin, set a custom OCR provider URL to `http://evil.example.com/v1/chat` (where that domain resolves to 169.254.169.254)
2. Trigger OCR analysis
3. The request bypasses the SSRF check and hits the internal metadata service

## Environment

- **File:** `nextjs/lib/ocr.ts` lines 78-94
- **Date:** 2026-03-14

## Root Cause

`isPrivateUrl` is a string-only check with no DNS resolution step.

## Fix

After validating the hostname string, resolve it via `dns.promises.lookup()` and run the IP check against the resolved address. Alternatively, use an allowlist of approved provider domains instead of a denylist.
