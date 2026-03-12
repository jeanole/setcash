# BUG-40: OCR Job Crashes with Prisma DateTime Error When Date Extracted

**Status:** Resolved
**Severity:** High
**Feature:** PROJ-19 (OCR / AI Bill Analysis — Next.js)
**Skill:** [Backend]
**Date:** 2026-03-09
**Fixed In:** f149d8c

---

## Summary

When the OCR job successfully extracts a `date` field from a bill image, it passes the raw AI-returned string (format: `"YYYY-MM-DD"`, e.g. `"2022-02-26"`) directly to `prisma.bill.update()`. Prisma's `date` column is a `DateTime` type and requires a full ISO-8601 DateTime string or a JavaScript `Date` object — not a plain date-only string. This causes a `PrismaClientValidationError` and the OCR job fails, setting `ocrStatus = 'failed'` even though the AI successfully parsed the image.

This bug means OCR fails on every bill where a date is readable, which is the majority of receipts.

---

## Error

```
[OCR] Bill b7cb51f8-201c-4d25-814e-e18df56a860c: FAILED — PrismaClientValidationError:

Invalid `prisma.bill.update()` invocation:

{
  where: { id: "b7cb51f8-201c-4d25-814e-e18df56a860c" },
  data: {
    date: "2022-02-26",
          ~~~~~~~~~~~~
    vendor: "BARMER",
    item: "Kranken- und Pflegeversicherung"
  }
}

Invalid value for argument `date`: premature end of input. Expected ISO-8601 DateTime.
```

---

## Steps to Reproduce

1. Create or open a bill with at least one receipt image that contains a visible date
2. Trigger OCR analysis (click "Analyse" on the bill detail page)
3. Wait for the background job to run
4. Observe: `ocrStatus` is set to `'failed'`; a failure notification is created for the bill owner
5. Check server logs: `[OCR] Bill <id>: FAILED — PrismaClientValidationError: Invalid value for argument 'date'`

---

## Expected Behaviour

The `date` field extracted by the AI (`"2022-02-26"`) is converted to a proper `Date` object before being written to Prisma. The bill date is updated, `ocrStatus = 'done'`, and `ocrFields` contains `'date'`.

---

## Actual Behaviour

The raw `"YYYY-MM-DD"` string is passed directly to Prisma's `DateTime` field. Prisma rejects it with `premature end of input. Expected ISO-8601 DateTime`. The OCR job catches the error and sets `ocrStatus = 'failed'` — any other fields that would have been written (e.g. vendor, item) are also lost.

---

## Root Cause

In `nextjs/lib/ocr.ts`, the `updates` object is built with:

```ts
updates[field] = extracted[field as keyof OcrResult];
```

For the `date` field, `extracted.date` is a plain `string | null` (e.g. `"2022-02-26"`). Prisma requires a JavaScript `Date` or full ISO-8601 string (`"2022-02-26T00:00:00.000Z"`).

**Fix:** Before writing the date to the updates object, convert it:

```ts
// In the section that builds updates for 'date':
updates['date'] = new Date(extracted.date + 'T00:00:00.000Z');
```

Or more robustly, handle invalid date strings gracefully so a malformed date from the AI doesn't crash the whole job.

---

## Environment

- Server-side (Node.js / Next.js API route)
- Prisma + PostgreSQL
- Affects all AI providers (OpenAI, Gemini, Claude, Custom)

---

## Additional Notes

- The bug was discovered during live usage — the QA code review (Round 1) did not catch this because it did not test against a running server
- All other fields (vendor, item, brutto amounts, etc.) write correctly because they use `String` or `Decimal` types which accept their respective JS primitives
- The `date` field is the only `DateTime` field among the OCR-extracted fields
