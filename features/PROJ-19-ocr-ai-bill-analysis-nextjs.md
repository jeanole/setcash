# PROJ-19: OCR / AI Bill Analysis (Next.js)

## Status: Change Requested
**Created:** 2026-03-07
**Last Updated:** 2026-03-07

## Dependencies
- Requires: PROJ-5 (NextAuth.js auth — protected routes)
- Requires: PROJ-6 (PostgreSQL / Prisma — `Bill.ocrStatus`, `Bill.ocrFields`, `OcrLog` model)
- Requires: PROJ-7 (Bills feature — bill detail page, bill list)
- Requires: PROJ-10 (Settings — OCR settings stored in `ProjectSettings`)
- Mirrors: PROJ-1 (Express OCR/AI Bill Analysis — feature parity target)

---

## Overview

After a bill is saved via the web upload form, an AI vision model analyses the receipt image **in the background** and writes extracted field values back to the bill record. Extracted fields are persisted in the database and marked "to be checked" — visually flagged in the bill detail view so users know to verify them. Failure is reported via the notifications system.

Analysis is powered by a configurable vision-capable LLM (OpenAI GPT-4o, Google Gemini 1.5 Flash, Anthropic Claude 3.5 Haiku, or any OpenAI-compatible endpoint). Each project stores its own provider + API key, encrypted at rest with AES-256-GCM. Project admins configure this in the Settings panel.

This is a full Next.js port of PROJ-1, implemented primarily in `nextjs/lib/ocr.ts`.

---

## User Stories

- As a **user**, I want to click "Analyse Bill" on a bill's detail page so that the analysis runs in the background — I don't have to wait for it to finish.
- As a **user**, I want extracted field values to be clearly marked "to be checked" so I know which values were filled by AI and need my review.
- As a **user**, I want to verify individual OCR-filled fields one at a time, clearing the amber highlight once accepted.
- As a **user**, I want to receive a notification when analysis fails (with a reason) so I know to fill the fields manually.
- As a **project admin**, I want to choose an AI provider and enter the project's API key in Settings, isolated from other projects.
- As a **project admin**, I want to re-analyse a bill to update previously extracted fields.

---

## Acceptance Criteria

### Settings (Admin)
- [ ] Project Settings has an "AI Analysis" section with:
  - Toggle: Enable / Disable AI Analysis for this project (`ocrEnabled`)
  - Dropdown: `OpenAI (GPT-4o)` / `Google Gemini` / `Anthropic Claude` / `Custom (OpenAI-compatible)` (`ocrProvider`)
  - Text field for the API key — masked display after save (shows last 4 chars, e.g. `...abc`) (`ocrApiKey`)
  - Base URL field, visible only when "Custom" is selected (`ocrBaseUrl`)
  - Save button
- [ ] API key stored encrypted (AES-256-GCM, key derived from `OCR_ENCRYPTION_SECRET` or `SESSION_SECRET`) in `ProjectSettings`
- [ ] API key never returned to client in plain text — only masked value exposed via GET settings

### Trigger: Web Upload
- [ ] "Analyse Bill" / "Re-analyse" button shown on bill detail page (`BillDetailHeader`) when OCR is enabled for the project and the bill has at least one image
- [ ] Clicking the button triggers `POST /api/bills/[id]/analyse` — returns 202 immediately ("Analysis started")
- [ ] Button disabled / shows spinner while `ocrStatus === 'pending'`
- [ ] Bill detail page polls `GET /api/bills/[id]/ocr-status` every 3 seconds while pending, then refreshes bill data on completion
- [ ] Rate limited: 5 analyse requests per minute per user (429 on excess)

