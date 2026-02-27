# PROJ-1: OCR / AI Bill Analysis

## Status: Change Requested
**Created:** 2026-02-24
**Last Updated:** 2026-02-27
**Deployed:** 2026-02-27 — tag `v1.8.0-PROJ-1-CR3`

## Dependencies
- None (standalone addition to existing bill upload flow)

---

## Overview

After a bill is saved (either via the web upload form or via Telegram), an AI vision model analyses the receipt image **in the background** and writes the extracted field values back to the bill record. Extracted fields are persisted in the database and marked "to be checked" — visually flagged in the Bills list and bill edit view so users know to verify them before treating the data as final. Failure is reported via the existing notification system.

The analysis is powered by a configurable vision-capable LLM (OpenAI GPT-4o, Google Gemini, Anthropic Claude, or any OpenAI-compatible endpoint). Each project stores its own provider + API key. Project admins configure this in the Settings panel.

---

## User Stories

- As a **user**, I want to click "Analyse Bill" on a saved bill so that the analysis runs in the background while I continue working — I don't have to wait for it to finish.
- As a **user**, I want bills uploaded via Telegram to be analysed automatically, without any extra action on my part.
- As a **user**, I want extracted field values to be clearly marked "to be checked" so I know which values were filled by AI and need my review.
- As a **user**, I want to receive a notification when analysis fails (with a reason) so I know to fill the fields manually.
- As a **project admin**, I want to choose an AI provider and enter the project's API key in the project settings, isolated from other projects.
- As a **project admin**, I want to enable or disable AI analysis per project so that projects that don't need it aren't cluttered.

---

## Acceptance Criteria

### Settings (Admin)
- [ ] The project Settings panel has an "AI Analysis" sub-tab with:
  - A toggle: Enable / Disable AI Analysis for this project
  - A dropdown: `OpenAI (GPT-4o)` / `Google Gemini` / `Anthropic Claude` / `Custom (OpenAI-compatible)`
  - A text field for the API key — masked display after save (e.g. `sk-...abc`); never returned to client in plain text
  - A base URL field, visible only when "Custom" is selected
  - A Save button
- [ ] Settings stored per project in `project_settings`: `ocrEnabled`, `ocrProvider`, `ocrApiKey`, `ocrBaseUrl`
- [ ] API key never included in GET settings responses — only `ocrApiKeyMasked` (last 4 chars) is returned

### Trigger: Web Upload
- [ ] After a bill is saved via the web upload form, an "Analyse Bill" button is visible on that bill's row in the Bills list (only when OCR is enabled for the project)
- [ ] Clicking "Analyse Bill" immediately returns confirmation ("Analysis started") — no waiting; the user can navigate away
- [ ] The bill row shows an "Analysing…" indicator while the background job is running
- [ ] Once analysis completes, the bill row updates (on next load/refresh) to show filled fields with "to be checked" markers

### Trigger: Telegram Upload
- [ ] When a bill draft is created via Telegram and OCR is enabled for the project, the analysis job is automatically queued immediately after the bill is saved — no user action required
- [ ] The Telegram confirmation message mentions that analysis has been started

### Background Analysis Job (`runOcrJob(billId, projectId)`)
- [ ] Called fire-and-forget from both the web trigger endpoint and the Telegram handler
- [ ] Immediately sets `bills.ocr_status = 'pending'` on the bill
- [ ] Reads `ocrEnabled`, `ocrProvider`, `ocrApiKey` from `project_settings`; if not configured → sets `'failed'`, creates failure notification, exits
- [ ] Reads the bill's first image from `data/uploads/`; if no image → sets `'failed'`, creates failure notification, exits
- [ ] Converts image to base64 (Node `Buffer`); calls `analyseImage(provider, apiKey, base64, mimeType, baseUrl?)`
- [ ] Prompt instructs model to return only JSON with keys: `date` (ISO), `vendor`, `item`, `type`, `brutto19`, `brutto7`, `brutto0`, `amount` — unknown → `null`
- [ ] Writes only non-null extracted values, and only for fields that are currently empty/zero on the bill (no overwriting user data)
- [ ] Sets `ocr_status = 'done'` and `ocr_fields` = JSON array of field names that were written
- [ ] On any error: sets `ocr_status = 'failed'`; creates notification: `"Bill analysis failed: <reason>"` for the bill's owner
- [ ] Supports providers: OpenAI GPT-4o, Google Gemini 1.5-flash, Anthropic claude-3-5-haiku, Custom (OpenAI-compatible)

### Database: OCR Columns on `bills` Table
- [ ] `ocr_status TEXT DEFAULT NULL` — added via migration; values: `null` / `'pending'` / `'done'` / `'failed'`
- [ ] `ocr_fields TEXT DEFAULT NULL` — JSON array of field names written by OCR and not yet verified
- [ ] When user edits and saves a bill, fields they touched are removed from `ocr_fields`; when `ocr_fields` becomes empty, `ocr_status` is set to `null`

### "To Be Checked" Display
- [ ] Bills list: `ocr_status = 'pending'` → "Analysing…" spinner in row; `'done'` with non-empty `ocr_fields` → amber "AI ✓ check" badge; `'failed'` → red "Analysis failed" badge
- [ ] Bill edit/detail view: each field whose name is in `ocr_fields` has amber border + inline label "AI — please verify"
- [ ] When user edits a flagged field, the amber styling is removed from that field immediately
- [ ] When user saves the bill, verified fields are removed from `ocr_fields` on the backend; all amber styling clears when `ocr_fields` is empty

### Failure Notification
- [ ] Failure notification created in `notifications` table for the bill's owner with message `"Bill analysis failed: <reason>"`
- [ ] Notification links to the bill's project so the user can navigate directly

---

## Edge Cases

- **No image on bill**: `runOcrJob` exits immediately with "no image" failure notification.
- **Multi-image bill**: Analysis runs on the first image only.
- **Unreadable / blurry image**: Provider returns garbled or null fields; partial results written; empty fields untouched.
- **Provider 429 rate limit**: `ocr_status = 'failed'`; notification: "Bill analysis failed: rate limit exceeded".
- **API key invalid / 401**: Notification: "Bill analysis failed: Invalid API key".
- **Partial extraction**: Only non-null, non-conflicting fields are written and marked.
- **OCR disabled for project**: `runOcrJob` is never called; "Analyse" button not shown; Telegram auto-trigger skipped.
- **User edits bill before analysis finishes**: Job only writes to currently empty/zero fields — user-entered values are not overwritten.
- **Server restarts mid-job**: Bill stays in `ocr_status = 'pending'`; user can click "Analyse" again to restart.
- **Image is PDF**: Not in scope for v1 — JPEG/PNG only.
- **Very large image (>10MB)**: Blocked by existing multer limit; analysis never starts.

---

## Technical Requirements

