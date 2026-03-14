# BUG-79: Telegram Link Code Generation Has Slight Modular Bias

**Status:** Open
**Reported:** 2026-03-14
**Severity:** Low
**Skill Tag:** [Backend]
**Feature:** PROJ-12: Integrations (Google Sheets + Telegram)

---

## Description

### Expected Behavior
Link code character selection should be uniformly distributed across the alphabet.

### Actual Behavior
`bytes[i] % ALPHABET.length` where ALPHABET has 36 characters — since 256 % 36 = 4, characters at indices 0-3 (A, B, C, D) have a ~0.39% higher probability than others.

## Environment

- **File:** `nextjs/lib/telegram/codes.ts` lines 18-25
- **Date:** 2026-03-14

## Root Cause

Modular reduction of a uniform byte distribution over a non-power-of-2 alphabet. Negligible practical impact given 6-char code + 10-minute TTL.

## Fix

Use `crypto.randomInt(36)` or rejection sampling to eliminate bias.