### Background Analysis Job (`runOcrJob`)
- [ ] Fire-and-forget from the analyse endpoint
- [ ] Immediately sets `ocrStatus = 'pending'` on the bill
- [ ] Reads `ocrEnabled`, `ocrProvider`, `ocrApiKey` from `ProjectSettings`; if not configured → sets `'failed'`, creates failure notification, exits
- [ ] Reads the bill's first image (sorted by `sortOrder` then `id`); if no image or file missing → `'failed'` + notification
- [ ] Converts image to base64; determines MIME type from extension (jpg/png/gif/webp)
- [ ] Calls AI provider with structured prompt requesting JSON: `date`, `vendor`, `item`, `type`, `brutto19`, `brutto7`, `brutto0`, `amount`
- [ ] Writes only non-null extracted values, and only for fields that are currently empty/zero on the bill (no overwriting user data)
- [ ] On re-analysis: overwrites previously OCR-filled fields (detects `isReanalysis` when prior `ocrStatus === 'done'`)
- [ ] Recalculates `grossAmount` and `nettoAmount` if any brutto field is written
- [ ] Sets `ocrStatus = 'done'` and `ocrFields` = JSON array of field names that were written
- [ ] On any error: sets `ocrStatus = 'failed'`; creates notification: `"Bill analysis failed: <reason>"` for the bill's owner
- [ ] Writes to `OcrLog`: status, provider, fields written, raw AI response (truncated to 2000 chars), error detail
- [ ] Writes to `EditLog` with `source: 'ai'` and `user: 'AI / <provider>'`
- [ ] 60s timeout on all provider HTTP requests (AbortController)

### Supported Providers
- [ ] **OpenAI GPT-4o** — `POST https://api.openai.com/v1/chat/completions` with `image_url` content block
- [ ] **Google Gemini 1.5 Flash** — `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent` with `inline_data`
- [ ] **Anthropic Claude 3.5 Haiku** — `POST https://api.anthropic.com/v1/messages` with `image` content block
- [ ] **Custom (OpenAI-compatible)** — user-supplied `baseUrl` + `POST <baseUrl>/chat/completions` — requires `https://` prefix; private/reserved IP addresses blocked (SSRF protection)

### "To Be Checked" Display
- [ ] Bill detail header: `ocrStatus === 'pending'` → "Analysing…" spinner on button; `'done'` with non-empty `ocrFields` → amber "AI ✓ check" badge; `'failed'` → red badge
- [ ] Each field named in `ocrFields` shown with amber highlight ("AI — please verify") in the bill detail form
- [ ] Per-field "✓ Accept" button calls `PATCH /api/bills/[id]/verify-field` to clear that field from `ocrFields`
- [ ] When last field is verified, `ocrStatus` and `ocrFields` are cleared; amber styling disappears

### Field Verification Endpoint
- [ ] `PATCH /api/bills/[id]/verify-field` — accepts `{ field: string }`, validates against allowed field enum
- [ ] Returns updated `{ ocrFields, ocrStatus }` after removing verified field
- [ ] `amount` is auto-cleared if it's the only remaining field (it's computed, not directly editable)
- [ ] Writes `EditLog` entry with `source: 'user'` and `{ _event: 'verified', field }`
- [ ] Project membership check — 401/400 on missing auth/project

### Failure Notifications
- [ ] Failure notification created in `Notification` table for the bill's owner: `"Bill analysis failed: <reason>"`
- [ ] Notification linked to `projectId` for navigation context
- [ ] Failure also logged in `OcrLog` and `EditLog`

### Error Handling
- [ ] 401: missing session
- [ ] 400: no project selected
- [ ] 403: not admin (analyse endpoint — admin/superadmin only)
- [ ] 404: bill not in current project
- [ ] 409: analysis already in progress (`ocrStatus === 'pending'`)
- [ ] 429: rate limit exceeded (5/min/user)
- [ ] 500: unexpected server error

---

## Edge Cases