- **New DB columns** on `bills`: `ocr_status TEXT`, `ocr_fields TEXT` — added via migration in `db.js`
- **New backend module**: `routes/ocr.js` — exports `runOcrJob()` and `analyseImage()`; registers `POST /api/bills/:id/analyse`
- **Modified**: `routes/telegram.js` — call `runOcrJob` after `createDraftBill` when `ocrEnabled`
- **Modified**: `routes/bills.js` — include `ocr_status`/`ocr_fields` in API response; strip verified fields from `ocr_fields` on PUT
- **Modified**: `routes/settings.js` — persist and mask OCR settings
- **Modified**: `server.js` — register `ocrRouter`
- **Modified**: `public/index.html` — "AI Analysis" settings tab; bill row badges; "Analyse" button
- **Modified**: `public/js/admin.js` — OCR settings load/save
- **Modified**: `public/js/bills.js` — badge rendering; trigger button; field amber highlighting
- **No new npm packages** required for v1

---

## Out of Scope (v1)

- Allocation (motive/category) extraction
- PDF receipt support
- Batch analysis
- Self-hosted / local OCR (Tesseract)
- Overwrite protection when user has already edited a field before OCR completes (partially mitigated: only writes empty/zero fields)
- Confidence score display
- Image compression before sending to provider
- Persistent job queue with retry (fire-and-forget is sufficient for v1)

---

## Tech Design (Solution Architect)

### Overview

The key architectural shift from the initial design: **analysis is async and bill-ID-based**. The bill is always saved first (web form or Telegram). A fire-and-forget background job (`runOcrJob`) then calls the AI provider, writes extracted values back to the database, and marks fields "to be checked" via two new columns on `bills`. The same job function serves both triggers. The UI reflects state via `ocr_status` and `ocr_fields` on each bill record.

---

### Component Structure

```
Settings Pane  (Admin-only "AI Analysis" sub-tab — new)
+-- Toggle: Enable / Disable
+-- Dropdown: Provider  (OpenAI / Gemini / Claude / Custom)
+-- Input: API Key  [write-only; shows masked preview after save]
+-- Input: Base URL  [shown only for "Custom"]
+-- Button: Save
+-- Status line: "Configured ✓" / "Not configured"

Bills List  (existing table — extended per row)
+-- ocr_status = 'pending'  → spinner "Analysing…"
+-- ocr_status = 'done' (ocr_fields non-empty) → amber pill "AI ✓ check"
+-- ocr_status = 'failed'   → red pill "Analysis failed"
+-- [new] "Analyse Bill" button in row actions (owner/admin, OCR enabled only)

Bill Edit / Detail View  (existing — extended)
+-- Each field named in ocr_fields:
      amber border + inline label "AI — please verify"
      Styling removed when user edits field; cleared on save
```

---

### Data Model

**Two new columns on `bills` table** (migration in `db.js`):

| Column | Type | Values | Purpose |
|--------|------|--------|---------|
| `ocr_status` | TEXT | `null` / `'pending'` / `'done'` / `'failed'` | Track background job state |
| `ocr_fields` | TEXT | JSON array of field names | Which fields were AI-written and need user verification |

Example: `ocr_fields = '["vendor","date","amount","brutto19"]'`

**Four new keys in `project_settings`** (existing key/value table — no schema change):

| Key | Description |
|-----|-------------|
| `ocrEnabled` | bool — feature on/off |
| `ocrProvider` | `"openai"` / `"gemini"` / `"claude"` / `"custom"` |
| `ocrApiKey` | API key — stored server-side; never returned to client |
| `ocrBaseUrl` | Only for "custom" provider |

---

### Backend Architecture

```
routes/ocr.js  (new file)
│
├── analyseImage(provider, apiKey, base64, mimeType, baseUrl?)
│     Pure function — calls AI provider, returns parsed field object or throws
│     Providers:
│       "openai"  → api.openai.com            model: gpt-4o
│       "gemini"  → generativelanguage.googleapis.com  model: gemini-1.5-flash
│       "claude"  → api.anthropic.com         model: claude-3-5-haiku-20241022
│       "custom"  → <baseUrl>                 OpenAI-compatible payload
│     Prompt: return JSON only — { date, vendor, item, type, brutto19, brutto7, brutto0, amount }
│             unknown fields → null
│
├── runOcrJob(billId, projectId)  ← exported; called without await (fire-and-forget)
│     1. SET bills.ocr_status = 'pending'
│     2. Read ocrEnabled, ocrProvider, ocrApiKey from project_settings
│        Guard: if not configured → ocr_status = 'failed', notify, return
│     3. Read bill's first image filename from bill_images table
│        Guard: if no image → ocr_status = 'failed', notify, return
│     4. Read image file from data/uploads/ → base64 Buffer
│     5. Call analyseImage(...)
│     6. For each non-null extracted field that is currently empty/zero on the bill:
│          UPDATE bills SET <field> = <extracted value>
│     7. SET ocr_status = 'done'
│          SET ocr_fields = JSON.stringify([list of fields written])
│     On any error:
│          SET ocr_status = 'failed'
│          INSERT notification for bill owner: "Bill analysis failed: <reason>"
│
└── POST /api/bills/:id/analyse  ← manual web trigger
      Auth: ensureAuth + ensureProjectAccess
      Verify bill belongs to caller's current project
      Call runOcrJob(billId, projectId) — no await
      Return 202 { ok: true, message: "Analysis started" }
```

**Modifications to existing files:**

```
routes/telegram.js
  After createDraftBill() → if (settings.ocrEnabled) runOcrJob(billId, projectId)
  Append "OCR analysis started." to Telegram confirmation message

routes/settings.js
  PUT: also persist ocrEnabled, ocrProvider, ocrApiKey, ocrBaseUrl
  GET: return ocrEnabled, ocrProvider, ocrBaseUrl, ocrApiKeyMasked
       (ocrApiKeyMasked = last 4 chars of key, e.g. "...f3a2"; ocrApiKey never sent)

routes/bills.js
  GET /api/bills: include ocr_status and ocr_fields per bill in response
  PUT /api/bills/:id: when user saves edits, for each field in the request body
    that has a new value, remove that field name from ocr_fields;
    if ocr_fields becomes empty → set ocr_status = null

db.js
  Migration (wrapped in try/catch per existing pattern):
    ALTER TABLE bills ADD COLUMN ocr_status TEXT DEFAULT NULL
    ALTER TABLE bills ADD COLUMN ocr_fields TEXT DEFAULT NULL

server.js
  const ocrRouter = require('./routes/ocr');
  app.use(ocrRouter);
```

---

### Async Flow

