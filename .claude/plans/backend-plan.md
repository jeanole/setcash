# Backend Implementation Plan — CR-23

## Feature
CR-23: Enrich Telegram Upload Response with OCR Fields, Errors, and Bill Link
Spec: `features/PROJ-12-integrations.md` → Change Requests → CR-23

## Context Summary
- Telegram handlers live in `nextjs/lib/telegram/handlers.ts`
- `processSinglePhoto()` and `processMediaGroup()` both: download → create bill → fire-and-forget OCR → send static ACK
- `maybeRunOcr()` calls `runOcrJob()` fire-and-forget, no way to send results back
- `runOcrJob()` in `lib/ocr.ts` updates bill with `ocrStatus`, `ocrFields`, and writes extracted values to bill fields
- Bot messages are currently in German; OCR follow-up should be in English
- `NEXTAUTH_URL` env var holds the app base URL

## User Decisions
- **Language:** OCR follow-up messages in English (existing German messages unchanged)
- **Bill link:** Always include when `NEXTAUTH_URL` is set

## Open Bug Reports to Address
None for PROJ-12

## Files to Modify

### 1. `nextjs/lib/telegram/handlers.ts` — Main changes

**Modify `maybeRunOcr()`** to accept `bot` and `chatId`, and send follow-up after OCR:

```typescript
async function maybeRunOcr(
  billId: string,
  projectId: string,
  bot: TelegramBot,
  chatId: number
): Promise<void> {
  const settings = await getProjectSettings(projectId);
  if (!settings.ocrEnabled) return;

  try {
    const { runOcrJob } = await import('../ocr');
    // Await OCR, then send follow-up — entire block is fire-and-forget from caller
    runOcrJob(billId, projectId)
      .then(() => sendOcrFollowUp(bot, chatId, billId))
      .catch((e: Error) => {
        console.error(`[OCR] Unhandled error for bill #${billId}:`, e.message);
        sendOcrFailureMessage(bot, chatId, billId, e.message);
      });
  } catch (e) {
    console.error('[Telegram] Failed to import OCR module:', (e as Error).message);
  }
}
```

**Add `sendOcrFollowUp()` function:**
- Read bill from DB: `ocrStatus`, `ocrFields`, `vendor`, `date`, `item`, `type`, `brutto19`, `brutto7`, `brutto0`, `grossAmount`
- If `ocrStatus === 'done'` and fields were written:
  - Format each non-null extracted field as a line: `Vendor: REWE`, `Date: 14.03.2026`, `Amount: 24,50 €`, etc.
  - Format amounts with 2 decimal places and `€` suffix
  - Format date in `DD.MM.YYYY` locale format
  - Skip null/empty fields
- If `ocrStatus === 'failed'`:
  - Read latest `OcrLog` for the bill to get `errorDetail`
  - Send failure message with reason
- If `ocrStatus === 'done'` but no fields written:
  - Send "Analysis complete — no fields could be extracted"
- Append bill link if `NEXTAUTH_URL` is set

**Add `sendOcrFailureMessage()` function:**
- Sends: `"⚠️ Analysis failed: {reason}"`
- Appends bill link

**Add `formatBillLink()` helper:**
- Returns `{NEXTAUTH_URL}/bills/{billId}` if env var set, else `null`

**Update initial ACK messages** in `processSinglePhoto()` and `processMediaGroup()`:
- Include bill link in the ACK message (not just the follow-up)
- Change OCR note from `"Beleganalyse läuft im Hintergrund."` to `"Analysing bill…"` (English, per user decision)
- If OCR disabled: ACK still includes bill link, no follow-up

**Update `maybeRunOcr()` call sites:**
- `processSinglePhoto()`: pass `bot` and `msg.chat.id`
- `processMediaGroup()`: pass `bot` and `chatId`

### Message Format

**Success (fields extracted):**
```
✅ Analysis complete:
Vendor: REWE
Date: 14.03.2026
Amount: 24,50 €
Type: Kassenbon

🔗 View bill: https://app.setcash.com/bills/abc123
```

**Success (no fields):**
```
✅ Analysis complete — no fields could be extracted. Please fill in manually.

🔗 View bill: https://app.setcash.com/bills/abc123
```

**Failure:**
```
⚠️ Analysis failed: Invalid API key

🔗 View bill: https://app.setcash.com/bills/abc123
```

**Initial ACK (single photo, OCR enabled):**
```
✓ Foto empfangen – Beleg als Entwurf gespeichert.
Analysing bill…

🔗 View bill: https://app.setcash.com/bills/abc123
```

**Initial ACK (OCR disabled):**
```
✓ Foto empfangen – Beleg als Entwurf gespeichert.
Bitte in SetCash vervollständigen.

🔗 View bill: https://app.setcash.com/bills/abc123
```

## No New Files
All changes in `handlers.ts`.

## No Database Changes
Reads existing bill fields and OcrLog — no schema modifications.

## No New API Endpoints
All logic is internal to the Telegram handler.

## Checklist
- [ ] `maybeRunOcr()` accepts `bot` and `chatId`
- [ ] `sendOcrFollowUp()` reads bill + formats extracted fields
- [ ] `sendOcrFailureMessage()` reads OcrLog + sends error reason
- [ ] `formatBillLink()` uses `NEXTAUTH_URL` env var
- [ ] Bill link included in initial ACK message
- [ ] Bill link included in follow-up message
- [ ] Follow-up is async (fire-and-forget from handler perspective)
- [ ] Skip null/empty fields in follow-up
- [ ] Amounts formatted with 2 decimal places + €
- [ ] Date formatted as DD.MM.YYYY
- [ ] OCR-disabled path still includes bill link in ACK
- [ ] Media group (album) path also sends follow-up
- [ ] No changes to existing German ACK text (except OCR note → English)
- [ ] TypeScript compiles: `npx tsc --noEmit`