- **No image on bill**: `runOcrJob` exits immediately with failure notification.
- **Image file missing from disk**: Same as no image.
- **Multi-image bill**: Analysis runs on first image only (sorted by `sortOrder`, then `id`).
- **Unreadable / blurry image**: Provider returns null fields; nothing written; `ocrStatus = 'done'`, `ocrFields = null`.
- **Provider 429 rate limit**: `ocrStatus = 'failed'`; notification: "Rate limit exceeded".
- **API key invalid / 401**: notification: "Invalid API key".
- **Custom provider points to private IP**: Blocked by SSRF check before any HTTP call.
- **Custom provider non-HTTPS URL**: Rejected with config error before HTTP call.
- **Re-analysis while pending**: 409 returned; duplicate jobs prevented.
- **Server restart mid-job**: Bill stays `ocrStatus = 'pending'`; user can click Analyse again.
- **Amount is the only remaining ocrField**: Auto-cleared by verify-field endpoint (computed field, not user-verifiable).
- **OCR disabled for project**: Analyse button not shown; job fails immediately if triggered directly.
- **60s provider timeout**: AbortController fires; `ocrStatus = 'failed'`; notification: "Request timed out after 60s".

---

## API Endpoints

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/bills/[id]/analyse` | POST | Admin only | Trigger OCR background job |
| `/api/bills/[id]/ocr-status` | GET | Project access | Poll `ocrStatus` + `ocrFields` |
| `/api/bills/[id]/verify-field` | PATCH | Project access | Accept/clear one OCR field |

---

## Key Files

| File | Purpose |
|---|---|
| `nextjs/lib/ocr.ts` | Core: `runOcrJob`, `analyseImage`, `encryptApiKey`, `decryptApiKey`, `maskApiKey`, SSRF check |
| `nextjs/app/api/bills/[id]/analyse/route.ts` | POST trigger endpoint, rate limiting |
| `nextjs/app/api/bills/[id]/ocr-status/route.ts` | GET polling endpoint |
| `nextjs/app/api/bills/[id]/verify-field/route.ts` | PATCH field verification |
| `nextjs/components/bills/BillDetailHeader.tsx` | Analyse button, OCR status badges |
| `nextjs/app/(protected)/bills/[id]/page.tsx` | Bill detail page — polling logic, `ocrFields` highlighting |
| `nextjs/lib/utils.ts` | `ocrStatusDisplay` helper (label + color per status) |
| `nextjs/lib/types.ts` | `OcrStatus` type, `Bill` interface with `ocrStatus`/`ocrFields` |

---

## Database Schema (Prisma)

```prisma
model Bill {
  // ...existing fields...
  ocrStatus  OcrStatus? // pending | done | failed | null
  ocrFields  Json?      // string[] of field names written by OCR, not yet verified
}

enum OcrStatus {
  pending
  done
  failed
}

model OcrLog {
  id           String   @id @default(uuid())
  projectId    String
  billId       String
  provider     String?
  status       String   // done | failed
  fieldsWritten String? // JSON array
  aiResponse   String?  // truncated to 2000 chars
  errorDetail  String?
  createdAt    DateTime @default(now())
}
```

---

## Security Notes

- API key encrypted at rest (AES-256-GCM), key derived from `OCR_ENCRYPTION_SECRET` or `SESSION_SECRET`
- API key never returned to client in plain text (masked: `...last4`)
- In production: startup fails if secret is missing, too short, or default value
- Custom provider SSRF protection: rejects `localhost`, `127.x`, `10.x`, `192.168.x`, `172.16–31.x`, `169.254.x`, `.local`, `0.0.0.0`
- Custom provider requires `https://` prefix
- Rate limiting on analyse endpoint: 5 req/min/user
- Admin-only access to trigger analysis

---

## Express Parity Notes (vs PROJ-1)

| Feature | Express (PROJ-1) | Next.js (PROJ-19) |
|---|---|---|
| Providers | OpenAI, Gemini, Claude, Custom | Same ✅ |
| Background job | Fire-and-forget | Same ✅ |
| Fields written | date, vendor, item, type, brutto19/7/0, amount | Same ✅ |
| No-overwrite rule | Empty/zero fields only | Same ✅ |
| Re-analysis | Overwrites OCR fields | Same ✅ (detects via `isReanalysis`) |
| OcrLog | ✅ | ✅ |
| EditLog | ✅ | ✅ |
| Field verification | PATCH verify-field | Same ✅ |
| Telegram auto-trigger | ✅ | Not in scope (PROJ-12) |
| Status polling | Manual refresh | Automatic polling every 3s ✅ (improved) |
| SSRF protection | ❌ | ✅ (added) |
| API key encryption | ✅ AES-256-GCM | Same ✅ |
| Rate limiting | ✅ | ✅ |

