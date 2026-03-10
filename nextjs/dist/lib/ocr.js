"use strict";
// ============================================================================
// OCR Library
// ============================================================================
// Handles OCR analysis using external AI providers (OpenAI, Gemini, Claude)
// ============================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptApiKey = encryptApiKey;
exports.decryptApiKey = decryptApiKey;
exports.maskApiKey = maskApiKey;
exports.runOcrJob = runOcrJob;
exports.isPrivateUrl = isPrivateUrl;
const crypto_1 = __importDefault(require("crypto"));
const path_1 = __importDefault(require("path"));
const client_1 = require("@prisma/client");
const db_1 = require("./db");
const upload_1 = require("./upload");
// ── Encryption helpers for API key at rest ──────────────────────────────────
// Uses AES-256-GCM. Key is derived from SESSION_SECRET via SHA-256.
// Stored format: <iv_hex>:<authTag_hex>:<ciphertext_hex>
const DEFAULT_SECRET = 'change-this-in-production';
const OCR_ENCRYPTION_SECRET = process.env.OCR_ENCRYPTION_SECRET || null;
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === DEFAULT_SECRET) {
    console.warn('[Startup] WARNING: SESSION_SECRET is not set or uses the default value. ' +
        'Set a strong SESSION_SECRET environment variable before storing API keys.');
}
if (process.env.NODE_ENV === 'production') {
    const base = OCR_ENCRYPTION_SECRET || process.env.SESSION_SECRET;
    if (!base || base === DEFAULT_SECRET || base.length < 16) {
        console.error('[Startup] OCR_ENCRYPTION_SECRET / SESSION_SECRET is missing, too short, or using a default value. Refusing to start in production.');
        process.exit(1);
    }
}
function getEncryptionKey() {
    const base = OCR_ENCRYPTION_SECRET || process.env.SESSION_SECRET || DEFAULT_SECRET;
    return crypto_1.default.createHash('sha256').update(base).digest();
}
function encryptApiKey(plaintext) {
    if (!plaintext)
        return '';
    const key = getEncryptionKey();
    const iv = crypto_1.default.randomBytes(12);
    const cipher = crypto_1.default.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}