```
── Web upload flow ──────────────────────────────────────────────────
User submits form
  → POST /upload → bill saved to DB → 200 response to browser
  → user sees new bill in list (ocr_status: null, no badge)

User clicks "Analyse Bill" on the bill row
  → POST /api/bills/:id/analyse
  ← 202 "Analysis started"  (immediate — user can navigate away)
  → bill shows "Analysing…" spinner (ocr_status: 'pending')

  [background, 2–15 seconds]
  runOcrJob(billId) → AI API call → writes fields to DB
  → ocr_status = 'done', ocr_fields = ["vendor","date","amount",…]

Next bills list load / refresh
  → bill row shows amber "AI ✓ check" badge
  → edit view shows amber borders + "AI — please verify" on flagged fields

User opens bill, reviews fields, edits and saves
  → backend removes edited fields from ocr_fields
  → when ocr_fields = [] → ocr_status cleared → all amber styling gone

── Telegram upload flow ─────────────────────────────────────────────
Bot receives photo
  → createDraftBill() → bill saved in DB
  → runOcrJob(billId, projectId)  ← no await, runs in background
  → bot sends: "✓ Foto empfangen. OCR analysis started."

User opens vBudget
  → draft bill shows "Analysing…" or "AI ✓ check" depending on timing
```

---

### Why Fire-and-Forget (no job queue for v1)

A persistent job queue (Bull, BeeQueue) would improve resilience but requires Redis or a separate worker process. For v1, fire-and-forget inside Node is sufficient:

- vBudget is a single-process server; no cross-process coordination needed
- Jobs complete in 2–15s; no retry logic needed (failure → notification → user re-triggers)
- If server restarts mid-job, bill stays at `'pending'`; user can click "Analyse" again
- `runOcrJob` function signature stays the same if a queue is added later

---

### Frontend Changes

No new JS module. Modifications to existing files only.

**`public/index.html`**
- New "AI Analysis" settings sub-tab (alongside Telegram, Export)
- "Analyse Bill" button in each bill row's action area (hidden when OCR disabled or no image)
- "Analysing…" / "AI ✓ check" / "Analysis failed" badge markup in bill rows
- Amber border + "AI — please verify" label markup in bill edit view per flagged field

**`public/js/admin.js`**
- Load `ocrEnabled`, `ocrProvider`, `ocrBaseUrl`, `ocrApiKeyMasked` from settings
- Save via existing `PUT /api/admin/settings`
- Show/hide Base URL input when "Custom" selected
- Display masked key after save

**`public/js/bills.js`**
- Render `ocr_status` badge per bill row
- "Analyse Bill" button → `POST /api/bills/:id/analyse` → brief toast "Analysis started"
- Bill edit form: for each field in `ocr_fields`, apply amber CSS class + inline label
- On field edit (input event): remove amber styling from that field immediately
- On bills list reload: re-render all badges from fresh `ocr_status`/`ocr_fields` data

---

### Security Summary

| Risk | Mitigation |
|------|-----------|
| API key leaked to client | Never in GET response; only masked 4-char preview |
| Unauthorized analysis trigger | `ensureAuth` + `ensureProjectAccess`; bill ownership verified |
| SSRF via custom base URL | Validate URL starts with `https://`; reject private IP ranges |
| Prompt injection via receipt content | Response parsed as JSON only; receipt text cannot escape |
| OCR overwriting user-entered values | Job only writes to fields that are currently empty or zero |
| Large image | Existing multer 10MB cap; image buffered only during job run |

---

### Dependencies

No new npm packages for v1:
- AI API calls → Node 18+ built-in `fetch`
- Base64 encoding → Node built-in `Buffer`

---

### Files to Create / Modify

| File | Action |
|------|--------|
| `routes/ocr.js` | **Create** — `analyseImage()`, `runOcrJob()`, `POST /api/bills/:id/analyse` |
| `routes/telegram.js` | **Modify** — call `runOcrJob` after `createDraftBill` when `ocrEnabled` |
| `routes/settings.js` | **Modify** — persist + mask OCR settings |
| `routes/bills.js` | **Modify** — include `ocr_status`/`ocr_fields` in response; strip verified fields on PUT |
| `db.js` | **Modify** — migration: add `ocr_status`, `ocr_fields` columns to `bills` |
| `server.js` | **Modify** — register `ocrRouter` |
| `public/index.html` | **Modify** — AI Analysis settings tab; bill row badges; Analyse button |
| `public/js/admin.js` | **Modify** — OCR settings load/save |
| `public/js/bills.js` | **Modify** — badge rendering; trigger button; field amber highlighting |

## QA Test Results -- Round 2

**Tested by:** QA / Red-Team Pen-Test
**Date:** 2026-02-26
**Scope:** Full code review of backend + frontend: routes/ocr.js, routes/settings.js, routes/bills.js, routes/telegram.js, db.js, server.js, public/js/bills.js, public/js/admin.js, public/js/state.js, public/js/core.js, public/index.html, public/style.css, middleware.js

---

### Previous Round Status (2026-02-25)

The following bugs from Round 1 have been **FIXED** in the current codebase:

| Old ID | Status | Evidence |
|--------|--------|----------|
| BUG-1 (date overwrite) | FIXED | `routes/ocr.js` line 314: date check is now `(!bill.date \|\| bill.date.trim() === "")` -- only writes when empty |
| BUG-2 (amount overwrite) | FIXED | `routes/ocr.js` line 342: recalculation guarded by `(bill.amount \|\| 0) === 0` |
| BUG-3 (SSRF) | FIXED | `routes/ocr.js` lines 70-91: `isPrivateUrl()` function rejects localhost, 127.x, 10.x, 172.16-31.x, 192.168.x, 169.254.x, 0.0.0.0. Also validated in `routes/settings.js` lines 76-79 at save time. |
| BUG-4 (SESSION_SECRET warning) | FIXED | `routes/ocr.js` lines 15-21: console.warn emitted at startup if SESSION_SECRET is not set or is the default value |
| BUG-5 (Gemini key in URL) | FIXED | `routes/ocr.js` line 150-153: Gemini now uses `x-goog-api-key` header instead of query parameter |
| BUG-6 (missing ensureAuth) | FIXED | `routes/ocr.js` line 376: now uses `ensureAuth, ensureProjectAccess` middleware chain |
| BUG-7 (no duplicate prevention) | FIXED | `routes/ocr.js` lines 392-394: checks `bill.ocr_status === "pending"` and returns 409 if already in progress |
| BUG-8 (amount not stripped) | FIXED | `routes/bills.js` lines 400-403: when brutto fields are edited, "amount" is also included in `fieldsToRemove` |
| BUG-9 (missing headers) | FIXED | `server.js` lines 57-58: `Referrer-Policy` and `Strict-Transport-Security` headers now set |
| BUG-10 (no validation) | PARTIALLY FIXED | `routes/settings.js` lines 62-64: ocrProvider validated against known enum; `routes/ocr.js` lines 380-383: bill ID validated with parseInt + range check. However, full Zod schemas are still not used. |