---

## Open Bug Reports

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| [BUG-40](BUG-40-ocr-date-prisma-datetime-error.md) | High | OCR Job Crashes with Prisma DateTime Error When Date Extracted | Open |

---

## QA Test Results

**Round:** 1
**Date:** 2026-03-09
**Method:** Code review (no running server)

### Summary
- Acceptance Criteria: 31/37 passed
- Edge Cases: 9/11 passed
- Security: 8/10 passed
- Bugs found: 8 (1 Critical, 3 High, 3 Medium, 1 Low)

### Bugs Found

#### BUG-40: Encrypted API key ciphertext leaked to browser via SSR page
- **Severity:** Critical
- **Skill:** [Backend]
- **File:** `nextjs/app/(protected)/settings/ai-analysis/page.tsx:59`
- **Description:** The server-side rendered AI Analysis settings page reads the raw encrypted API key ciphertext from the database (`get('ocrApiKey')`) and passes it directly to the client-side `OcrSettingsForm` component as `initialSettings.ocrApiKey`. The page never calls `maskApiKey()` before sending data to the browser. The encrypted ciphertext (format: `iv_hex:authTag_hex:ciphertext_hex`) is thus visible in the HTML page source and React hydration props.
- **Expected:** The page should call `maskApiKey(get('ocrApiKey'))` to only pass the masked value (e.g. `...abc4`) to the client component, matching the behavior of the `GET /api/project-settings` API endpoint.
- **Actual:** Raw encrypted ciphertext is sent to the browser. While not the plaintext key, it leaks the encrypted material, enabling offline brute-force attempts against the AES-256-GCM encryption.

#### BUG-41: Masked key hint shows last 4 chars of ciphertext hex, not actual key
- **Severity:** Medium
- **Skill:** [Frontend]
- **File:** `nextjs/components/settings/OcrSettingsForm.tsx:73-75`
- **Description:** The `maskedKeyHint` is computed as `initialSettings.ocrApiKey.slice(-4)`. Because of BUG-40, `initialSettings.ocrApiKey` contains the encrypted ciphertext hex, not the plaintext key. So the hint shows 4 hex characters from the ciphertext rather than the last 4 characters of the actual API key. Even if BUG-40 is fixed, this code would display `...abc4` correctly since `maskApiKey()` returns a string like `...abc4` -- but then `slice(-4)` would extract `abc4` and prepend `...` again, yielding `...abc4` which is correct. So this bug is a direct consequence of BUG-40 and would self-resolve once BUG-40 is fixed.
- **Expected:** The placeholder should show the last 4 characters of the actual API key.
- **Actual:** Shows last 4 hex characters of the encrypted ciphertext.

#### BUG-42: verify-field endpoint does not clear ocrFields/ocrStatus when last field verified
- **Severity:** High
- **Skill:** [Backend]
- **File:** `nextjs/app/api/bills/[id]/verify-field/route.ts:77-80`
- **Description:** When `remaining.length === 0`, the code sets `ocrFields: undefined` and `ocrStatus: undefined` in the Prisma update. In Prisma, `undefined` means "skip this field / do not update it". The fields are never actually cleared in the database. The response JSON on line 106 correctly returns `ocrFields: null, ocrStatus: null`, but the database retains the old values.
- **Expected:** Use `ocrFields: null` (Prisma `JsonNull` / `Prisma.DbNull`) and `ocrStatus: null` to actually set the database columns to NULL.
- **Actual:** `undefined` causes Prisma to skip the update entirely, leaving stale `ocrStatus = 'done'` and the old `ocrFields` array in the database.

