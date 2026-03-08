# QA Test Plan — PROJ-7 Round 3

## Feature
Bills Feature — `features/PROJ-7-bills-feature.md`

## Context Summary
- PROJ-7 is "Complete"; two prior QA rounds passed with production-ready verdict
- Recent fixes in this session: BUG-31 (image thumbnails) and BUG-32 (bill view error)
- BUG-31 fix: `BillImageUpload` now renders `existingImages` as thumbnails with remove buttons
- BUG-32 fix: `useBill`/`useBills` hooks catch `getEditLogs()` errors gracefully (default to [])
- Round 2 already verified: BUG-10 (isAdmin), BUG-11 (rate limiting) — do not re-test these

## Scope
Focused re-test: verify BUG-31 and BUG-32 fixes via code review, then spot-check key ACs.

## BUG-31 Verification
**File:** `nextjs/components/bills/BillImageUpload.tsx`
- existingImages section renders a thumbnail grid (not plain text)
- Each thumbnail shows img with src={image.file} and a filename overlay
- Remove button is rendered when onRemoveExisting prop is provided
- Remove button calls onRemoveExisting(index) on click

**File:** `nextjs/app/(protected)/bills/new/page.tsx`
- BillImageUpload receives onRemoveExisting callback
- Callback removes entry from pendingFiles at the given index

**File:** `nextjs/app/(protected)/bills/[id]/page.tsx`
- Detail page no longer passes existingImages to BillImageUpload
- Uses maxFiles={10 - (bill.images?.length || 0)} for slot calculation

## BUG-32 Verification
**File:** `nextjs/lib/hooks/useBills.ts`
- useBills.fetchBills() — getEditLogs() has .catch(() => [] as EditLog[])
- useBill.fetchBill() — getEditLogs() has .catch(() => [] as EditLog[])
- Promise.all still used but logs error won't cause the whole fetch to fail

## Spot-check ACs
- AC-5: Bill detail page loads (key page after BUG-32 fix)
- AC-9: Bill history log renders as timeline
- AC-3: New bill image upload — thumbnails visible after selecting and uploading files

## TypeScript Check
Run `npx tsc --noEmit` in `nextjs/` — zero errors expected

## Outcome
Append a QA Round 3 Results section to `features/PROJ-7-bills-feature.md`.
Commit: `test(PROJ-7): QA Round 3 — verify BUG-31 and BUG-32 fixes`
