// ============================================================================
// Telegram Bot Message Handlers
// ============================================================================
// Handles incoming Telegram messages: /start, /link, and photo uploads.
// Albums (media groups) are buffered for 1.5s before creating a single bill.
// ============================================================================

import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import TelegramBot from 'node-telegram-bot-api';
import { prisma } from '../db';
import { UPLOADS_DIR } from '../upload';
import { validateAndConsumeLinkCode } from './codes';

// Album buffering: bufferKey -> { messages, timer }
const mediaGroupBuffers = new Map<
  string,
  { messages: TelegramBot.Message[]; timer: ReturnType<typeof setTimeout> }
>();

interface DownloadedPhoto {
  savedName: string;
  origName: string;
}

/**
 * Download a Telegram file to UPLOADS_DIR.
 * Returns { savedName, origName } for the saved file.
 */
export async function downloadTelegramFile(
  bot: TelegramBot,
  fileId: string
): Promise<DownloadedPhoto> {
  const fileInfo = await bot.getFile(fileId);
  const filePath = fileInfo.file_path;
  if (!filePath) {
    throw new Error('File path not available from Telegram');
  }

  // Access the token via the internal options
  const token = (bot as any).token as string;
  const url = `https://api.telegram.org/file/bot${token}/${filePath}`;
  const ext = (path.extname(filePath) || '.jpg').toLowerCase();

  const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error(`File extension not allowed: ${ext}`);
  }

  const savedName = `tg_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;

  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  const destPath = path.join(UPLOADS_DIR, savedName);

  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destPath);
    proto
      .get(url, (res) => {
        res.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve({ savedName, origName: path.basename(filePath) });
        });
      })
      .on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
  });
}

/**
 * Create a draft bill from Telegram photos using Prisma.
 * Assigns default motive and uncategorized category (100% each).
 */
export async function createDraftBill(
  projectId: string,
  userEmail: string,
  photos: DownloadedPhoto[],
  caption: string | null
): Promise<string> {
  const billNumber = `TG-${Date.now()}`;

  const bill = await prisma.bill.create({
    data: {
      projectId,
      submittedByEmail: userEmail,
      billNumber,
      type: 'Kauf',
      vendor: '',
      item: '',
      comment: caption || '',
      status: 'draft',
      date: new Date(),
      telegramCaption: caption || null,
    },
  });

  const billId = bill.id;

  // Assign default motive
  const defaultMotive = await prisma.motive.findFirst({
    where: { projectId, name: 'Default' },
  });
  if (defaultMotive) {
    await prisma.billMotive.create({
      data: {
        billId,
        motiveId: defaultMotive.id,
        percentage: 100,
      },
    });
  }

  // Assign uncategorized category
  const defaultCategory = await prisma.category.findFirst({
    where: { projectId, name: 'Uncategorized' },
  });
  if (defaultCategory) {
    await prisma.billCategory.create({
      data: {
        billId,
        categoryId: defaultCategory.id,
        percentage: 100,
      },
    });
  }

  // Attach images
  for (let i = 0; i < photos.length; i++) {
    await prisma.billImage.create({
      data: {
        billId,
        filename: photos[i].origName,
        filePath: photos[i].savedName,
        sortOrder: i,
      },
    });
  }

  return billId;
}

/**
 * Return the full URL for a bill detail page, or null if NEXTAUTH_URL is not set.
 */
export function formatBillLink(billId: string): string | null {
  const base = process.env.NEXTAUTH_URL;
  if (!base) return null;
  return `${base}/bills/${billId}`;
}

/**
 * Send an OCR follow-up message after analysis completes.
 * Reads bill.ocrStatus and ocrFields from the DB and formats a result message.
 */
async function sendOcrFollowUp(
  bot: TelegramBot,
  chatId: number,
  billId: string
): Promise<void> {
  const bill = await prisma.bill.findUnique({
    where: { id: billId },
    select: {
      ocrStatus: true,
      ocrFields: true,
      vendor: true,
      date: true,
      item: true,
      type: true,
      brutto19: true,
      brutto7: true,
      brutto0: true,
      grossAmount: true,
    },
  });

  if (!bill) return;

  let message: string;

  if (bill.ocrStatus === 'done') {
    const writtenFields: string[] = Array.isArray(bill.ocrFields)
      ? (bill.ocrFields as string[])
      : [];

    const lines: string[] = [];

    for (const field of writtenFields) {
      switch (field) {
        case 'vendor':
          if (bill.vendor) lines.push(`Vendor: ${bill.vendor}`);
          break;
        case 'date':
          if (bill.date) {
            const d = new Date(bill.date);
            const dd = String(d.getUTCDate()).padStart(2, '0');
            const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
            const yyyy = d.getUTCFullYear();
            lines.push(`Date: ${dd}.${mm}.${yyyy}`);
          }
          break;
        case 'item':
          if (bill.item) lines.push(`Item: ${bill.item}`);
          break;
        case 'type':
          if (bill.type) lines.push(`Type: ${bill.type}`);
          break;
        case 'brutto19':
          if (bill.brutto19 != null) lines.push(`19% VAT: ${Number(bill.brutto19).toFixed(2)} €`);
          break;
        case 'brutto7':
          if (bill.brutto7 != null) lines.push(`7% VAT: ${Number(bill.brutto7).toFixed(2)} €`);
          break;
        case 'brutto0':
          if (bill.brutto0 != null) lines.push(`VAT-exempt: ${Number(bill.brutto0).toFixed(2)} €`);
          break;
        case 'amount':
          if (bill.grossAmount != null) lines.push(`Amount: ${Number(bill.grossAmount).toFixed(2)} €`);
          break;
      }
    }

    if (lines.length > 0) {
      message = `✅ Analysis complete:\n${lines.join('\n')}`;
    } else {
      message = '✅ Analysis complete — no fields could be extracted. Please fill in manually.';
    }
  } else if (bill.ocrStatus === 'failed') {
    const ocrLog = await prisma.ocrLog.findFirst({
      where: { billId },
      orderBy: { timestamp: 'desc' },
      select: { errorDetail: true },
    });
    const rawReason = ocrLog?.errorDetail || 'Unknown error';
    // Sanitize: only expose known safe error categories to the user, not internal details
    const SAFE_REASONS: Record<string, string> = {
      'Invalid API key': 'Invalid API key',
      'Rate limit exceeded': 'Rate limit exceeded',
      'Request timed out after 60s': 'Request timed out',
      'No image attached to this bill': 'No image found on bill',
      'Image file not found on disk': 'Image file unavailable',
      'OCR not enabled for this project': 'OCR not enabled',
      'OCR not configured for this project': 'OCR not configured',
      'Could not read API key': 'API key configuration error',
    };
    const reason = SAFE_REASONS[rawReason] ?? 'Analysis could not be completed';
    message = `⚠️ Analysis failed: ${reason}`;
  } else {
    return;
  }

  const link = formatBillLink(billId);
  if (link) {
    message += `\n\n🔗 View bill: ${link}`;
  }

  bot.sendMessage(chatId, message).catch(() => {});
}

/**
 * Get project settings as a key/value record.
 */
async function getProjectSettings(projectId: string): Promise<Record<string, unknown>> {
  const rows = await prisma.projectSettings.findMany({
    where: { projectId },
  });
  const settings: Record<string, unknown> = {};
  for (const row of rows) {
    try {
      settings[row.key] = JSON.parse(row.value || 'null');
    } catch {
      settings[row.key] = row.value;
    }
  }
  return settings;
}

/**
 * Trigger OCR fire-and-forget if enabled for the project.
 * After OCR completes (success or failure), sends a follow-up message to the user.
 */
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
    runOcrJob(billId, projectId)
      .then(() => sendOcrFollowUp(bot, chatId, billId))
      .catch((e: Error) => {
        console.error(`[OCR] Unhandled error for bill #${billId}:`, e.message);
        sendOcrFollowUp(bot, chatId, billId);
      });
  } catch (e) {
    console.error('[Telegram] Failed to import OCR module:', (e as Error).message);
  }
}