#### BUG-43: OcrLog write is not awaited -- errors silently lost
- **Severity:** Medium
- **Skill:** [Backend]
- **File:** `nextjs/lib/ocr.ts:330`
- **Description:** The `writeLog` function calls `prisma.ocrLog.create({...})` without `await`. The returned promise is never awaited, so: (1) any database error becomes an unhandled promise rejection instead of being caught by the try-catch on line 341, and (2) the log write may not complete before the function returns.
- **Expected:** `await prisma.ocrLog.create({...})` inside the try block.
- **Actual:** Fire-and-forget promise with no error handling.

#### BUG-44: ocrFields not cleared on re-analysis when all extracted fields are null
- **Severity:** Medium
- **Skill:** [Backend]
- **File:** `nextjs/lib/ocr.ts:560-561`
- **Description:** When `finalFields` is `null` (all extracted fields were null), the update sets `ocrFields: undefined` which in Prisma means "don't update". On a re-analysis where the prior run wrote fields, the old `ocrFields` array persists, leading to stale amber highlights on the bill detail.
- **Expected:** `ocrFields: finalFields ?? Prisma.JsonNull` (or `null` depending on Prisma version) to explicitly clear the field when no fields were written.
- **Actual:** Previous `ocrFields` value remains in the database.

#### BUG-45: fail() not awaited in catch block of runOcrJob
- **Severity:** High
- **Skill:** [Backend]
- **File:** `nextjs/lib/ocr.ts:602`
- **Description:** In the outer catch block at line 602, `fail(...)` is called without `await`. The `fail` function is `async` (it writes to the database). Without `await`, the function returns before the bill status is updated to `'failed'` and before the notification is created. This means errors during the OCR job may leave the bill stuck in `'pending'` status.
- **Expected:** `await fail(...)` in the catch block.
- **Actual:** `fail()` result is discarded; bill may remain in `pending` status after error.

