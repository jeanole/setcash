# PROJ-19: OCR / AI Bill Analysis (Next.js)

## Status: In Review
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