/**
 * Process a buffered album (media group) — download all photos and create one bill.
 */
async function processMediaGroup(
  bufferKey: string,
  projectId: string,
  userEmail: string,
  bot: TelegramBot
): Promise<void> {
  const buf = mediaGroupBuffers.get(bufferKey);
  if (!buf) return;
  mediaGroupBuffers.delete(bufferKey);

  const photos: DownloadedPhoto[] = [];
  for (const msg of buf.messages) {
    const photo = msg.photo![msg.photo!.length - 1];
    try {
      const p = await downloadTelegramFile(bot, photo.file_id);
      photos.push(p);
    } catch (e) {
      console.error(`[TG ${projectId}] Error downloading photo:`, (e as Error).message);
    }
  }

  if (photos.length === 0) return;

  const caption = buf.messages[0].caption || null;
  const billId = await createDraftBill(projectId, userEmail, photos, caption);
  console.log(
    `[TG ${projectId}] Created draft bill #${billId} with ${photos.length} image(s) for ${userEmail}`
  );

  const settings = await getProjectSettings(projectId);
  const chatId = buf.messages[0].chat.id;

  await maybeRunOcr(billId, projectId, bot, chatId);

  const ocrNote = settings.ocrEnabled ? '\nBeleganalyse läuft im Hintergrund.\nBitte in SetCash vervollständigen.' : '\nBitte in SetCash vervollständigen.';
  const link = formatBillLink(billId);
  const linkSuffix = link ? `\n\n🔗 View bill: ${link}` : '';
  bot
    .sendMessage(
      chatId,
      `✓ ${photos.length} Foto(s) empfangen – Beleg als Entwurf gespeichert.${ocrNote}${linkSuffix}`
    )
    .catch(() => {});
}

/**
 * Process a single photo message.
 */
