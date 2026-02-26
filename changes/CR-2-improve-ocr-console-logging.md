# CR-2: Improve Console Logging Clarity for OCR Field Writes

**Status:** Open
**Requested:** 2026-02-26
**Priority:** Low
**Type:** Enhancement

## Related Feature
**Feature:** [PROJ-1: OCR / AI Bill Analysis]
**Feature Spec:** [features/PROJ-1-ocr-bill-analysis.md](../features/PROJ-1-ocr-bill-analysis.md)

## Change Description

### Current Behavior / Limitation
The current console output from `runOcrJob` logs field writes in a way that looks identical to user edits. For example, when OCR writes the `vendor` and `date` fields to a bill, the console output reads something like:

```
Bill 42 edited: vendor, date
```

This is misleading because:
1. It implies a user edited those fields, when it was actually the background OCR job
2. It makes it hard to distinguish OCR writes from real user edits in server logs
3. There is no log of the provider used, the HTTP status, or how many fields were extracted vs. skipped
4. Failures are logged generically without enough detail to diagnose the root cause

### Desired Behavior / New Capability
Console output from `runOcrJob` should be clearly prefixed and structured to distinguish it from user-triggered actions. Proposed improvements:

**On job start:**
```
[OCR] Bill 42 (project 3): analysis started — provider: openai
```

**On successful field write:**
```
[OCR] Bill 42: wrote 3 fields [vendor, date, amount] — 2 skipped (already filled) [brutto19, type]
```

**On success completion:**
```
[OCR] Bill 42: done in 4321ms — ocr_status=done, ocr_fields=["vendor","date","amount"]
```

**On failure:**
```
[OCR] Bill 42: FAILED — HTTP 401 from openai: {"error":{"message":"Invalid API key",...}}
[OCR] Bill 42: FAILED — fetch error: ETIMEDOUT after 15000ms
[OCR] Bill 42: FAILED — JSON parse error: unexpected token at position 4 in: "Sure! Here is the..."
```

All `[OCR]` prefixed log lines should make it immediately obvious this is automated analysis, not a user action.

### Rationale
During development and production debugging, the current logs are confusing and undersell the information available at the time of logging. With structured, prefixed logs, developers and admins monitoring server output can immediately tell what the OCR job did, how long it took, and exactly why it failed — without needing to add the admin logging panel (CR-1) for basic server-side diagnosis.

## Proposed Acceptance Criteria
- [ ] All `console.log` / `console.error` calls in `runOcrJob` and `analyseImage` are prefixed with `[OCR]`
- [ ] Job start is logged with bill ID, project ID, and provider name
- [ ] Field writes are logged showing which fields were written and which were skipped (and why: "already filled", "null from AI")
- [ ] Success is logged with elapsed time (ms) and final `ocr_fields` value
- [ ] Failures are logged with the error type, HTTP status (if applicable), and a truncated (500 char) raw response body
- [ ] No logging of API keys or secrets at any log level

## Resolution
**Decision:** Pending
**Decided:** —
**Notes:** —
**Outcome:** Path A (feature spec updated)

## Additional Context
- This is a low-effort, high-value change that helps diagnose issues before CR-1 (the full admin logging panel) is built
- Can be implemented as part of the same fix pass as BUG-1 (timeout) since both touch `runOcrJob`
