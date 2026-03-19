# BUG-84: Superadmin Config Tab Sends Upload Limit as String — Zod Validation Fails

**Status:** Resolved
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

**Status:** Resolved
**Resolved Date:** 2026-03-19
**Fixed In:** next commit
**Fix Description:** Changed `ConfigTab.tsx` to send `parseInt(rawValue, 10)` instead of the raw string in the PATCH request body. Also fixed the `SystemConfig` interface to use `number | null` instead of `string` to match the API response type.

---

## QA Test Results

**Tested:** 2026-03-19
**Method:** Code review
**Tester:** QA Engineer (AI)

### Summary
| Category | Passed | Failed | Notes |
|----------|--------|--------|-------|
| Fix Verification | 1 | 0 | Core bug fix confirmed correct |
| Type Alignment | 2 | 0 | Interface and null handling correct |
| Validation | 1 | 1 | Client/backend mismatch on value 0 |
| Edge Cases | 2 | 1 | Decimal truncation is silent |
| **Total** | **6** | **2** | |

### Detailed Test Results

#### T1: Fix Verification -- Number Sent Instead of String [PASS]
- **What:** Verify handleSave sends parseInt(rawValue, 10) instead of raw string
- **Expected:** Body type is Record<string, number | null> and value is parsed integer
- **Actual:** Line 49-50 sends `parseInt(rawValue, 10)` with correct type annotation
- **Status:** PASS

#### T2: Null Handling -- Empty Field [PASS]
- **What:** Verify empty input sends null, not NaN or 0
- **Expected:** rawValue === '' results in null being sent
- **Actual:** Ternary on line 50 correctly sends null for empty string; backend z.number().nullable() accepts null
- **Status:** PASS

#### T3: SystemConfig Interface Alignment [PASS]
- **What:** Verify frontend SystemConfig interface matches backend GET response types
- **Expected:** Both use number | null for defaultUploadLimit
- **Actual:** Frontend interface declares `defaultUploadLimit?: number | null`; backend GET returns `{ defaultUploadLimit: number | null }` after parseInt + Number.isFinite check
- **Status:** PASS

#### T4: State Initialization from API Response [PASS]
- **What:** Verify setDefaultUploadLimit handles number, null, and undefined from API
- **Expected:** number -> string, null -> '', undefined -> ''
- **Actual:** Line 24 uses `data.defaultUploadLimit != null` which correctly handles both null and undefined, converting number to String() and null/undefined to ''
- **Status:** PASS

#### T5: Client-Side Validation vs Backend Validation Consistency [FAIL]
- **What:** Verify client validation aligns with backend Zod schema
- **Expected:** Both reject the same invalid values
- **Actual:** Client validates `parsed < 0` (allows 0), backend validates `min(1)` (rejects 0). HTML input has `min="0"` but backend requires min 1. Entering 0 passes client validation but fails on backend with a Zod error.
- **Status:** FAIL

#### T6: Edge Case -- Decimal Input [FAIL]
- **What:** Verify decimal input is handled properly
- **Expected:** User is informed if their input is truncated, or decimals are prevented
- **Actual:** `parseInt("3.5", 10)` silently truncates to 3. No `step="1"` attribute on the input to discourage decimals. User sees no feedback that their value was changed.
- **Status:** FAIL (Low severity)

#### T7: Edge Case -- Negative Number [PASS]
- **What:** Verify negative numbers are rejected
- **Expected:** Both client and backend reject negative values
- **Actual:** Client rejects via `parsed < 0` check with toast message; backend rejects via `min(1)`. Both paths handle correctly.
- **Status:** PASS

#### T8: Edge Case -- Very Large Number [PASS]
- **What:** Verify no overflow issues with very large numbers
- **Expected:** Large numbers handled or constrained
- **Actual:** No max constraint in Zod schema. JavaScript precision loss occurs beyond Number.MAX_SAFE_INTEGER but this is acceptable for an upload limit setting. No practical risk.
- **Status:** PASS (with note)

### Bugs Found
| ID | Severity | Title | Skill |
|----|----------|-------|-------|
| QA-1 | Medium | Client allows 0 but backend rejects it (min(1) vs < 0 mismatch) | [Frontend] |
| QA-2 | Low | Decimal input silently truncated without user feedback | [Frontend] |

#### QA-1: Client validation allows 0 but backend rejects it [Frontend]
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Open Super Admin modal, Config tab
  2. Enter `0` in the upload limit field
  3. Click Save Changes
  4. Expected: Client-side validation rejects with a toast (since backend requires min 1)
  5. Actual: Client validation passes (only checks `parsed < 0`), request is sent, backend returns 400 error
- **Fix suggestion:** Change `parsed < 0` to `parsed < 1` on line 41 of ConfigTab.tsx, and change HTML input `min="0"` to `min="1"` on line 96
- **Priority:** Fix in next sprint

#### QA-2: Decimal input is silently truncated [Frontend]
- **Severity:** Low
- **Steps to Reproduce:**
  1. Open Super Admin modal, Config tab
  2. Enter `3.5` in the upload limit field
  3. Click Save Changes
  4. Expected: Either reject decimals or inform user that value was rounded
  5. Actual: `parseInt("3.5", 10)` silently truncates to 3, saved without notification
- **Fix suggestion:** Add `step="1"` attribute to the input element to discourage decimal entry
- **Priority:** Nice to have

### Production Ready: YES
- The core bug (BUG-84) is correctly fixed -- the upload limit is now sent as a number
- The 2 issues found are pre-existing minor validation gaps, not regressions from the fix
- Recommendation: Deploy the fix; address QA-1 and QA-2 in a follow-up