#### BUG-46: Rate limiter is a no-op without Redis in development/production
- **Severity:** High
- **Skill:** [Backend]
- **File:** `nextjs/lib/ratelimit.ts:23-33`
- **Description:** When `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are not set, the rate limiter falls back to `MockRatelimit` which always returns `success: true`. The mock-mode warning only logs in `NODE_ENV === 'development'`, so in a production deployment without Upstash configured, rate limiting is silently disabled with no warning.
- **Expected:** In production, either require Redis configuration or use an in-memory rate limiter. At minimum, log a warning in production.
- **Actual:** Rate limiting is completely disabled in production when Upstash is not configured, with no warning.

#### BUG-47: Analyse button visible to non-admin users when hasOcrEnabled is fetched
- **Severity:** Low
- **Skill:** [Frontend]
- **File:** `nextjs/app/(protected)/bills/[id]/page.tsx:126,279`
- **Description:** The `canAnalyse` button is gated by `hasOcrEnabled` (line 126 of BillDetailHeader). While the settings fetch is correctly guarded by `if (!isAdmin) return` on line 201, the `hasOcrEnabled` state defaults to `false` and only updates for admins. This is technically correct behavior -- the button won't show for non-admins. However, the `BillDetailHeader` component does not itself check `isAdmin` before rendering the analyse button (line 126), relying entirely on the parent's `hasOcrEnabled` prop. If a future code change sets `hasOcrEnabled` for non-admins, the button would appear. This is a defense-in-depth concern rather than a current bug.
- **Expected:** `BillDetailHeader` should additionally check `isAdmin` in the `canAnalyse` condition for defense in depth.
- **Actual:** Only relies on `hasOcrEnabled` prop from parent.

### Detailed Results

**Settings (Admin)**
- AC-1: PASS -- `OcrSettingsForm.tsx` has toggle, provider dropdown (4 providers), API key field (type=password), base URL (conditional on `custom`), and save button.
- AC-2: PASS -- `encryptApiKey()` in `lib/ocr.ts` uses AES-256-GCM with key derived from `OCR_ENCRYPTION_SECRET || SESSION_SECRET` via SHA-256. The PUT endpoint on line 185 calls `encryptApiKey()` before storing.
- AC-3: FAIL -- See BUG-40. The GET API endpoint (`/api/project-settings`) correctly masks the key, but the SSR page (`ai-analysis/page.tsx`) sends the raw encrypted ciphertext to the client.

**Trigger: Web Upload**
- AC-4: PASS -- `BillDetailHeader.tsx` line 35: `canAnalyse = hasOcrEnabled && hasImages && bill.ocrStatus !== 'pending'`. Button rendered conditionally at line 126.
- AC-5: PASS -- `analyse/route.ts` returns 202 with `{ ok: true, message: 'Analysis started' }`.
- AC-6: PASS -- Bill detail page passes `isAnalysing={isAnalysing || bill.ocrStatus === 'pending'}` (line 280). Header disables button and shows spinner when `isAnalysing` is true (lines 129, 138-155).
- AC-7: PASS -- Bill detail page lines 88-96: `setInterval(() => refetch(), 3000)` when `bill.ocrStatus === 'pending'`, cleared on cleanup.
- AC-8: PASS (with caveat) -- `billAnalyseLimiter` is imported and used in `analyse/route.ts` lines 23-26. Returns 429 on excess. However see BUG-46: limiter is a mock/no-op without Redis.

**Background Analysis Job**
- AC-9: PASS -- `analyse/route.ts` line 60: `runOcrJob(id, projectId).catch(...)` -- fire-and-forget.
- AC-10: PASS -- `ocr.ts` line 354: `await prisma.bill.update({ ..., data: { ocrStatus: 'pending' } })`.
- AC-11: PASS -- `ocr.ts` lines 401-425: reads settings, fails gracefully if ocrEnabled is false or ocrApiKey missing.
- AC-12: PASS -- `ocr.ts` lines 447-458: `findFirst` with `orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }]`, fails with notification if none.
- AC-13: PASS -- `ocr.ts` lines 461-470: converts to base64, maps extension to MIME type (png, gif, webp, fallback jpeg).
- AC-14: PASS -- `ocr.ts` lines 96-108: structured OCR_PROMPT requesting JSON with all specified fields.
- AC-15: PASS -- `ocr.ts` lines 488-513: `fieldChecks` only returns true when extracted value is non-null AND (isReanalysis OR current value is empty/zero).
- AC-16: PASS -- `ocr.ts` line 351: `isReanalysis = priorBill?.ocrStatus === 'done'`. Field checks use `isReanalysis` flag.
- AC-17: PASS -- `ocr.ts` lines 529-546: recalculates grossAmount and nettoAmount when brutto fields written.
- AC-18: PASS (with caveat) -- `ocr.ts` lines 555-562: sets `ocrStatus: 'done'`, `ocrFields: JSON.stringify(finalFields)`. See BUG-44 for the null case.
- AC-19: PASS -- `ocr.ts` lines 359-397: `fail()` sets ocrStatus='failed', creates notification for bill owner.
- AC-20: PASS (with caveat) -- `ocr.ts` lines 329-344: `writeLog` creates OcrLog with all required fields, `aiResponse` truncated to 2000 chars. See BUG-43 for missing await.
- AC-21: PASS -- `ocr.ts` lines 579-588: EditLog with `source: 'ai'`, `user: 'AI / ${provider}'`.
- AC-22: PASS -- All three provider blocks use `AbortController` with `setTimeout(() => controller.abort(), OCR_FETCH_TIMEOUT_MS)` where timeout is 60000ms.

**Supported Providers**
- AC-23: PASS -- `ocr.ts` lines 138-190: OpenAI POST to `api.openai.com/v1/chat/completions` with `image_url` content block, model `gpt-4o`.
- AC-24: PASS -- `ocr.ts` lines 192-236: Gemini POST to `generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent` with `inline_data`.
- AC-25: PASS -- `ocr.ts` lines 238-290: Anthropic POST to `api.anthropic.com/v1/messages` with `image` content block, model `claude-3-5-haiku-20241022`.
- AC-26: PASS -- `ocr.ts` lines 138-142: custom uses `baseUrl + '/chat/completions'`. Lines 434-444: validates https:// and checks `isPrivateUrl()`.

**"To Be Checked" Display**
- AC-27: PASS -- `BillDetailHeader.tsx` lines 138-155: spinner shown when `isAnalysing` is true (which includes pending state per line 280).
- AC-28: PASS -- `BillDetailHeader.tsx` lines 73-83: amber "AI check" badge when `ocrStatus === 'done'` and `ocrFields?.length > 0`.
- AC-29: PASS -- `BillDetailHeader.tsx` lines 84-94: red "Analysis failed" badge when `ocrStatus === 'failed'`.
- AC-30: PASS -- Bill detail page lines 249, 377-434, 469-472: `ocrFieldSet` drives amber ring-2/ring-amber-300 styling on form inputs for date, type, vendor, item, comment, brutto19, brutto7, brutto0.
- AC-31: PASS -- `OcrFieldVerification.tsx` lines 149-150: per-field "Verified" button calls `onVerify(fieldName)` which maps to `handleVerifyField` calling the PATCH endpoint.

**Field Verification Endpoint**
- AC-32: PASS -- `verify-field/route.ts` line 13: Zod schema `z.enum(['date', 'vendor', 'item', 'type', 'brutto19', 'brutto7', 'brutto0', 'amount', 'comment'])`.
- AC-33: PASS -- Response at line 103-107 returns `{ ok, ocrFields, ocrStatus }`.
- AC-34: PASS -- `verify-field/route.ts` lines 70-72: auto-clears `amount` when it's the only remaining field.
- AC-35: PASS -- `verify-field/route.ts` lines 92-101: EditLog with `source: 'user'`, `changes: { _event: 'verified', field }`.
- AC-36: PASS -- Lines 22-29: 401 on missing session, 400 on missing project.

**Error Handling**
- AC-37: FAIL (partial) -- 401, 400, 403, 404, 409, 429 all correctly handled in `analyse/route.ts`. 500 handled in catch blocks. However, verify-field and ocr-status endpoints do not check for 403 (admin-only) which matches the spec (they are project-access, not admin-only). All error codes verified. The verify-field endpoint has the `undefined` database bug (BUG-42) which means 200 responses may be misleading.

**Edge Cases**
- EC-1: PASS -- `ocr.ts` line 451-453: no image -> fail('No image attached to this bill').
- EC-2: PASS -- `ocr.ts` lines 455-458: `readFileForOCR` returns null -> fail('Image file not found on disk').
- EC-3: PASS -- `ocr.ts` lines 447-449: `findFirst` with `orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }]`.
- EC-4: FAIL -- See BUG-44. When all extracted fields are null, `finalFields` is null, and `ocrFields: undefined` does not clear the old value in Prisma.
- EC-5: PASS -- Each provider block throws `new Error('Rate limit exceeded')` on 429 status.
- EC-6: PASS -- Each provider block throws `new Error('Invalid API key')` on 401/relevant status.
- EC-7: PASS -- `ocr.ts` lines 438-443: `isPrivateUrl(baseUrl)` check before HTTP call.
- EC-8: PASS -- `ocr.ts` lines 435-437: `baseUrl.startsWith('https://')` check.
- EC-9: PASS -- `analyse/route.ts` lines 52-56: 409 when `bill.ocrStatus === 'pending'`.
- EC-10: PASS -- `verify-field/route.ts` lines 70-72: amount auto-cleared when last remaining.
- EC-11: FAIL -- Button is correctly hidden (PASS for UI). But the backend `runOcrJob` reads `settings.ocrEnabled` and fails gracefully (PASS). The `analyse/route.ts` endpoint does NOT check ocrEnabled before firing the job (it relies on the job itself to check). This is acceptable per the spec wording but could be improved -- marking as PASS since the job does fail immediately with notification.

**Security**
- SEC-1: FAIL -- See BUG-40. `encryptApiKey` and `decryptApiKey` are correct, `maskApiKey` is correct. But the SSR page bypasses masking, leaking encrypted ciphertext to the browser.
- SEC-2: PASS -- `GET /api/project-settings` at line 55 calls `maskApiKey(map.ocrApiKey)` -- only masked value returned.
- SEC-3: PASS -- `isPrivateUrl()` covers localhost, 127.x, ::1, .local, 169.254.x, 10.x, 192.168.x, 172.16-31.x, 0.0.0.0, [::]. Comprehensive coverage.
- SEC-4: PASS -- All 5 endpoints check `auth()` session. analyse checks admin. project-settings checks admin/owner. ocr-status and verify-field check project membership via bill.projectId match.
- SEC-5: PASS -- Zod validation on verify-field (field enum) and PUT project-settings (typed schema with z.object).
- SEC-6: PASS -- All bill endpoints use `prisma.bill.findFirst({ where: { id, projectId } })` to ensure cross-project isolation.
- SEC-7: FAIL -- See BUG-46. Rate limiter is a mock no-op when Upstash Redis is not configured. Production deployments without Upstash have no rate limiting.
- SEC-8: PASS -- `ocr.ts` line 435: `!baseUrl.startsWith('https://')` check before HTTP call.
- SEC-9: PASS -- `ocr.ts` lines 27-35: production startup guard checks encryption secret.
- SEC-10: PASS -- `project-settings/route.ts` line 183: `!data.ocrApiKey.startsWith('...')` guard prevents double-encryption of masked value.

---

## Change Requests

### CR-22: Add Qwen2.5-VL / Qwen3-VL / DeepSeek Providers + Structured System Prompt
**Requested:** 2026-03-14 | **Priority:** Medium | **Status:** Pending Review

**Current Behavior:**
Provider dropdown offers four options: OpenAI GPT-4o, Google Gemini 1.5 Flash, Anthropic Claude 3.5 Haiku, and Custom (OpenAI-compatible). The prompt sent to the LLM is a single user message with no system prompt, meaning the model must infer the desired output format and fields from the prompt text alone.

**Desired Behavior:**
1. Add **Qwen2.5-VL** and **Qwen3-VL** (Alibaba DashScope) as named providers with their default base URL pre-filled.
2. Add **DeepSeek** (DeepSeek-VL2 or compatible vision model) as a named provider with its default base URL pre-filled.
3. Add a **structured system prompt** sent to all providers before the user message, listing: the exact field names to extract (`date`, `vendor`, `item`, `type`, `brutto19`, `brutto7`, `brutto0`, `amount`), their types/formats (e.g. date as ISO 8601, amounts as numbers), and the required JSON output schema. Fields not found on the bill should be returned as `null`.

**Rationale:**
Qwen VL and DeepSeek vision models are strong, cost-competitive alternatives to the current providers — especially relevant for self-hosted or China-region deployments. The system prompt improvement benefits **all** providers: explicitly listing fields and the JSON schema reduces hallucinations, improves consistency, and removes ambiguity for models that don't follow implicit conventions as reliably as GPT-4o.

**Proposed Acceptance Criteria:**
- [ ] Settings dropdown adds `Qwen2.5-VL`, `Qwen3-VL`, and `DeepSeek` as named options alongside the existing four
- [ ] Selecting Qwen2.5-VL or Qwen3-VL pre-fills the base URL with the Alibaba DashScope endpoint; selecting DeepSeek pre-fills the DeepSeek API endpoint
- [ ] Pre-filled base URL is editable (user can override) and the field remains visible (same as Custom behavior)
- [ ] `analyseImage` (or equivalent) sends a **system prompt** to all providers that explicitly lists: all extractable field names, their expected types/formats, the JSON output schema, and a `null`-if-not-found instruction
- [ ] System prompt is defined as a constant (e.g. `OCR_SYSTEM_PROMPT`) separate from the user message (`OCR_PROMPT`)
- [ ] Providers that use a messages array (OpenAI-compatible, Anthropic) include the system prompt as the first message or `system` field; Gemini uses the `systemInstruction` field
- [ ] All existing provider integrations (OpenAI, Gemini, Anthropic, Custom) continue to work unchanged
- [ ] `OcrLog.provider` correctly records the new provider names

**Resolution:** Pending