async function processSinglePhoto(
  bot: TelegramBot,
  msg: TelegramBot.Message,
  projectId: string,
  userEmail: string
): Promise<void> {
  const photo = msg.photo![msg.photo!.length - 1];
  let downloaded: DownloadedPhoto;

  try {
    downloaded = await downloadTelegramFile(bot, photo.file_id);
  } catch (e) {
    console.error(`[TG ${projectId}] Error downloading photo:`, (e as Error).message);
    bot
      .sendMessage(msg.chat.id, 'Fehler beim Speichern des Fotos. Bitte erneut versuchen.')
      .catch(() => {});
    return;
  }

  const caption = msg.caption || null;
  const billId = await createDraftBill(projectId, userEmail, [downloaded], caption);
  console.log(`[TG ${projectId}] Created draft bill #${billId} for ${userEmail}`);

  const settings = await getProjectSettings(projectId);

  await maybeRunOcr(billId, projectId, bot, msg.chat.id);

  const ocrNote = settings.ocrEnabled ? '\nBeleganalyse läuft im Hintergrund.\nBitte in SetCash vervollständigen.' : '\nBitte in SetCash vervollständigen.';
  const link = formatBillLink(billId);
  const linkSuffix = link ? `\n\n🔗 View bill: ${link}` : '';
  bot
    .sendMessage(
      msg.chat.id,
      `✓ Foto empfangen – Beleg als Entwurf gespeichert.${ocrNote}${linkSuffix}`
    )
    .catch(() => {});
}

/**
 * Shared helper: validate a link code and upsert the TelegramLink record.
 * Used by both /start <payload> and /link <code> handlers.
 */
async function performLink(
  bot: TelegramBot,
  msg: TelegramBot.Message,
  projectId: string,
  code: string
): Promise<void> {
  const result = await validateAndConsumeLinkCode(code, projectId);
  if (!result) {
    bot.sendMessage(msg.chat.id, 'Ungültiger oder abgelaufener Code.').catch(() => {});
    return;
  }

  const telegramUserId = String(msg.from!.id);
  try {
    await prisma.telegramLink.upsert({
      where: {
        projectId_telegramUserId: { projectId, telegramUserId },
      },
      update: { userEmail: result.userEmail },
      create: { projectId, telegramUserId, userEmail: result.userEmail },
    });
    bot
      .sendMessage(
        msg.chat.id,
        `✓ Verknüpft mit ${result.userEmail}!\nSende jetzt einfach Fotos deiner Belege – sie werden automatisch als Entwurf gespeichert.`
      )
      .catch(() => {});
  } catch (e) {
    console.error(`[TG ${projectId}] Link error:`, (e as Error).message);
    bot
      .sendMessage(msg.chat.id, 'Fehler beim Verknüpfen. Bitte erneut versuchen.')
      .catch(() => {});
  }
}

/**
 * Main message handler — routes incoming Telegram messages.
 */
export async function handleMessage(
  bot: TelegramBot,
  msg: TelegramBot.Message,
  projectId: string
): Promise<void> {
  // Handle /start [payload]
  if (msg.text && msg.text.startsWith('/start')) {
    const payload = msg.text.trim().split(/\s+/)[1];
    if (payload) {
      // Deep link invite: /start CODE — same upsert logic as /link
      await performLink(bot, msg, projectId, payload.toUpperCase());
    } else {
      // Plain /start — show welcome message
      bot
        .sendMessage(
          msg.chat.id,
          'Willkommen bei SetCash!\nSende /link <Code> um deinen Account zu verknüpfen.\nDen Code findest du in SetCash unter "Telegram verknüpfen".'
        )
        .catch(() => {});
    }
    return;
  }

  // Handle /link <code>
  if (msg.text && msg.text.startsWith('/link ')) {
    const code = msg.text.split(' ')[1]?.trim();
    if (!code) {
      bot.sendMessage(msg.chat.id, 'Verwendung: /link <Code>').catch(() => {});
      return;
    }

    await performLink(bot, msg, projectId, code);
    return;
  }

  // Handle photos
  if (msg.photo) {
    const telegramUserId = String(msg.from!.id);
    const link = await prisma.telegramLink.findFirst({
      where: { projectId, telegramUserId },
      select: { userEmail: true },
    });

    if (!link) {
      bot
        .sendMessage(
          msg.chat.id,
          'Dein Telegram-Account ist noch nicht verknüpft.\nSende /link <Code> – den Code findest du in SetCash.'
        )
        .catch(() => {});
      return;
    }

    if (msg.media_group_id) {
      // Album: buffer and wait
      const bufferKey = `${projectId}:${msg.media_group_id}`;
      if (!mediaGroupBuffers.has(bufferKey)) {
        mediaGroupBuffers.set(bufferKey, { messages: [], timer: null! });
      }
      const buf = mediaGroupBuffers.get(bufferKey)!;
      buf.messages.push(msg);
      if (buf.timer) clearTimeout(buf.timer);
      buf.timer = setTimeout(() => {
        processMediaGroup(bufferKey, projectId, link.userEmail, bot).catch((e) => {
          mediaGroupBuffers.delete(bufferKey);
          console.error('[TG] processMediaGroup failed for', bufferKey, e);
        });
      }, 1500);
    } else {
      await processSinglePhoto(bot, msg, projectId, link.userEmail);
    }
  }
}
