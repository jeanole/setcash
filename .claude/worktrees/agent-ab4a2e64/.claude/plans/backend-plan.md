# Backend Implementation Plan — CR-1: Admin OCR/AI Logging Panel

## Feature
CR-1 in `features/PROJ-1-ocr-bill-analysis.md` — Admin OCR/AI Logging Panel in Settings

## Context Summary
- Project uses Node.js + Express + SQLite (better-sqlite3)
- DB migrations use try/catch pattern: `SELECT col FROM table LIMIT 1` → if error → `ALTER TABLE`
- `routes/ocr.js` contains `runOcrJob()` — the function we need to extend with logging
- `routes/settings.js` contains admin settings endpoints — we add the log query endpoint here
- `public/js/admin.js` handles admin settings UI — frontend work deferred to `/frontend`
- `public/index.html` — frontend work deferred to `/frontend`

## User Decisions
All decisions made by architect in CR-1 Tech Design — no open questions.

## Open Bug Reports to Address
- BUG-1 (OCR Analysis Runs Indefinitely) — already fixed in previous session; will update INDEX.md status

## Tables to Create

### `ocr_log`
| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PRIMARY KEY AUTOINCREMENT | |
| `project_id` | INTEGER | FK → projects(id) ON DELETE SET NULL |
| `bill_id` | INTEGER | FK → bills(id) ON DELETE SET NULL |
| `timestamp` | TEXT | ISO datetime, DEFAULT datetime('now') |
| `provider` | TEXT | e.g. "openai", "gemini", "claude", "custom" |
| `status` | TEXT | "done" / "failed" / "skipped" |
| `fields_written` | TEXT | JSON array or null |
| `ai_response` | TEXT | Truncated to 2000 chars, null for config/input failures |
| `error_detail` | TEXT | null on success |

Migration: CREATE TABLE IF NOT EXISTS in `db.js` (append to the main schema block is not possible since it uses IF NOT EXISTS — add as separate CREATE TABLE IF NOT EXISTS statement after the main block, before the existing ALTER migrations).

### Index
- `CREATE INDEX IF NOT EXISTS idx_ocr_log_project ON ocr_log(project_id, timestamp)`

## API Endpoints to Implement

### `GET /api/admin/ocr-log`
- **File:** `routes/settings.js`
- **Auth:** `ensureProjectAdmin`
- **Query:** Last 50 rows from `ocr_log` for `project_id`, joined with `bills.bill_number`, ordered by `timestamp DESC`
- **Response:** Array of objects:
  ```json
  {
    "id": 1,
    "billId": 42,
    "billNumber": "R-2026-042",
    "timestamp": "2026-02-26T14:30:00",
    "provider": "openai",
    "status": "done",
    "fieldsWritten": ["vendor", "date", "amount"],
    "aiResponsePreview": "first 200 chars...",
    "errorDetail": null
  }
  ```
- **Error cases:** 403 if not project admin (middleware handles)

## Backend Modifications

### `routes/ocr.js` — `runOcrJob()`
Extend to write one `ocr_log` row at every exit:

1. **Capture raw AI response text** — store the raw text from `analyseImage()` before it goes through `parseOcrResponse()`. This means `analyseImage()` needs to return both the parsed result AND the raw text. OR we capture the raw text separately. Simplest: modify `analyseImage` to return `{ parsed, rawText }` instead of just parsed result.

2. **At the `fail()` helper** — insert log row with status='failed', error_detail=reason, ai_response=null (since we haven't called the AI yet at most fail points), provider from settings (if available).

3. **At success path** — insert log row with status='done', fields_written=JSON array, ai_response=rawText (truncated to 2000 chars), error_detail=null.

4. **For config/input failures** (OCR not enabled, no API key, no image) — status='skipped' or 'failed', ai_response=null.

### `db.js`
- Add `CREATE TABLE IF NOT EXISTS ocr_log (...)` after existing schema block

## Implementation Steps (ordered)

1. **`db.js`** — Add `ocr_log` table creation + index
2. **`routes/ocr.js`** — Modify `analyseImage()` to return `{ parsed, rawText }`; update call sites. Modify `runOcrJob()` to capture raw response and insert `ocr_log` rows at every exit point.
3. **`routes/settings.js`** — Add `GET /api/admin/ocr-log` endpoint
4. **Verify** — No new npm packages needed

## Checklist
- [ ] `ocr_log` table created in db.js
- [ ] Index on (project_id, timestamp)
- [ ] `analyseImage()` returns raw text alongside parsed result
- [ ] `runOcrJob()` writes log row on success
- [ ] `runOcrJob()` writes log row on failure (all fail paths)
- [ ] `runOcrJob()` writes log row on skip (config/input errors)
- [ ] Raw AI response truncated to 2000 chars before storage
- [ ] API key NEVER stored in log
- [ ] `GET /api/admin/ocr-log` endpoint returns last 50 entries
- [ ] Endpoint joins bills.bill_number for display
- [ ] Endpoint scoped to current project
- [ ] Endpoint protected by ensureProjectAdmin
