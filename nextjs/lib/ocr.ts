// ============================================================================
// OCR Library
// ============================================================================
// Handles OCR analysis using external AI providers (OpenAI, Gemini, Claude)
// ============================================================================

import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { Prisma } from '@prisma/client';
import { db as prisma } from './db';
import { UPLOADS_DIR, readFileForOCR } from './upload';

// ── Encryption helpers for API key at rest ──────────────────────────────────
// Uses AES-256-GCM. Key is derived from SESSION_SECRET via SHA-256.
// Stored format: <iv_hex>:<authTag_hex>:<ciphertext_hex>

const DEFAULT_SECRET = 'change-this-in-production';
const OCR_ENCRYPTION_SECRET = process.env.OCR_ENCRYPTION_SECRET || null;

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === DEFAULT_SECRET) {
  console.warn(
    '[Startup] WARNING: SESSION_SECRET is not set or uses the default value. ' +
      'Set a strong SESSION_SECRET environment variable before storing API keys.'
  );
}

function ocrSecretIsValid(): boolean {
  const base = OCR_ENCRYPTION_SECRET || process.env.SESSION_SECRET;
  return !!base && base !== DEFAULT_SECRET && base.length >= 16;
}

/**
 * Hard-fail guard for the API-key encryption secret. Call this once at server
 * startup (see server.ts) — NOT at module load. Performing the check (and any
 * process exit) at import time would kill the `next build` worker, which
 * evaluates route modules during page-data collection. Throws in production
 * when the secret is missing, too short, or left at the default value.
 */
export function assertOcrEncryptionConfigured(): void {
  if (process.env.NODE_ENV === 'production' && !ocrSecretIsValid()) {
    throw new Error(
      'OCR_ENCRYPTION_SECRET / SESSION_SECRET is missing, too short, or using a default value. Refusing to start in production.'
    );
  }
}

function getEncryptionKey(): Buffer {
  // Defense in depth: never derive a key from the insecure default in
  // production (startup assert should already have prevented reaching here).
  if (process.env.NODE_ENV === 'production' && !ocrSecretIsValid()) {
    throw new Error('OCR encryption secret is not configured.');
  }
  const base = OCR_ENCRYPTION_SECRET || process.env.SESSION_SECRET || DEFAULT_SECRET;
  return crypto.createHash('sha256').update(base).digest();
}