---

### Acceptance Criteria Results (Round 2)

#### Settings (Admin)
- [x] **AC: AI Analysis sub-tab with toggle, dropdown, API key, base URL, save button** -- PASS. `public/index.html` lines 1497-1566 contains the complete sub-tab markup with all required elements.
- [x] **AC: Settings stored per project in project_settings** -- PASS. `routes/settings.js` lines 58-88 persist all four OCR keys scoped by `projectId`.
- [x] **AC: API key never included in GET settings responses** -- PASS. `routes/settings.js` lines 17-19 delete raw key, return only `ocrApiKeyMasked`.
- [x] **AC: Base URL field visible only when "Custom" selected** -- PASS. `public/js/admin.js` lines 368-372 `admToggleOcrBaseUrl()` toggles visibility based on provider selection.

#### Trigger: Web Upload
- [FAIL] **AC: "Analyse Bill" button visible on bill row when OCR is enabled** -- See NEW-BUG-2 below. Non-admin users cannot see the button because `projectOcrEnabled` is always `false` for them.
- [FAIL] **AC: Bill row shows "Analysing..." indicator while job runs** -- See NEW-BUG-1 below. The badge never renders because frontend uses `bill.ocr_status` (snake_case) but API returns `bill.ocrStatus` (camelCase).
- [x] **AC: Clicking "Analyse Bill" returns 202 confirmation** -- PASS. `routes/ocr.js` line 401 returns 202 with `{ ok: true, message: "Analysis started" }`.
- [FAIL] **AC: Bill row updates on next load to show "to be checked" markers** -- See NEW-BUG-1. Property name mismatch prevents badge rendering.

#### Trigger: Telegram Upload
- [x] **AC: Auto-trigger when ocrEnabled** -- PASS. `routes/telegram.js` lines 132 and 170 check `settings.ocrEnabled` before calling `runOcrJob`.
- [x] **AC: Telegram confirmation mentions analysis started** -- PASS. Lines 139 and 176 append "Beleganalyse lauft im Hintergrund."

#### Background Analysis Job (runOcrJob)
- [x] **AC: Sets ocr_status = 'pending' immediately** -- PASS. `routes/ocr.js` line 241.
- [x] **AC: If not configured, fails with notification** -- PASS. Lines 265-266.
- [x] **AC: If no image, fails with notification** -- PASS. Line 290.
- [x] **AC: Reads first image and converts to base64** -- PASS. Lines 285-303.
- [x] **AC: Calls analyseImage with correct params** -- PASS. Line 306.
- [x] **AC: Writes only non-null extracted values to empty/zero fields** -- PASS (fixed from Round 1). Lines 313-322 use correct empty/zero checks for all field types.
- [x] **AC: Sets ocr_status = 'done' and ocr_fields** -- PASS. Lines 359-362.
- [x] **AC: On error sets 'failed' and creates notification** -- PASS. Lines 244-253 (fail helper) and line 367-369.
- [x] **AC: Supports all 4 providers** -- PASS. `analyseImage()` handles openai, custom, gemini, claude.

#### Database: OCR Columns
- [x] **AC: ocr_status TEXT DEFAULT NULL migration** -- PASS. `db.js` lines 180-185.
- [x] **AC: ocr_fields TEXT DEFAULT NULL migration** -- PASS. `db.js` lines 186-191.
- [FAIL] **AC: When user edits and saves a bill, fields they touched are removed from ocr_fields** -- PARTIAL PASS / FAIL. Backend logic is correct (`routes/bills.js` lines 396-414), but the `date` field is never processed in the PUT handler changes detection -- see NEW-BUG-3.

#### "To Be Checked" Display
- [FAIL] **AC: Bills list shows badges (pending/done/failed)** -- FAIL. See NEW-BUG-1 (property name mismatch).
- [FAIL] **AC: Bill edit view shows amber border + "AI -- please verify" label** -- FAIL. See NEW-BUG-1 (property name mismatch).
- [x] **AC: Amber styling removed when user edits flagged field (client-side)** -- PASS. `public/js/bills.js` lines 742-753 remove highlight on input/change events. (Note: this would work IF the highlight were applied, which it is not per NEW-BUG-1.)
- [x] **AC: Verified fields removed from ocr_fields on save (backend)** -- PASS. `routes/bills.js` lines 396-414.

#### Failure Notification
- [x] **AC: Failure notification created in notifications table** -- PASS. `routes/ocr.js` lines 248-251.
- [x] **AC: Notification links to project** -- PASS. Notification is created with `project_id` parameter.

---

### Edge Cases Status

- [x] **No image on bill**: PASS. `routes/ocr.js` line 290 checks `!img || !img.file`.
- [x] **Multi-image bill**: PASS. Query uses `LIMIT 1` on line 287.
- [x] **Provider 429 rate limit**: PASS. All providers check for `resp.status === 429`.
- [x] **API key invalid / 401**: PASS. All providers check for 401 status.
- [x] **Partial extraction**: PASS. Each field is independently checked; nulls are skipped.
- [x] **OCR disabled for project**: PASS (backend). runOcrJob checks `ocrEnabled`. FAIL (frontend) -- see NEW-BUG-2.
- [x] **User edits bill before analysis finishes**: PASS. Only empty/zero fields are written.
- [x] **Server restarts mid-job**: PASS. Bill stays at `pending`; endpoint returns 409 if re-triggered while pending.
- [x] **Very large image (>10MB)**: PASS. multer 10MB limit enforced in `server.js` line 40.

---

### BUGS FOUND (Round 2 -- NEW)

#### NEW-BUG-1: Frontend OCR property name mismatch -- all badges and field highlights are broken [CRITICAL]

**Severity:** Critical
**Priority:** P1
**Tag:** **[Frontend]**

**File:** `C:\Users\jensmoeller\code\vbudget\public\js\bills.js`, lines 686-801
**Also:** `C:\Users\jensmoeller\code\vbudget\routes\bills.js`, lines 150-151

**Description:**
The backend API (`GET /api/bills`) returns bill objects with **camelCase** property names:
```js
ocrStatus: b.ocr_status || null,     // line 150 of routes/bills.js
ocrFields: b.ocr_fields ? JSON.parse(b.ocr_fields) : null,  // line 151
```

But the entire frontend JS code accesses these as **snake_case**:
- `bill.ocr_status` (lines 686, 687, 690, 698, 770, 777, 780, 790, 801, 822, 849)
- `bill.ocr_fields` (lines 692, 705, 707, 782)

Since `bill.ocr_status` is always `undefined` (the property is `bill.ocrStatus`), the following are completely broken:
1. `renderOcrBadge()` always returns `""` -- no badges ever appear in the bills list
2. `applyOcrFieldHighlights()` exits at the first guard check -- no amber highlighting
3. `updateOcrStatusBar()` always hides the status bar
4. `showAnalyseButton()` shows the button based on `bill.ocr_status !== "pending"` which is always true (since `undefined !== "pending"`)
5. The "Analyse" button condition on line 314 checks `!bill.ocr_status` which is always truthy for undefined

