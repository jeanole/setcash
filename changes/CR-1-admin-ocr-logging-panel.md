# CR-1: Admin OCR/AI Logging Panel in Settings

**Status:** Open
**Requested:** 2026-02-26
**Priority:** High
**Type:** New Feature (existing scope)

## Related Feature
**Feature:** [PROJ-1: OCR / AI Bill Analysis]
**Feature Spec:** [features/PROJ-1-ocr-bill-analysis.md](../features/PROJ-1-ocr-bill-analysis.md)

## Change Description

### Current Behavior / Limitation
When the OCR analysis job runs, the result (success or failure) is only surfaced as:
- A notification to the bill owner on failure
- An `ocr_status` badge in the bills list on success

There is no way for a project admin to see what actually happened during analysis — the raw AI prompt sent, the raw AI response received, whether it was an API error (e.g. 401, 429, 500), a JSON parse failure, or a partial result. Diagnosing integration problems (wrong API key, bad model configuration, unexpected AI output) requires reading server logs directly, which is not accessible to admins via the UI.

### Desired Behavior / New Capability
A new **"OCR Log"** sub-tab (or section) in the project Settings panel (admin-only) that shows a chronological log of recent OCR analysis runs for the project. Each log entry should include:

- **Timestamp** of the run
- **Bill reference** (bill ID + vendor/date if available) — linked to the bill
- **Status**: `done` / `failed` / `pending`
- **Provider** used (e.g. "OpenAI GPT-4o")
- **Fields written** (if successful) — e.g. `vendor, date, amount`
- **AI response summary** — the raw JSON returned by the model, or a truncated preview
- **Error detail** (if failed) — the full error message, HTTP status code from the provider, and response body (truncated to ~500 chars to avoid huge payloads)

The log should be:
- Scoped to the current project (no cross-project leakage)
- Paginated or limited to the last 50 entries
- Clearable by the admin (optional)
- Read-only (no editing)

### Rationale
When OCR isn't extracting fields correctly, admins have no way to diagnose the root cause from within the app. Is the API key invalid? Is the model returning unexpected JSON? Is a field being ignored because it was already filled? The logging panel makes OCR integration self-serviceable — admins can identify and fix issues (wrong key, wrong provider, poor image quality) without needing server log access.

## Proposed Acceptance Criteria
- [ ] A new `ocr_log` table is added to the DB: `id`, `project_id`, `bill_id`, `timestamp`, `provider`, `status`, `fields_written` (JSON), `ai_response` (TEXT, truncated at 2000 chars), `error_detail` (TEXT)
- [ ] `runOcrJob` writes one row to `ocr_log` on every run — on success and on failure
- [ ] A new `GET /api/admin/ocr-log` endpoint returns the last 50 log entries for the current project, admin-only
- [ ] The Settings panel "AI Analysis" sub-tab gains an "OCR Log" section (below the config form) listing entries in a scrollable table
- [ ] Each log row shows: timestamp, bill link, status pill, provider, fields written (comma-separated), and an expandable "Details" section with the raw AI response or error
- [ ] Log entries are scoped to the requesting admin's project — no cross-project data
- [ ] The raw API key is never stored or displayed in the log

## Resolution
**Decision:** Pending
**Decided:** —
**Notes:** —
**Outcome:** Path A (feature spec updated)

## Additional Context
- This is closely related to BUG-1 (analysis hangs) — the log would also make it obvious when a job hung and what the last state was
- The `ai_response` field should store the raw text from the provider before JSON parsing, so failed parses are also diagnosable
- Consider adding a "Re-analyse" button next to each failed log entry as a future enhancement