export function encryptApiKey(plaintext: string): string {
  if (!plaintext) return '';
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptApiKey(stored: string): string | null {
  if (!stored || !stored.includes(':')) return stored;
  try {
    const key = getEncryptionKey();
    const [ivHex, authTagHex, ciphertextHex] = stored.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const ciphertext = Buffer.from(ciphertextHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(ciphertext) + decipher.final('utf8');
  } catch (e) {
    console.error('[OCR] Failed to decrypt API key:', (e as Error).message);
    return null;
  }
}

export function maskApiKey(stored: string): string | null {
  if (!stored) return null;
  const plain = decryptApiKey(stored);
  if (!plain || plain.length < 4) return '...';
  return `...${plain.slice(-4)}`;
}

// ── SSRF protection ──────────────────────────────────────────────────────────
function isPrivateIp(ip: string): boolean {
  if (ip === 'localhost' || ip === '::1' || ip === '0.0.0.0' || ip === '[::]') return true;
  if (/^127\./.test(ip)) return true;
  if (/^169\.254\./.test(ip)) return true;
  if (/^10\./.test(ip)) return true;
  if (/^192\.168\./.test(ip)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  return false;
}

async function isPrivateUrl(urlString: string): Promise<boolean> {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    return true;
  }
  const hostname = parsed.hostname.toLowerCase();
  if (hostname.endsWith('.local')) return true;
  if (isPrivateIp(hostname)) return true;
  // Resolve DNS to catch rebinding attacks (e.g. evil.example.com → 169.254.169.254)
  try {
    const dns = await import('dns/promises');
    const { address } = await dns.lookup(hostname);
    if (isPrivateIp(address)) return true;
  } catch {
    // DNS resolution failed — block the request
    return true;
  }
  return false;
}

// ── OCR Prompt ───────────────────────────────────────────────────────────────
const OCR_PROMPT = `You are a receipt parser. Look at this receipt image and extract the following fields.
Return ONLY a valid JSON object with exactly these keys (use null for unknown/missing values):
{
  "date": "YYYY-MM-DD or null",
  "vendor": "merchant name or null",
  "item": "short description of goods or service or null",
  "type": "Kassenbon, Rechnung, Quittung, or null",
  "brutto19": number with 19% VAT or null,
  "brutto7": number with 7% VAT or null,
  "brutto0": VAT-exempt amount or null,
  "amount": total gross amount — set ONLY if VAT breakdown is completely absent from the document, otherwise null
}
Return nothing except the JSON object.`;

const OCR_SYSTEM_PROMPT = `You are a receipt/invoice data extraction system. Extract structured data from receipt and invoice images.

Extract the following fields:
- date: string in ISO 8601 format (YYYY-MM-DD), the date on the receipt/invoice
- vendor: string, the merchant or store name
- item: string, a short description of the goods or service purchased
- type: one of "Kassenbon", "Rechnung", or "Quittung"
- brutto19: number, the gross amount subject to 19% VAT
- brutto7: number, the gross amount subject to 7% VAT
- brutto0: number, the VAT-exempt gross amount
- amount: number, the total gross amount — use this field ONLY as a last resort when the document contains no VAT breakdown at all (no 19%, 7%, or 0% lines). If any VAT information is visible, populate the brutto fields instead and leave amount as null.

Rules:
- Prefer brutto19 / brutto7 / brutto0 over amount whenever VAT rates are shown on the document
- Set amount only when VAT breakdown is completely absent from the document
- Return null for any field that cannot be found or determined from the image
- Return ONLY a valid JSON object — no markdown, no code fences, no explanation
- Output schema: { "date": string|null, "vendor": string|null, "item": string|null, "type": string|null, "brutto19": number|null, "brutto7": number|null, "brutto0": number|null, "amount": number|null }`;

// ── Provider defaults ─────────────────────────────────────────────────────────
const PROVIDER_DEFAULTS: Record<string, { url: string; model: string }> = {
  openai:   { url: 'https://api.openai.com/v1',                         model: 'gpt-4o' },
  qwen25vl: { url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-vl-max' },
  qwen3vl:  { url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-vl-max-latest' },
  deepseek: { url: 'https://api.deepseek.com/v1',                       model: 'deepseek-chat' },
};

const OCR_FETCH_TIMEOUT_MS = 60_000;

// ── Provider: call AI vision API ─────────────────────────────────────────────
interface OcrResult {
  date: string | null;
  vendor: string | null;
  item: string | null;
  type: string | null;
  brutto19: number | null;
  brutto7: number | null;
  brutto0: number | null;
  amount: number | null;
}

interface AnalyseResult {
  parsed: OcrResult;
  rawText: string;
}

async function analyseImage(
  provider: string,
  apiKey: string,
  base64: string,
  mimeType: string,
  baseUrl: string | null
): Promise<AnalyseResult> {
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const OPENAI_COMPAT_PROVIDERS = new Set(['openai', 'custom', 'qwen25vl', 'qwen3vl', 'deepseek']);
  if (OPENAI_COMPAT_PROVIDERS.has(provider)) {
    const resolvedBaseUrl =
      provider === 'custom'
        ? baseUrl
        : (baseUrl || PROVIDER_DEFAULTS[provider]?.url || 'https://api.openai.com/v1');
    const url = `${resolvedBaseUrl}/chat/completions`;
    const model =
      provider === 'custom'
        ? 'gpt-4o'
        : (PROVIDER_DEFAULTS[provider]?.model || 'gpt-4o');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), OCR_FETCH_TIMEOUT_MS);
    let resp: Response;
    try {
      resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: OCR_SYSTEM_PROMPT },
            {
              role: 'user',
              content: [
                { type: 'text', text: OCR_PROMPT },
                { type: 'image_url', image_url: { url: dataUrl } },
              ],
            },
          ],
          max_tokens: 512,
        }),
        signal: controller.signal,
      });
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw new Error('Request timed out after 60s');
      throw e;
    } finally {
      clearTimeout(timer);
    }
    if (!resp.ok) {
      const rawBody = await resp.text().catch(() => '');
      const truncated = rawBody.slice(0, 500);
      let msg: string | undefined;
      try {
        msg = JSON.parse(rawBody)?.error?.message;
      } catch {}
      msg = msg || resp.statusText;
      console.error(`[OCR] Provider HTTP ${resp.status} (${provider}): ${truncated}`);
      if (resp.status === 401) throw new Error('Invalid API key');
      if (resp.status === 429) throw new Error('Rate limit exceeded');
      throw new Error(msg || `Provider error ${resp.status}`);
    }
    const data = await resp.json();
    const text = data.choices?.[0]?.message?.content || '';
    return { parsed: parseOcrResponse(text), rawText: text };
  }

  if (provider === 'gemini') {
    const url =
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), OCR_FETCH_TIMEOUT_MS);
    let resp: Response;
    try {
      resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: OCR_SYSTEM_PROMPT }] },
          contents: [
            {
              parts: [
                { text: OCR_PROMPT },
                { inline_data: { mime_type: mimeType, data: base64 } },
              ],
            },
          ],
        }),
        signal: controller.signal,
      });
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw new Error('Request timed out after 60s');
      throw e;
    } finally {
      clearTimeout(timer);
    }
    if (!resp.ok) {
      const rawBody = await resp.text().catch(() => '');
      const truncated = rawBody.slice(0, 500);
      let msg: string | undefined;
      try {
        msg = JSON.parse(rawBody)?.error?.message;
      } catch {}
      msg = msg || resp.statusText;
      console.error(`[OCR] Provider HTTP ${resp.status} (gemini): ${truncated}`);
      if (resp.status === 400 && msg?.includes('API_KEY')) throw new Error('Invalid API key');
      if (resp.status === 429) throw new Error('Rate limit exceeded');
      throw new Error(msg || `Provider error ${resp.status}`);
    }
    const data = await resp.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return { parsed: parseOcrResponse(text), rawText: text };
  }

  if (provider === 'claude') {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), OCR_FETCH_TIMEOUT_MS);
    let resp: Response;
    try {
      resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 512,
          system: OCR_SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: { type: 'base64', media_type: mimeType, data: base64 },
                },
                { type: 'text', text: OCR_PROMPT },
              ],
            },
          ],
        }),
        signal: controller.signal,
      });
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw new Error('Request timed out after 60s');
      throw e;
    } finally {
      clearTimeout(timer);
    }
    if (!resp.ok) {
      const rawBody = await resp.text().catch(() => '');
      const truncated = rawBody.slice(0, 500);
      let msg: string | undefined;
      try {
        msg = JSON.parse(rawBody)?.error?.message;
      } catch {}
      msg = msg || resp.statusText;
      console.error(`[OCR] Provider HTTP ${resp.status} (claude): ${truncated}`);
      if (resp.status === 401) throw new Error('Invalid API key');
      if (resp.status === 429) throw new Error('Rate limit exceeded');
      throw new Error(msg || `Provider error ${resp.status}`);
    }
    const data = await resp.json();
    const text = data.content?.[0]?.text || '';
    return { parsed: parseOcrResponse(text), rawText: text };
  }

  throw new Error(`Unknown provider: ${provider}`);
}