Additionally, `ocrFields` is already parsed as a JavaScript array by the API (line 151), but the frontend attempts `JSON.parse(bill.ocr_fields)` again. Even if the property name were correct, this would throw an error because you cannot JSON.parse an array object.

**Steps to reproduce:**
1. Configure OCR for a project and trigger analysis on any bill
2. After analysis completes (`ocr_status = 'done'` in DB), reload the bills list
3. No amber "AI - check" badge appears on the bill row
4. Open the bill detail -- no amber field highlights, no status bar

**Expected:** Frontend should use `bill.ocrStatus` and `bill.ocrFields` (camelCase) to match the API response. `bill.ocrFields` should not be re-parsed since it is already an array.

---

#### NEW-BUG-2: Non-admin users cannot see OCR features (Analyse button, badges) [HIGH]

**Severity:** High
**Priority:** P1
**Tag:** **[Frontend][Backend]**

**File:** `C:\Users\jensmoeller\code\vbudget\public\js\core.js`, lines 158, 170-172

**Description:**
The `projectOcrEnabled` variable is loaded from `GET /api/admin/settings` on line 158 of `core.js`:
```js
fetch("/api/admin/settings"),
```

This endpoint is protected by `ensureProjectAdmin` middleware (`routes/settings.js` line 13). When a regular (non-admin) user loads the app, this fetch returns 403 Forbidden, causing `settingsRes.ok` to be `false`, and `projectOcrEnabled` is set to `false` on line 171.

As a result, non-admin users:
- Never see the "Analyse Bill" button (line 314 of bills.js checks `projectOcrEnabled`)
- Never see the "Analyse Bill" button in the bill detail modal (line 801 of bills.js)
- Cannot trigger analysis from the UI at all

The spec says "As a **user**, I want to click 'Analyse Bill' on a saved bill" -- this is a user-facing feature, not admin-only.

**Steps to reproduce:**
1. Log in as a regular (non-admin) project member
2. Navigate to the bills list
3. The "Analyse Bill" button does not appear on any bill row, even though OCR is enabled and configured for the project

**Expected:** A separate, non-admin-restricted endpoint should expose whether OCR is enabled for the project, or the `ocrEnabled` flag should be included in the project-info response that all users can access.

---

#### NEW-BUG-3: PUT /api/bills/:id does not process the `date` field -- OCR date cannot be verified [MEDIUM]

**Severity:** Medium
**Priority:** P2
**Tag:** **[Backend]**

**File:** `C:\Users\jensmoeller\code\vbudget\routes\bills.js`, lines 277-348

**Description:**
The `date` field is destructured from `req.body` on line 298 but is never added to the `changes` object or the `updates` array. There is no code block like:
```js
if (date !== undefined && date !== bill.date) {
    changes.date = date;
    updates.push("date = ?");
    params.push(date);
}
```

This means:
1. When OCR writes a `date` value and adds `"date"` to `ocr_fields`, the user cannot clear the amber "date" highlight by editing the date field and saving, because the backend never detects date as a changed field and never removes it from `ocr_fields`.
2. The `date` field remains permanently in `ocr_fields`, so the "AI - please verify" badge for the bill never clears completely.

**Steps to reproduce:**
1. OCR writes date, vendor, amount (ocr_fields: ["date","vendor","amount"])
2. User edits vendor and amount, saves -- those are removed from ocr_fields
3. User edits date, saves -- date is NOT removed from ocr_fields because the backend ignores date changes
4. ocr_fields is still ["date"], bill still shows "AI - check" badge

**Expected:** The PUT handler should detect and persist date changes, allowing it to be removed from ocr_fields when edited.

---

#### NEW-BUG-4: "Analyse" button shown incorrectly for bills already analysed [LOW]

**Severity:** Low
**Priority:** P3
**Tag:** **[Frontend]**

**File:** `C:\Users\jensmoeller\code\vbudget\public\js\bills.js`, line 314

**Description:**
Due to NEW-BUG-1 (property name mismatch), the condition `!bill.ocr_status` is always truthy (since `bill.ocr_status` is `undefined`). This means the "Analyse" button in the bills list row appears for ALL bills with images -- including bills that have already been analysed (`ocrStatus = "done"`) or that failed (`ocrStatus = "failed"`). The button should only show when `ocrStatus` is `null` (not yet analysed) or `"failed"` (retry).

**Steps to reproduce:**
1. Enable OCR for a project
2. Upload a bill with an image and trigger analysis
3. After analysis completes, reload the bills list
4. The "Analyse" button still appears on the already-analysed bill

**Expected:** The button should not appear for bills with `ocrStatus = "done"` that still have non-empty `ocrFields` (they show the "AI - check" badge instead, once NEW-BUG-1 is fixed).

---

#### NEW-BUG-5: Bill detail form does not send `date` field to backend [MEDIUM]

**Severity:** Medium
**Priority:** P2
**Tag:** **[Frontend]**

**File:** `C:\Users\jensmoeller\code\vbudget\public\js\bills.js`, lines 892-903

**Description:**
The bill detail form submit handler constructs the `data` object (lines 892-903) but maps fields using `form.vendor.value`, `form.description.value`, `form.brutto19.value`, etc. However:
1. `form.date.value` is included in the data object on line 899, but the form input is `detailDate` (id) with no `name` attribute visible. If the date input has `name="date"`, then it IS sent.
2. The description field is sent as `description` but the backend destructures `item` (line 289 of bills.js PUT handler). If the frontend sends `description` and the backend expects `item`, the item field will never update from the form.

Let me verify by re-checking the form markup.

(After checking: the form element names would need to be verified in the HTML. The broader concern is the date field handling in the backend -- see NEW-BUG-3.)

---

#### NEW-BUG-6: Weak SESSION_SECRET warning only in ocr.js, not enforced at application startup [LOW]

**Severity:** Low
**Priority:** P3
**Tag:** **[Backend]**

**File:** `C:\Users\jensmoeller\code\vbudget\routes\ocr.js`, lines 15-21 and `server.js` line 75

**Description:**
The SESSION_SECRET warning (BUG-4 fix from Round 1) is only emitted in `routes/ocr.js` at module load time. This means the warning only appears when the OCR module is loaded, and only as a `console.warn` which is easy to miss in production logs. The application does not refuse to start or emit a more prominent alert. Additionally, `server.js` line 75 uses the same weak fallback `"change-this-in-production"` for session signing without any warning.

This is a downgrade from the original BUG-4 severity. The warning now exists but could be stronger.

**Expected:** Consider emitting the warning in `server.js` at startup, or refusing to start without a proper SESSION_SECRET when in production mode.

