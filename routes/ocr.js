const router = require("express").Router();
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const db = require("../db");
const DATA_DIR = db.DATA_DIR;
const { ensureAuth, ensureProjectAccess } = require("../middleware");

// ── Encryption helpers for API key at rest ──────────────────────────────────
// Uses AES-256-GCM. Key is derived from SESSION_SECRET via SHA-256.
// Stored format: <iv_hex>:<authTag_hex>:<ciphertext_hex>

// BUG-4: Warn loudly if SESSION_SECRET is not set or uses the insecure default
const DEFAULT_SECRET = "change-this-in-production";
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === DEFAULT_SECRET) {
  console.warn(
    "[OCR] WARNING: SESSION_SECRET is not set or uses the default value. " +
    "API keys stored at rest are encrypted with a publicly known key. " +
    "Set a strong SESSION_SECRET environment variable before storing API keys."
  );
}

function getEncryptionKey() {
  const secret = process.env.SESSION_SECRET || DEFAULT_SECRET;
  return crypto.createHash("sha256").update(secret).digest(); // 32 bytes
}

function encryptApiKey(plaintext) {
  if (!plaintext) return "";
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

function decryptApiKey(stored) {
  if (!stored || !stored.includes(":")) return stored; // legacy plaintext fallback
  try {
    const key = getEncryptionKey();
    const [ivHex, authTagHex, ciphertextHex] = stored.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const ciphertext = Buffer.from(ciphertextHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(ciphertext) + decipher.final("utf8");
  } catch (e) {
    console.error("[OCR] Failed to decrypt API key:", e.message);
    return null;
  }
}

function maskApiKey(stored) {
  if (!stored) return null;
  // Decrypt to get the plaintext, then mask all but last 4 chars
  const plain = decryptApiKey(stored);
  if (!plain || plain.length < 4) return "...";
  return `...${plain.slice(-4)}`;
}


// ── SSRF protection ──────────────────────────────────────────────────────────

// BUG-3: Reject URLs that point to private/reserved IP ranges or localhost
function isPrivateUrl(urlString) {
  let parsed;
  try {
    parsed = new URL(urlString);
  } catch {
    return true; // unparseable URL → reject
  }
  const hostname = parsed.hostname.toLowerCase();
  // Reject localhost and loopback
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") return true;
  // Reject .local mDNS hostnames
  if (hostname.endsWith(".local")) return true;
  // Reject link-local (169.254.x.x) and AWS metadata
  if (/^169\.254\./.test(hostname)) return true;
  // Reject private RFC1918 ranges
  if (/^10\./.test(hostname)) return true;
  if (/^192\.168\./.test(hostname)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return true;
  // Reject unspecified
  if (hostname === "0.0.0.0" || hostname === "[::]") return true;
  return false;
}

// ── Provider: call AI vision API ─────────────────────────────────────────────

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

async function analyseImage(provider, apiKey, base64, mimeType, baseUrl) {
  const dataUrl = `data:${mimeType};base64,${base64}`;

  if (provider === "openai" || provider === "custom") {
    const url = provider === "custom"
      ? `${baseUrl}/chat/completions`
      : "https://api.openai.com/v1/chat/completions";
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: OCR_PROMPT },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        max_tokens: 512,
      }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      const msg = err.error?.message || resp.statusText;
      if (resp.status === 401) throw new Error("Invalid API key");
      if (resp.status === 429) throw new Error("Rate limit exceeded");
      throw new Error(msg || `Provider error ${resp.status}`);
    }
    const data = await resp.json();
    const text = data.choices?.[0]?.message?.content || "";
    return parseOcrResponse(text);
  }

  if (provider === "gemini") {
    // BUG-5: Use header-based auth to avoid API key appearing in server logs/URLs
    const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
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
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      const msg = err.error?.message || resp.statusText;
      if (resp.status === 400 && msg.includes("API_KEY")) throw new Error("Invalid API key");
      if (resp.status === 429) throw new Error("Rate limit exceeded");
      throw new Error(msg || `Provider error ${resp.status}`);
    }
    const data = await resp.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return parseOcrResponse(text);
  }

  if (provider === "claude") {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 512,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mimeType, data: base64 },
              },
              { type: "text", text: OCR_PROMPT },
            ],
          },
        ],
      }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      const msg = err.error?.message || resp.statusText;
      if (resp.status === 401) throw new Error("Invalid API key");
      if (resp.status === 429) throw new Error("Rate limit exceeded");
      throw new Error(msg || `Provider error ${resp.status}`);
    }
    const data = await resp.json();
    const text = data.content?.[0]?.text || "";
    return parseOcrResponse(text);
  }

  throw new Error(`Unknown provider: ${provider}`);
}