function sanitizeOcrString(val: unknown, maxLen = 255): string | null {
  if (val == null) return null;
  return String(val).replace(/[\x00-\x1F\x7F]/g, '').slice(0, maxLen) || null;
}

const VALID_OCR_TYPES = ['Kassenbon', 'Rechnung', 'Quittung'] as const;

function parseOcrResponse(text: string): OcrResult {
  const cleaned = text.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON found in provider response');
  const obj = JSON.parse(match[0]);

  const rawType = sanitizeOcrString(obj.type);
  const validatedType =
    rawType != null && (VALID_OCR_TYPES as readonly string[]).includes(rawType) ? rawType : null;

  const rawDate = sanitizeOcrString(obj.date);
  const validatedDate =
    rawDate != null && !isNaN(new Date(rawDate).getTime()) ? rawDate : null;

  return {
    date: validatedDate,
    vendor: sanitizeOcrString(obj.vendor),
    item: sanitizeOcrString(obj.item),
    type: validatedType,
    brutto19: obj.brutto19 != null ? parseFloat(obj.brutto19) : null,
    brutto7: obj.brutto7 != null ? parseFloat(obj.brutto7) : null,
    brutto0: obj.brutto0 != null ? parseFloat(obj.brutto0) : null,
    amount: obj.amount != null ? parseFloat(obj.amount) : null,
  };
}

