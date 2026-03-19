# BUG-84: Superadmin Config Tab Sends Upload Limit as String — Zod Validation Fails

**Status:** Open
**Reported:** 2026-03-19
**Severity:** High
**Skill Tag:** [Frontend]
**Feature:** PROJ-17: Super-Admin

---

## Description

### Expected Behavior
Entering a value in the "Default upload limit" field in the Super Admin → Config tab and clicking "Save Changes" should save the config successfully.

### Actual Behavior
Clicking "Save Changes" returns a Zod validation error: `Invalid input: expected number, received string`. The config is not saved.

## Root Cause

In `nextjs/components/superadmin/ConfigTab.tsx:50`, the `defaultUploadLimit` value is sent as a raw string in the request body:

```ts
const body: Record<string, string | null> = {
  defaultUploadLimit: rawValue === '' ? null : rawValue,  // ← sends string, not number
};
```

The backend Zod schema expects a `number` for this field, causing the validation error.

## Steps to Reproduce

1. Log in as super-admin
2. Open the Super Admin modal (shield icon in sidebar)
3. Navigate to the **Config** tab
4. Enter any numeric value in the "Default upload limit (bills per project)" field
5. Click **Save Changes**
6. Observe the error: `Invalid input: expected number, received string`

## Environment

- **Browser/Client:** N/A
- **OS:** N/A
- **Screen Size:** N/A
- **Date/Time:** 2026-03-19

## Additional Context

The fix is in `nextjs/components/superadmin/ConfigTab.tsx` — the `handleSave` function already parses the value with `parseInt(rawValue, 10)` for client-side validation (line 40) but then discards the parsed number and sends the raw string `rawValue` to the API (line 50). The body should send the parsed integer instead.

---

## Resolution

**Status:** Open
**Resolved Date:** —
**Fixed In:** — *(commit hash or PR)*
**Fix Description:** —