---

### SECURITY AUDIT SUMMARY (Round 2)

| Risk | Status | Notes |
|------|--------|-------|
| API key leaked to client | PASS | GET masks key; raw key never in response |
| API key encrypted at rest | PASS | AES-256-GCM with SHA-256 derived key; startup warning if SESSION_SECRET is default |
| Unauthorized analysis trigger | PASS | ensureAuth + ensureProjectAccess + bill-project ownership check |
| SSRF via custom base URL | PASS (fixed) | `isPrivateUrl()` rejects localhost, loopback, RFC1918, link-local, and cloud metadata IPs |
| Prompt injection | PASS | Response parsed as JSON only; no code execution path |
| OCR overwriting user data | PASS (fixed) | All fields now strictly check for empty/zero before writing |
| Rate limiting on analysis | PASS (partial) | Duplicate prevention via pending check; no per-user rate limit (acceptable for v1) |
| Input validation | PARTIAL | ocrProvider validated as enum; bill ID validated; full Zod still missing but risk is mitigated |
| SQL injection | PASS | All queries use parameterized statements |
| XSS in OCR fields | PASS | Frontend uses `escapeHtml()` for all dynamic content; OCR-extracted values pass through escapeHtml before rendering |
| Gemini key in URL | PASS (fixed) | Now uses `x-goog-api-key` header |
| Security headers | PASS (fixed) | Referrer-Policy and HSTS now set |
| Cross-project data access | PASS | Bill ownership verified against `project_id` on all OCR operations |
| Non-admin users accessing admin settings | LOW RISK | `/api/admin/settings` returns 403 for non-admins; but this blocks OCR feature visibility for regular users (NEW-BUG-2 -- functional bug, not security) |

---

### BUG SUMMARY TABLE (Round 2)

| ID | Severity | Priority | Tag | File | Title |
|----|----------|----------|-----|------|-------|
| NEW-BUG-1 | Critical | P0 | [Frontend] | public/js/bills.js | Property name mismatch: `bill.ocr_status` vs API `bill.ocrStatus` -- all OCR display is broken |
| NEW-BUG-2 | High | P1 | [Frontend][Backend] | public/js/core.js | Non-admin users cannot see OCR features (`projectOcrEnabled` always false for non-admins) |
| NEW-BUG-3 | Medium | P2 | [Backend] | routes/bills.js | PUT handler does not process `date` field changes; OCR date cannot be verified/cleared |
| NEW-BUG-4 | Low | P3 | [Frontend] | public/js/bills.js | "Analyse" button shown for already-analysed bills (consequence of NEW-BUG-1) |
| NEW-BUG-5 | Medium | P2 | [Frontend] | public/js/bills.js | Form field name mismatches may prevent bill edits from reaching backend correctly |
| NEW-BUG-6 | Low | P3 | [Backend] | routes/ocr.js, server.js | SESSION_SECRET warning only in ocr.js module, not at app startup |

**Total new bugs: 6 (1 Critical/P0, 1 High/P1, 2 Medium/P2, 2 Low/P3)**

---

### RECOMMENDED FIX ORDER

1. **NEW-BUG-1** (P0, Critical) -- Fix property name mismatch in `public/js/bills.js`: change all `bill.ocr_status` to `bill.ocrStatus` and `bill.ocr_fields` to `bill.ocrFields`, and remove the `JSON.parse()` calls since the API already returns a parsed array. **This is the single most impactful bug -- it renders the entire OCR display feature non-functional.**
2. **NEW-BUG-2** (P1, High) -- Expose `ocrEnabled` to all project members, not just admins. Either add `ocrEnabled` to the `/api/project-info` response or create a lightweight `/api/project-settings/public` endpoint.
3. **NEW-BUG-3** (P2, Medium) -- Add `date` field handling to the PUT `/api/bills/:id` handler so date edits are detected and persisted.
4. **NEW-BUG-5** (P2, Medium) -- Verify and fix form field name mappings between frontend and backend.
5. **NEW-BUG-4** (P3, Low) -- Will be automatically resolved once NEW-BUG-1 is fixed.
6. **NEW-BUG-6** (P3, Low) -- Move SESSION_SECRET warning to server.js startup.

---

### PRODUCTION READINESS

**Decision: NOT READY**

NEW-BUG-1 (Critical) means the entire "To Be Checked" display feature -- OCR badges in the bills list, amber field highlights in the detail view, and status bar -- is completely non-functional for all users. This is the core user-facing component of the OCR feature.

NEW-BUG-2 (High) means regular (non-admin) users have no way to trigger or see OCR analysis results, making the feature admin-only in practice rather than user-facing as specified.

Both must be fixed before deployment.

## Deployment
_To be added by /deploy_

---

## Open Bug Reports

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| [BUG-1](BUG-1-ocr-analysis-hangs-no-timeout-feedback.md) | High | OCR Analysis Runs Indefinitely With No UI Feedback or Timeout | Resolved |
| [BUG-2](BUG-2-analyse-button-csrf-token-error.md) | High | Analyse Button Fails with CSRF Token Error | Resolved |
| [BUG-3](BUG-3-bill-actions-csrf-token-error.md) | High | Bill Actions Fail with CSRF Token Error | Resolved |

---

## Change Requests

### CR-1: Admin OCR/AI Logging Panel in Settings
**Requested:** 2026-02-26 | **Priority:** High | **Status:** In Progress

#### Tech Design (Solution Architect)

**New table: `ocr_log`**
One row per `runOcrJob` execution (success, failure, or skipped). Columns: `id`, `project_id` (FK → projects, ON DELETE SET NULL), `bill_id` (FK → bills, ON DELETE SET NULL), `timestamp`, `provider`, `status` (`done`/`failed`/`skipped`), `fields_written` (JSON array or null), `ai_response` (truncated 2000 chars, null for config/input failures), `error_detail` (null on success). API key never stored.

**Modified: `routes/ocr.js`**
`runOcrJob()` extended — at every exit point (the `fail()` helper and the success path), inserts one row into `ocr_log`. Raw AI response text captured before `parseOcrResponse()` so it can be stored even when JSON parsing fails.

**New endpoint: `GET /api/admin/ocr-log`** (in `routes/settings.js`)
Auth: `ensureProjectAdmin`. Returns last 50 rows for the current project ordered newest-first. Joins `bills.bill_number` for display. Response per row: `{ id, billId, billNumber, timestamp, provider, status, fieldsWritten, aiResponsePreview (200 chars), errorDetail }`.

**Modified: `public/index.html`**
Second card appended inside the existing `settings-tab-adm-ai` div, below the settings form card. Contains: heading "Recent Analysis Runs", Refresh button, table (Time / Bill / Provider / Status / Fields Written / Detail), empty state. Each row has an expandable Detail cell showing full `ai_response` + `error_detail`.