function parseOcrResponse(text) {
  // Strip markdown code fences if present
  const cleaned = text.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
  // Extract first JSON object
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON found in provider response");
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
  // 1. Mark pending
  db.prepare("UPDATE bills SET ocr_status = 'pending' WHERE id = ?").run(billId);

  // Helper: mark failed and notify
  const fail = (reason) => {
    db.prepare("UPDATE bills SET ocr_status = 'failed' WHERE id = ?").run(billId);
    const bill = db.prepare("SELECT email FROM bills WHERE id = ?").get(billId);
    if (bill) {
      db.prepare(
        "INSERT INTO notifications (user_email, type, message, project_id) VALUES (?, 'ocr_failed', ?, ?)"
      ).run(bill.email, `Bill analysis failed: ${reason}`, projectId);
    }
    console.error(`[OCR] Bill #${billId} failed: ${reason}`);
  };

  try {
    // 2. Read project OCR settings
    const rows = db
      .prepare("SELECT key, value FROM project_settings WHERE project_id = ?")
      .all(projectId);
    const settings = {};
    for (const r of rows) {
      try { settings[r.key] = JSON.parse(r.value); } catch { settings[r.key] = r.value; }
    }

    if (!settings.ocrEnabled) return fail("OCR not enabled for this project");
    if (!settings.ocrApiKey) return fail("OCR not configured for this project");

    const provider = settings.ocrProvider || "openai";
    const apiKey = decryptApiKey(settings.ocrApiKey);
    if (!apiKey) return fail("Could not read API key");

    const baseUrl = settings.ocrBaseUrl || null;

    // BUG-3: Validate custom base URL — must be https:// and not a private/reserved address
    if (provider === "custom") {
      if (!baseUrl || !baseUrl.startsWith("https://")) {
        return fail("Custom provider base URL must start with https://");
      }
      if (isPrivateUrl(baseUrl)) {
        return fail("Custom provider base URL must not point to a private or reserved address");
      }
    }

    // 3. Get first image
    const img = db
      .prepare(
        "SELECT file FROM bill_images WHERE bill_id = ? ORDER BY sort_order, id LIMIT 1"
      )
      .get(billId);
    if (!img || !img.file) return fail("No image attached to this bill");

    const imgPath = path.join(DATA_DIR, "uploads", img.file);
    if (!fs.existsSync(imgPath)) return fail("Image file not found on disk");

    // 4. Read and encode image
    const imgBuffer = fs.readFileSync(imgPath);
    const base64 = imgBuffer.toString("base64");
    const ext = path.extname(img.file).toLowerCase();
    const mimeType =
      ext === ".png" ? "image/png" :
      ext === ".gif" ? "image/gif" :
      ext === ".webp" ? "image/webp" :
      "image/jpeg";

    // 5. Call AI provider
    const extracted = await analyseImage(provider, apiKey, base64, mimeType, baseUrl);

    // 6. Get current bill values to avoid overwriting user data
    const bill = db.prepare("SELECT * FROM bills WHERE id = ?").get(billId);
    if (!bill) return fail("Bill not found");

    // Fields eligible for OCR writing (only write if currently empty/zero)
    const fieldChecks = {
      date: () => extracted.date && (!bill.date || bill.date.trim() === ""),
      vendor: () => extracted.vendor && (!bill.vendor || bill.vendor.trim() === ""),
      item: () => extracted.item && (!bill.item || bill.item.trim() === ""),
      type: () => extracted.type && (!bill.type || bill.type.trim() === ""),
      brutto19: () => extracted.brutto19 != null && extracted.brutto19 > 0 && (bill.brutto19 || 0) === 0,
      brutto7: () => extracted.brutto7 != null && extracted.brutto7 > 0 && (bill.brutto7 || 0) === 0,
      brutto0: () => extracted.brutto0 != null && extracted.brutto0 > 0 && (bill.brutto0 || 0) === 0,
      amount: () => extracted.amount != null && extracted.amount > 0 && (bill.amount || 0) === 0,
    };

    const writtenFields = [];
    const updates = [];
    const params = [];

    for (const [field, check] of Object.entries(fieldChecks)) {
      if (check()) {
        updates.push(`${field} = ?`);
        params.push(extracted[field]);
        writtenFields.push(field);
      }
    }

    // 7. Write fields and recalculate totals if amounts changed
    if (writtenFields.length > 0) {
      const amountFields = ["brutto19", "brutto7", "brutto0"];
      const anyAmountWritten = writtenFields.some((f) => amountFields.includes(f));
      // BUG-2: Only recalculate and write amount/netto_amount when the user does not already
      // have a manually entered amount. This prevents overwriting user data.
      if (anyAmountWritten && (bill.amount || 0) === 0) {
        const newB19 = writtenFields.includes("brutto19") ? extracted.brutto19 : (bill.brutto19 || 0);
        const newB7 = writtenFields.includes("brutto7") ? extracted.brutto7 : (bill.brutto7 || 0);
        const newB0 = writtenFields.includes("brutto0") ? extracted.brutto0 : (bill.brutto0 || 0);
        const recalcAmount = (newB19 || 0) + (newB7 || 0) + (newB0 || 0);
        updates.push("amount = ?");
        params.push(recalcAmount);
        updates.push("netto_amount = ?");
        params.push((newB19 || 0) / 1.19 + (newB7 || 0) / 1.07 + (newB0 || 0));
        writtenFields.push("amount");
      }

      params.push(billId);
      db.prepare(`UPDATE bills SET ${updates.join(", ")} WHERE id = ?`).run(...params);
    }

    // 8. Set ocr_status and ocr_fields
    db.prepare("UPDATE bills SET ocr_status = 'done', ocr_fields = ? WHERE id = ?").run(
      writtenFields.length > 0 ? JSON.stringify(writtenFields) : null,
      billId
    );

    console.log(
      `[OCR] Bill #${billId} done. Fields written: ${writtenFields.join(", ") || "none"}`
    );
  } catch (e) {
    fail(e.message || "Unknown error");
  }
}