// ── Background job ────────────────────────────────────────────────────────────
export async function runOcrJob(billId: string, projectId: string): Promise<void> {
  const jobStart = Date.now();
  let resolvedProvider: string | null = null;

  const writeLog = async (
    status: string,
    {
      fieldsWritten = null,
      aiResponse = null,
      errorDetail = null,
    }: {
      fieldsWritten?: string[] | null;
      aiResponse?: string | null;
      errorDetail?: string | null;
    } = {}
  ) => {
    try {
      await prisma.ocrLog.create({
        data: {
          projectId,
          billId,
          provider: resolvedProvider ?? undefined,
          status,
          fieldsWritten: fieldsWritten ? JSON.stringify(fieldsWritten) : undefined,
          aiResponse: aiResponse !== null ? String(aiResponse).slice(0, 2000) : undefined,
          errorDetail: errorDetail !== null ? String(errorDetail) : undefined,
        },
      });
    } catch (logErr) {
      console.error(`[OCR] Failed to write ocr_log for bill ${billId}:`, (logErr as Error).message);
    }
  };

  // Detect re-analysis
  const priorBill = await prisma.bill.findUnique({
    where: { id: billId },
    select: { ocrStatus: true },
  });
  const isReanalysis = priorBill?.ocrStatus === 'done';

  // 1. Mark pending
  await prisma.bill.update({
    where: { id: billId },
    data: { ocrStatus: 'pending' },
  });

  const fail = async (reason: string, errorType?: string) => {
    await prisma.bill.update({
      where: { id: billId },
      data: { ocrStatus: 'failed' },
    });

    const bill = await prisma.bill.findUnique({
      where: { id: billId },
      select: { submittedByEmail: true },
    });

    if (bill) {
      await prisma.notification.create({
        data: {
          userEmail: bill.submittedByEmail,
          type: 'ocr_failed',
          message: `Bill analysis failed: ${reason}`,
          projectId,
        },
      });
    }

    const label = errorType ? `${errorType}: ` : '';
    console.error(`[OCR] Bill ${billId}: FAILED — ${label}${reason}`);
    await writeLog('failed', { errorDetail: reason });

    try {
      await prisma.editLog.create({
        data: {
          projectId,
          timestamp: new Date(),
          user: resolvedProvider ? `AI / ${resolvedProvider}` : 'AI',
          billId,
          changes: { _event: 'analysis_failed', reason },
          source: 'ai',
        },
      });
    } catch {}
  };

  try {
    // 2. Read project OCR settings
    const settingsRows = await prisma.projectSettings.findMany({
      where: { projectId },
    });
    const settings: Record<string, unknown> = {};
    for (const r of settingsRows) {
      try {
        settings[r.key] = JSON.parse(r.value || 'null');
      } catch {
        settings[r.key] = r.value;
      }
    }

    if (!settings.ocrEnabled) {
      return fail('OCR not enabled for this project', 'ConfigError');
    }
    if (!settings.ocrApiKey) {
      return fail('OCR not configured for this project', 'ConfigError');
    }

    const provider = (settings.ocrProvider as string) || 'openai';
    resolvedProvider = provider;
    const apiKey = decryptApiKey(settings.ocrApiKey as string);
    if (!apiKey) {
      return fail('Could not read API key', 'ConfigError');
    }

    const baseUrl = (settings.ocrBaseUrl as string) || null;

    console.log(
      `[OCR] Bill ${billId} (project ${projectId}): analysis started — provider: ${provider}`
    );

    // 3. Validate base URL (required for custom; SSRF-checked whenever user supplies one)
    if (provider === 'custom') {
      if (!baseUrl || !baseUrl.startsWith('https://')) {
        return fail('Custom provider base URL must start with https://', 'ConfigError');
      }
    }
    if (baseUrl) {
      if (!baseUrl.startsWith('https://')) {
        return fail('Provider base URL must start with https://', 'ConfigError');
      }
      if (await isPrivateUrl(baseUrl)) {
        return fail(
          'Provider base URL must not point to a private or reserved address',
          'SSRFError'
        );
      }
    }

    // 4. Get first image
    const img = await prisma.billImage.findFirst({
      where: { billId },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    if (!img || !img.filePath) {
      return fail('No image attached to this bill', 'InputError');
    }

    const imgBuffer = readFileForOCR(img.filePath);
    if (!imgBuffer) {
      return fail('Image file not found on disk', 'InputError');
    }

    // 5. Read and encode image
    const base64 = imgBuffer.toString('base64');
    const ext = path.extname(img.filePath).toLowerCase();
    const mimeType =
      ext === '.png'
        ? 'image/png'
        : ext === '.gif'
          ? 'image/gif'
          : ext === '.webp'
            ? 'image/webp'
            : 'image/jpeg';

    // 6. Call AI provider
    const { parsed: extracted, rawText } = await analyseImage(
      provider,
      apiKey,
      base64,
      mimeType,
      baseUrl
    );

    // 7. Get current bill values
    const bill = await prisma.bill.findUnique({ where: { id: billId } });
    if (!bill) {
      return fail('Bill not found', 'DBError');
    }

    // Fields eligible for OCR writing
    const fieldChecks: Record<string, () => boolean> = {
      date: () =>
        !!extracted.date && (isReanalysis || !bill.date || bill.date.toISOString().trim() === ''),
      vendor: () =>
        !!extracted.vendor && (isReanalysis || !bill.vendor || bill.vendor.trim() === ''),
      item: () =>
        !!extracted.item && (isReanalysis || !bill.item || bill.item.trim() === ''),
      type: () =>
        !!extracted.type && (isReanalysis || !bill.type || bill.type.trim() === ''),
      brutto19: () =>
        extracted.brutto19 != null &&
        extracted.brutto19 > 0 &&
        (isReanalysis || Number(bill.brutto19) === 0),
      brutto7: () =>
        extracted.brutto7 != null &&
        extracted.brutto7 > 0 &&
        (isReanalysis || Number(bill.brutto7) === 0),
      brutto0: () =>
        extracted.brutto0 != null &&
        extracted.brutto0 > 0 &&
        (isReanalysis || Number(bill.brutto0) === 0),
      amount: () =>
        extracted.amount != null &&
        extracted.amount > 0 &&
        (isReanalysis || Number(bill.grossAmount) === 0),
    };

    const writtenFields: string[] = [];
    const skippedFields: string[] = [];
    const updates: Record<string, unknown> = {};

    for (const [field, check] of Object.entries(fieldChecks)) {
      if (check()) {
        if (field === 'date' && extracted.date) {
          const d = new Date(extracted.date + 'T00:00:00.000Z');
          if (!isNaN(d.getTime())) {
            updates['date'] = d;
            writtenFields.push(field);
          }
        } else if (field === 'amount') {
          // 'amount' from OCR maps to grossAmount in Prisma (no VAT breakdown available)
          updates['grossAmount'] = extracted.amount;
          writtenFields.push(field);
        } else {
          updates[field] = extracted[field as keyof OcrResult];
          writtenFields.push(field);
        }
      } else if (extracted[field as keyof OcrResult] != null) {
        skippedFields.push(field);
      }
    }

    // 8. Write fields and recalculate totals if amounts changed
    if (writtenFields.length > 0) {
      const amountFields = ['brutto19', 'brutto7', 'brutto0'];
      const anyAmountWritten = writtenFields.some((f) => amountFields.includes(f));
      if (anyAmountWritten && (isReanalysis || Number(bill.grossAmount) === 0)) {
        const newB19 = writtenFields.includes('brutto19')
          ? extracted.brutto19
          : Number(bill.brutto19) || 0;
        const newB7 = writtenFields.includes('brutto7')
          ? extracted.brutto7
          : Number(bill.brutto7) || 0;
        const newB0 = writtenFields.includes('brutto0')
          ? extracted.brutto0
          : Number(bill.brutto0) || 0;
        const recalcAmount = (newB19 || 0) + (newB7 || 0) + (newB0 || 0);
        updates.grossAmount = recalcAmount;
        updates.nettoAmount = (newB19 || 0) / 1.19 + (newB7 || 0) / 1.07 + (newB0 || 0);
        writtenFields.push('amount');
      }

      await prisma.bill.update({
        where: { id: billId },
        data: updates,
      });
    }

    // 9. Set ocr_status and ocr_fields
    const finalFields = writtenFields.length > 0 ? writtenFields : null;
    await prisma.bill.update({
      where: { id: billId },
      data: {
        ocrStatus: 'done',
        ocrFields: finalFields && finalFields.length > 0 ? finalFields : Prisma.DbNull,
      },
    });

    // 10. Write success log
    await writeLog('done', {
      fieldsWritten: finalFields,
      aiResponse: rawText,
    });

    // 11. Write AI editlog entry
    if (writtenFields.length > 0) {
      const extractedChanges: Record<string, unknown> = {};
      for (const f of writtenFields) {
        if (f !== 'amount') extractedChanges[f] = extracted[f as keyof OcrResult];
      }
      if (writtenFields.includes('amount') && extracted.amount != null) {
        extractedChanges.amount = extracted.amount;
      }
      await prisma.editLog.create({
        data: {
          projectId,
          timestamp: new Date(),
          user: `AI / ${provider}`,
          billId,
          changes: extractedChanges as never,
          source: 'ai',
        },
      });
    }

    const elapsed = Date.now() - jobStart;
    const writtenList = writtenFields.length > 0 ? writtenFields.join(', ') : 'none';
    const skippedList = skippedFields.length > 0 ? skippedFields.join(', ') : 'none';
    console.log(
      `[OCR] Bill ${billId}: wrote ${writtenFields.length} fields [${writtenList}] — ${skippedFields.length} skipped (already filled) [${skippedList}]`
    );
    console.log(
      `[OCR] Bill ${billId}: done in ${elapsed}ms — ocr_status=done, ocr_fields=[${finalFields ? finalFields.join(', ') : ''}]`
    );
  } catch (e) {
    const errorType = (e as Error).name || 'Error';
    await fail((e as Error).message || 'Unknown error', errorType);
  }
}

export { isPrivateUrl };