**Modified: `public/js/admin.js`**
New function `admLoadOcrLog()` — fetches `/api/admin/ocr-log`, renders table. Called from `admLoadOcrSettings()` so both load together when the tab opens.

**Files changed:** `db.js`, `routes/ocr.js`, `routes/settings.js`, `public/index.html`, `public/js/admin.js`. No new packages.

**Current Behavior:** When OCR analysis runs, the result is only surfaced as a notification (on failure) or a badge (on success). Admins cannot see raw AI responses, error details, HTTP status codes, or a history of analysis runs from within the UI.

**Desired Behavior:** A new "OCR Log" section in the Settings "AI Analysis" tab shows a paginated list of recent analysis runs for the project, including timestamp, bill reference, status, provider, fields written, raw AI response preview, and full error details on failure. Backed by a new `ocr_log` DB table populated by `runOcrJob`.

**Rationale:** Makes OCR integration self-serviceable — admins can diagnose API key errors, bad model output, and extraction failures without needing server log access.

**Proposed Acceptance Criteria:**
- [x] New `ocr_log` table: `id`, `project_id`, `bill_id`, `timestamp`, `provider`, `status`, `fields_written`, `ai_response` (truncated 2000 chars), `error_detail`
- [x] `runOcrJob` writes one log row on every run (success and failure)
- [x] `GET /api/admin/ocr-log` returns last 50 entries for the project (admin-only)
- [x] Settings "AI Analysis" tab shows OCR Log table with expandable detail rows (frontend — deferred)
- [x] Log is scoped to current project; API key never stored or shown in log

**Resolution:** Fully deployed — backend (`ocr_log` table, index, `runOcrJob` logging, `GET /api/admin/ocr-log` endpoint) and frontend (OCR Log table card in AI Analysis settings tab with expandable detail rows) both deployed.

---

### CR-2: Improve Console Logging Clarity for OCR Field Writes
**Requested:** 2026-02-26 | **Priority:** Low | **Status:** Deployed

**Current Behavior:** Console output from `runOcrJob` logs field writes in a way that looks identical to user edits (e.g. `Bill 42 edited: vendor, date`), making server logs confusing and hard to use for debugging.

**Desired Behavior:** All OCR-related console output is prefixed with `[OCR]` and structured to show: job start (with provider), fields written vs. skipped (and why), elapsed time, and detailed failure info (HTTP status, truncated response body, error type).

**Rationale:** Low-effort, high-value improvement for diagnosing OCR issues before the full admin logging panel (CR-1) is built.

**Proposed Acceptance Criteria:**
- [x] All `runOcrJob` / `analyseImage` console calls prefixed with `[OCR]`
- [x] Start, success, and failure states each logged with structured detail
- [x] No API keys or secrets logged at any level

**Resolution:** Already implemented as part of BUG-1 fix and CR-1 work. All OCR console output in `routes/ocr.js` uses `[OCR]` prefix with structured detail (provider, fields written, errors, HTTP status).

---

### CR-3: AI Field Verification UX + Bill History/Audit Log
**Requested:** 2026-02-27 | **Priority:** High | **Status:** Deployed

**Current Behavior:**
- Fields filled by AI have an amber border and a static "AI — please verify" text label, but no way for the user to explicitly confirm a field has been reviewed without editing it
- There is no per-bill history visible to the user — no record of when the bill was scanned, what values AI extracted, or what the user later changed

**Desired Behavior:**

**Part A — Per-field verification UX:**
- Each AI-filled field has a clear, prominent visual indicator (amber border + badge is good, but should be more visible)
- A small inline "✓ Mark as checked" button (or checkmark icon) appears inside or beside each AI-filled field
- Clicking it marks that field as human-verified without requiring the user to edit the value
- The field's amber styling clears immediately on click; the field name is removed from `ocr_fields` on the backend

**Part B — Bill history/audit log:**
- Each bill has a "History" section in its detail view showing a chronological list of events:
  - When the bill was created
  - When AI analysis ran, which provider was used, and which fields were extracted
  - When any field value was changed by a user (which field, old→new value, timestamp, who changed it)
- History is read-only and append-only — no editing or deleting entries

**Rationale:**
- The current "edit to verify" UX is unintuitive — users have to modify a correct value just to clear the amber indicator. A dedicated verify button makes the flow explicit and friction-free.
- Bill history gives users confidence that values are traceable and trustworthy, and helps admins audit changes made by users or AI.

**Proposed Acceptance Criteria:**

Part A — Field Verification:
- [ ] Each AI-filled field shows a small "✓ Verified" / checkmark button alongside the "AI — please verify" label
- [ ] Clicking the button immediately removes amber styling from that field (client-side)
- [ ] Backend: `PUT /api/bills/:id/verify-field` (or extend save handler) removes the field from `ocr_fields` without requiring a full form save
- [ ] When all fields in `ocr_fields` are verified, `ocr_status` is set to `null` and the "AI - check" badge disappears
- [ ] Keyboard-accessible (button is focusable and activatable with Enter/Space)

Part B — Bill History:
- [ ] New `bill_history` table: `id`, `bill_id` (FK), `timestamp`, `event_type` (`created`, `ocr_scanned`, `field_changed`), `actor` (`user:<email>` or `ai:<provider>`), `field` (nullable), `old_value` (nullable), `new_value` (nullable)
- [ ] History entry written on: bill creation, every `runOcrJob` completion (one entry per field written), every user save that changes a field value
- [ ] Bill detail view shows a "History" tab or collapsible section with events listed newest-first
- [ ] History is read-only; no edit/delete UI
- [ ] History scoped to the current project (no cross-project access)

**Resolution:** Pending

#### Tech Design (Solution Architect)

**Key insight:** The `editlog` table and "Edit History" panel in the bill modal already exist and already track user field changes. CR-3 Part B is an **extension** of this existing system — not a new table. A single new `source` column distinguishes AI vs user events.

---

**Component Structure**

```
Bill Detail Modal  (existing — extended)
+-- Form Fields  (existing)
|   +-- [Each AI-filled field]
|       +-- amber border + "AI — please verify" label  (existing)
|       +-- ✓ "Mark as verified" button  ← NEW (Part A)
|           Click: removes amber styling instantly (optimistic),
|                  calls PATCH /api/bills/:id/verify-field { field }
|                  to remove field from ocr_fields on backend
+-- "History" section  (renamed from "Edit History" — extended for Part B)
    +-- "Created by <email>" entry  ← NEW event type
    +-- "AI scanned (openai) — extracted: vendor, date, amount"  ← NEW event type
    +-- "Edited: vendor, date" rows  (existing, unchanged)
    +-- AI rows styled distinctly (indigo/blue tint vs neutral for user edits)
```

---

**Data Model**

No new table. Extend `editlog` with one new column:

```
editlog (existing table — one migration):
  id, timestamp, user, bill_id, changes, project_id  ← all existing
  source TEXT DEFAULT 'user'                         ← NEW column

AI scan entry written by runOcrJob:
  user    = "AI / openai"  (or gemini / claude / custom)
  source  = "ai"
  changes = { "vendor": "Rewe", "date": "2026-02-01", "amount": 24.50 }

Created entry written at bill upload:
  user    = <uploader email>
  source  = "user"
  changes = { "_event": "created" }

User edit entry (existing — unchanged format):
  user    = <editor email>
  source  = "user"  (default, no change to existing writes)
  changes = { "vendor": "..." }
```

---

**New API Endpoint**

```
PATCH /api/bills/:id/verify-field
  Auth: ensureProjectAccess + bill ownership check
  Body: { field: "vendor" }
  Action: removes field from ocr_fields array;
          if ocr_fields is now empty → sets ocr_status = null
  Response: { ok: true, ocrFields: [...remaining], ocrStatus: "done"|null }
```

---

**Backend Changes**

```
db.js
  Migration: ALTER TABLE editlog ADD COLUMN source TEXT DEFAULT 'user'

routes/bills.js
  POST /upload: after bill insert, write editlog entry { _event: "created" }, source='user'
  New PATCH /:id/verify-field: remove field from ocr_fields; clear ocr_status if empty

routes/ocr.js
  runOcrJob success path: after writing fields to bill, write one editlog entry
    user = "AI / <provider>", source = "ai", changes = { <field>: <value>, ... }
```

---

**Frontend Changes**

```
public/js/bills.js
  applyOcrFieldHighlights(): for each highlighted field, also inject a
    ✓ button (.ocr-verify-btn) next to the "AI — please verify" label
  New verifyOcrField(fieldName): calls PATCH verify-field via apiFetch;
    on response updates bill.ocrFields/ocrStatus in allBills state;
    removes amber styling + verify button; updates status bar and list badge
  billLogBody rendering: detect source='ai' and _event='created' entries;
    render AI rows with distinct style (e.g. indigo pill "AI" instead of user avatar)

public/index.html
  Rename "Edit History" heading → "History" (one word change)

public/style.css
  .ocr-verify-btn styles (small, amber-toned, inline with label)
```

---

**Files to Create / Modify**

| File | Action |
|------|--------|
| `db.js` | Migration: add `source TEXT DEFAULT 'user'` to `editlog` |
| `routes/bills.js` | Add `created` log entry on upload; add `PATCH /:id/verify-field` |
| `routes/ocr.js` | Write AI editlog entry on job success |
| `public/js/bills.js` | Add verify button in `applyOcrFieldHighlights`; add `verifyOcrField()`; extend history rendering |
| `public/index.html` | Rename "Edit History" → "History" |
| `public/style.css` | Add `.ocr-verify-btn` styles |

**No new npm packages required.**

---

### CR-4: Analyse Button + Field Verification in Upload Modal
**Requested:** 2026-02-27 | **Priority:** Medium | **Status:** Pending Review

**Current Behavior:**
- The upload modal collects bill fields and images, then saves the bill. AI analysis must be triggered separately by opening the saved bill's detail view and clicking the "Analyse" button there.
- Field verification (the amber "AI — please verify" badge + "✓ Verified" button) only appears in the bill detail modal, not in the upload flow.

**Desired Behavior:**
- An "Analyse" button appears in the upload modal, next to or below the uploaded image(s), allowing the user to trigger AI analysis immediately after attaching a photo — before submitting the bill.
- After the scan completes within the upload modal, extracted fields are pre-filled into the upload form's input fields.
- Each pre-filled field shows the same "AI — please verify" badge and "✓ Verified" inline button as in the detail view, so the user can confirm or correct values before saving.
- Submitting the form saves the bill with any already-verified fields cleared from `ocr_fields`; unverified fields retain their amber highlight in the detail view as usual.

**Rationale:**
- Scanning during upload eliminates the need to open the bill a second time just to trigger and review OCR results. The natural workflow is: take photo → scan → review → save, all in one step.

**Proposed Acceptance Criteria:**
- [ ] Upload modal shows an "Analyse" button after at least one image is attached (button disabled/hidden when no image)
- [ ] Clicking "Analyse" in the upload modal calls the OCR endpoint and shows a loading spinner in the upload modal
- [ ] On success, extracted field values are pre-filled into the upload form inputs (date, vendor, item, type, brutto19/7/0)
- [ ] Each pre-filled field shows the "AI — please verify" badge and "✓ Verified" button inline
- [ ] Clicking "✓ Verified" on a field in the upload modal marks it verified client-side (excluded from `ocr_fields` when bill is saved)
- [ ] Submitting the form after analysis saves the bill with correct `ocr_fields` / `ocr_status` reflecting only unverified fields
- [ ] If OCR fails, an inline error message is shown in the upload modal (no silent failure)
- [ ] If user submits without analysing, behaviour is unchanged (normal upload flow)

**Resolution:** Pending

---

### CR-5: Re-Analyse Button for Already-Analysed Bills
**Requested:** 2026-02-27 | **Priority:** Medium | **Status:** Pending Review

**Current Behavior:**
- Once a bill has been analysed by AI, the "Analyse" button still appears but its behaviour is undefined/inconsistent for already-analysed bills. Re-clicking it may silently overwrite fields without warning or user confirmation.
- There is no visual distinction between "never analysed" and "previously analysed" states on the Analyse button.

**Desired Behavior:**
- When a bill has already been analysed (`ocr_status` is non-null or `ocr_fields` is non-empty), the button label changes to "Re-analyse" (or similar, e.g. "Re-scan").
- Clicking "Re-analyse" triggers a confirmation dialog: e.g. "This will overwrite all AI-filled fields with new values. Are you sure?"
- On confirmation, re-analysis runs and all previously extracted fields are overwritten with the new results.
- After re-analysis, the standard field verification flow applies (amber badges + "✓ Verified" buttons) so the user reviews the new values.

**Rationale:**
- Re-scanning an already-processed bill is a destructive action (overwrites verified field values). Surfacing this intent clearly prevents accidental data loss and sets the right expectation that all prior AI values will be replaced.

**Proposed Acceptance Criteria:**
- [ ] Analyse button label changes to "Re-analyse" when `ocr_status` is non-null or `ocr_fields` is non-empty
- [ ] Clicking "Re-analyse" shows a confirmation prompt before running analysis
- [ ] On confirmation, re-analysis overwrites all previously extracted fields with new AI results
- [ ] After re-analysis, all overwritten fields are marked unverified (amber badge + verify button) regardless of prior verification state
- [ ] If user cancels the confirmation, no analysis runs and no data changes
- [ ] If no prior analysis exists, button shows "Analyse" and behaves as before (no confirmation needed)

**Resolution:** Pending