// ── HTTP trigger endpoint ─────────────────────────────────────────────────────

// BUG-6: Add ensureAuth before ensureProjectAccess per spec (defence-in-depth)
router.post("/api/bills/:id/analyse", ensureAuth, ensureProjectAccess, (req, res) => {
  const projectId = req.user.currentProjectId;

  // BUG-10: Validate bill ID param
  const billId = parseInt(req.params.id, 10);
  if (!billId || isNaN(billId) || billId <= 0) {
    return res.status(400).json({ error: "Invalid bill ID" });
  }

  // Verify bill belongs to this project
  const bill = db
    .prepare("SELECT id, ocr_status FROM bills WHERE id = ? AND project_id = ?")
    .get(billId, projectId);
  if (!bill) return res.status(404).json({ error: "Bill not found" });

  // BUG-7: Prevent duplicate concurrent jobs
  if (bill.ocr_status === "pending") {
    return res.status(409).json({ error: "Analysis already in progress for this bill" });
  }

  // Fire and forget
  runOcrJob(billId, projectId).catch((e) =>
    console.error(`[OCR] Unhandled error for bill #${billId}:`, e.message)
  );

  res.status(202).json({ ok: true, message: "Analysis started" });
});

module.exports = Object.assign(router, {
  runOcrJob,
  analyseImage,
  encryptApiKey,
  decryptApiKey,
  maskApiKey,
  isPrivateUrl,
});