function decryptApiKey(stored) {
    if (!stored || !stored.includes(':'))
        return stored;
    try {
        const key = getEncryptionKey();
        const [ivHex, authTagHex, ciphertextHex] = stored.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const ciphertext = Buffer.from(ciphertextHex, 'hex');
        const decipher = crypto_1.default.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);
        return decipher.update(ciphertext) + decipher.final('utf8');
    }
    catch (e) {
        console.error('[OCR] Failed to decrypt API key:', e.message);
        return null;
    }
}
function maskApiKey(stored) {
    if (!stored)
        return null;
    const plain = decryptApiKey(stored);
    if (!plain || plain.length < 4)
        return '...';
    return `...${plain.slice(-4)}`;
}
// ── SSRF protection ──────────────────────────────────────────────────────────
function isPrivateUrl(urlString) {
    let parsed;
    try {
        parsed = new URL(urlString);
    }
    catch (_a) {
        return true;
    }
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === 'localhost' || /^127\./.test(hostname) || hostname === '::1')
        return true;
    if (hostname.endsWith('.local'))
        return true;
    if (/^169\.254\./.test(hostname))
        return true;
    if (/^10\./.test(hostname))
        return true;
    if (/^192\.168\./.test(hostname))
        return true;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname))
        return true;
    if (hostname === '0.0.0.0' || hostname === '[::]')
        return true;
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
  "amount": total gross amount or null
}
Return nothing except the JSON object.`;
const OCR_FETCH_TIMEOUT_MS = 60000;
async function analyseImage(provider, apiKey, base64, mimeType, baseUrl) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
    const dataUrl = `data:${mimeType};base64,${base64}`;
    if (provider === 'openai' || provider === 'custom') {
        const url = provider === 'custom'
            ? `${baseUrl}/chat/completions`
            : 'https://api.openai.com/v1/chat/completions';
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), OCR_FETCH_TIMEOUT_MS);
        let resp;
        try {
            resp = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: 'gpt-4o',
                    messages: [
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
        }
        catch (e) {
            if (e.name === 'AbortError')
                throw new Error('Request timed out after 60s');
            throw e;
        }
        finally {
            clearTimeout(timer);
        }
        if (!resp.ok) {
            const rawBody = await resp.text().catch(() => '');
            const truncated = rawBody.slice(0, 500);
            let msg;
            try {
                msg = (_b = (_a = JSON.parse(rawBody)) === null || _a === void 0 ? void 0 : _a.error) === null || _b === void 0 ? void 0 : _b.message;
            }
            catch (_s) { }
            msg = msg || resp.statusText;
            console.error(`[OCR] Provider HTTP ${resp.status} (openai/custom): ${truncated}`);
            if (resp.status === 401)
                throw new Error('Invalid API key');
            if (resp.status === 429)
                throw new Error('Rate limit exceeded');
            throw new Error(msg || `Provider error ${resp.status}`);
        }
        const data = await resp.json();
        const text = ((_e = (_d = (_c = data.choices) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.message) === null || _e === void 0 ? void 0 : _e.content) || '';
        return { parsed: parseOcrResponse(text), rawText: text };
    }
    if (provider === 'gemini') {
        const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), OCR_FETCH_TIMEOUT_MS);
        let resp;
        try {
            resp = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
                body: JSON.stringify({
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
        }
        catch (e) {
            if (e.name === 'AbortError')
                throw new Error('Request timed out after 60s');
            throw e;
        }
        finally {
            clearTimeout(timer);
        }
        if (!resp.ok) {
            const rawBody = await resp.text().catch(() => '');
            const truncated = rawBody.slice(0, 500);
            let msg;
            try {
                msg = (_g = (_f = JSON.parse(rawBody)) === null || _f === void 0 ? void 0 : _f.error) === null || _g === void 0 ? void 0 : _g.message;
            }
            catch (_t) { }
            msg = msg || resp.statusText;
            console.error(`[OCR] Provider HTTP ${resp.status} (gemini): ${truncated}`);
            if (resp.status === 400 && (msg === null || msg === void 0 ? void 0 : msg.includes('API_KEY')))
                throw new Error('Invalid API key');
            if (resp.status === 429)
                throw new Error('Rate limit exceeded');
            throw new Error(msg || `Provider error ${resp.status}`);
        }
        const data = await resp.json();
        const text = ((_m = (_l = (_k = (_j = (_h = data.candidates) === null || _h === void 0 ? void 0 : _h[0]) === null || _j === void 0 ? void 0 : _j.content) === null || _k === void 0 ? void 0 : _k.parts) === null || _l === void 0 ? void 0 : _l[0]) === null || _m === void 0 ? void 0 : _m.text) || '';
        return { parsed: parseOcrResponse(text), rawText: text };
    }
    if (provider === 'claude') {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), OCR_FETCH_TIMEOUT_MS);
        let resp;
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
        }
        catch (e) {
            if (e.name === 'AbortError')
                throw new Error('Request timed out after 60s');
            throw e;
        }
        finally {
            clearTimeout(timer);
        }
        if (!resp.ok) {
            const rawBody = await resp.text().catch(() => '');
            const truncated = rawBody.slice(0, 500);
            let msg;
            try {
                msg = (_p = (_o = JSON.parse(rawBody)) === null || _o === void 0 ? void 0 : _o.error) === null || _p === void 0 ? void 0 : _p.message;
            }
            catch (_u) { }
            msg = msg || resp.statusText;
            console.error(`[OCR] Provider HTTP ${resp.status} (claude): ${truncated}`);
            if (resp.status === 401)
                throw new Error('Invalid API key');
            if (resp.status === 429)
                throw new Error('Rate limit exceeded');
            throw new Error(msg || `Provider error ${resp.status}`);
        }
        const data = await resp.json();
        const text = ((_r = (_q = data.content) === null || _q === void 0 ? void 0 : _q[0]) === null || _r === void 0 ? void 0 : _r.text) || '';
        return { parsed: parseOcrResponse(text), rawText: text };
    }
    throw new Error(`Unknown provider: ${provider}`);
}
function parseOcrResponse(text) {
    const cleaned = text.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match)
        throw new Error('No JSON found in provider response');
    const obj = JSON.parse(match[0]);
    return {
        date: obj.date || null,
        vendor: obj.vendor || null,
        item: obj.item || null,
        type: obj.type || null,
        brutto19: obj.brutto19 != null ? parseFloat(obj.brutto19) : null,
        brutto7: obj.brutto7 != null ? parseFloat(obj.brutto7) : null,
        brutto0: obj.brutto0 != null ? parseFloat(obj.brutto0) : null,
        amount: obj.amount != null ? parseFloat(obj.amount) : null,
    };
}
// ── Background job ────────────────────────────────────────────────────────────
async function runOcrJob(billId, projectId) {
    const jobStart = Date.now();
    let resolvedProvider = null;
    const writeLog = async (status, { fieldsWritten = null, aiResponse = null, errorDetail = null, } = {}) => {
        try {
            await db_1.db.ocrLog.create({
                data: {
                    projectId,
                    billId,
                    provider: resolvedProvider !== null && resolvedProvider !== void 0 ? resolvedProvider : undefined,
                    status,
                    fieldsWritten: fieldsWritten ? JSON.stringify(fieldsWritten) : undefined,
                    aiResponse: aiResponse !== null ? String(aiResponse).slice(0, 2000) : undefined,
                    errorDetail: errorDetail !== null ? String(errorDetail) : undefined,
                },
            });
        }
        catch (logErr) {
            console.error(`[OCR] Failed to write ocr_log for bill ${billId}:`, logErr.message);
        }
    };
    // Detect re-analysis
    const priorBill = await db_1.db.bill.findUnique({
        where: { id: billId },
        select: { ocrStatus: true },
    });
    const isReanalysis = (priorBill === null || priorBill === void 0 ? void 0 : priorBill.ocrStatus) === 'done';
    // 1. Mark pending
    await db_1.db.bill.update({
        where: { id: billId },
        data: { ocrStatus: 'pending' },
    });
    const fail = async (reason, errorType) => {
        await db_1.db.bill.update({
            where: { id: billId },
            data: { ocrStatus: 'failed' },
        });
        const bill = await db_1.db.bill.findUnique({
            where: { id: billId },
            select: { submittedByEmail: true },
        });
        if (bill) {
            await db_1.db.notification.create({
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
            await db_1.db.editLog.create({
                data: {
                    projectId,
                    timestamp: new Date(),
                    user: resolvedProvider ? `AI / ${resolvedProvider}` : 'AI',
                    billId,
                    changes: { _event: 'analysis_failed', reason },
                    source: 'ai',
                },
            });
        }
        catch (_a) { }
    };
    try {
        // 2. Read project OCR settings
        const settingsRows = await db_1.db.projectSettings.findMany({
            where: { projectId },
        });
        const settings = {};
        for (const r of settingsRows) {
            try {
                settings[r.key] = JSON.parse(r.value || 'null');
            }
            catch (_a) {
                settings[r.key] = r.value;
            }
        }
        if (!settings.ocrEnabled) {
            return fail('OCR not enabled for this project', 'ConfigError');
        }
        if (!settings.ocrApiKey) {
            return fail('OCR not configured for this project', 'ConfigError');
        }
        const provider = settings.ocrProvider || 'openai';
        resolvedProvider = provider;
        const apiKey = decryptApiKey(settings.ocrApiKey);
        if (!apiKey) {
            return fail('Could not read API key', 'ConfigError');
        }
        const baseUrl = settings.ocrBaseUrl || null;
        console.log(`[OCR] Bill ${billId} (project ${projectId}): analysis started — provider: ${provider}`);
        // 3. Validate custom base URL
        if (provider === 'custom') {
            if (!baseUrl || !baseUrl.startsWith('https://')) {
                return fail('Custom provider base URL must start with https://', 'ConfigError');
            }
            if (isPrivateUrl(baseUrl)) {
                return fail('Custom provider base URL must not point to a private or reserved address', 'SSRFError');
            }
        }
        // 4. Get first image
        const img = await db_1.db.billImage.findFirst({
            where: { billId },
            orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        });
        if (!img || !img.filePath) {
            return fail('No image attached to this bill', 'InputError');
        }
        const imgBuffer = (0, upload_1.readFileForOCR)(img.filePath);
        if (!imgBuffer) {
            return fail('Image file not found on disk', 'InputError');
        }
        // 5. Read and encode image
        const base64 = imgBuffer.toString('base64');
        const ext = path_1.default.extname(img.filePath).toLowerCase();
        const mimeType = ext === '.png'
            ? 'image/png'
            : ext === '.gif'
                ? 'image/gif'
                : ext === '.webp'
                    ? 'image/webp'
                    : 'image/jpeg';
        // 6. Call AI provider
        const { parsed: extracted, rawText } = await analyseImage(provider, apiKey, base64, mimeType, baseUrl);
        // 7. Get current bill values
        const bill = await db_1.db.bill.findUnique({ where: { id: billId } });
        if (!bill) {
            return fail('Bill not found', 'DBError');
        }
        // Fields eligible for OCR writing
        const fieldChecks = {
            date: () => !!extracted.date && (isReanalysis || !bill.date || bill.date.toISOString().trim() === ''),
            vendor: () => !!extracted.vendor && (isReanalysis || !bill.vendor || bill.vendor.trim() === ''),
            item: () => !!extracted.item && (isReanalysis || !bill.item || bill.item.trim() === ''),
            type: () => !!extracted.type && (isReanalysis || !bill.type || bill.type.trim() === ''),
            brutto19: () => extracted.brutto19 != null &&
                extracted.brutto19 > 0 &&
                (isReanalysis || Number(bill.brutto19) === 0),
            brutto7: () => extracted.brutto7 != null &&
                extracted.brutto7 > 0 &&
                (isReanalysis || Number(bill.brutto7) === 0),
            brutto0: () => extracted.brutto0 != null &&
                extracted.brutto0 > 0 &&
                (isReanalysis || Number(bill.brutto0) === 0),
            amount: () => extracted.amount != null &&
                extracted.amount > 0 &&
                (isReanalysis || Number(bill.grossAmount) === 0),
        };
        const writtenFields = [];
        const skippedFields = [];
        const updates = {};
        for (const [field, check] of Object.entries(fieldChecks)) {
            if (check()) {
                if (field === 'date' && extracted.date) {
                    const d = new Date(extracted.date + 'T00:00:00.000Z');
                    if (!isNaN(d.getTime())) {
                        updates['date'] = d;
                        writtenFields.push(field);
                    }
                }
                else {
                    updates[field] = extracted[field];
                    writtenFields.push(field);
                }
            }
            else if (extracted[field] != null) {
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
            await db_1.db.bill.update({
                where: { id: billId },
                data: updates,
            });
        }
        // 9. Set ocr_status and ocr_fields
        const finalFields = writtenFields.length > 0 ? writtenFields : null;
        await db_1.db.bill.update({
            where: { id: billId },
            data: {
                ocrStatus: 'done',
                ocrFields: finalFields && finalFields.length > 0 ? finalFields : client_1.Prisma.DbNull,
            },
        });
        // 10. Write success log
        await writeLog('done', {
            fieldsWritten: finalFields,
            aiResponse: rawText,
        });
        // 11. Write AI editlog entry
        if (writtenFields.length > 0) {
            const extractedChanges = {};
            for (const f of writtenFields) {
                if (f !== 'amount')
                    extractedChanges[f] = extracted[f];
            }
            if (writtenFields.includes('amount') && extracted.amount != null) {
                extractedChanges.amount = extracted.amount;
            }
            await db_1.db.editLog.create({
                data: {
                    projectId,
                    timestamp: new Date(),
                    user: `AI / ${provider}`,
                    billId,
                    changes: extractedChanges,
                    source: 'ai',
                },
            });
        }
        const elapsed = Date.now() - jobStart;
        const writtenList = writtenFields.length > 0 ? writtenFields.join(', ') : 'none';
        const skippedList = skippedFields.length > 0 ? skippedFields.join(', ') : 'none';
        console.log(`[OCR] Bill ${billId}: wrote ${writtenFields.length} fields [${writtenList}] — ${skippedFields.length} skipped (already filled) [${skippedList}]`);
        console.log(`[OCR] Bill ${billId}: done in ${elapsed}ms — ocr_status=done, ocr_fields=[${finalFields ? finalFields.join(', ') : ''}]`);
    }
    catch (e) {
        const errorType = e.name || 'Error';
        await fail(e.message || 'Unknown error', errorType);
    }
}
