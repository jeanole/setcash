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
  const ext = path.extname(filePath) || '.jpg';
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
 */
async function maybeRunOcr(billId: string, projectId: string): Promise<void> {
  const settings = await getProjectSettings(projectId);
  if (!settings.ocrEnabled) return;

  try {
    const { runOcrJob } = await import('../ocr');
    runOcrJob(billId, projectId).catch((e: Error) =>
      console.error(`[OCR] Unhandled error for bill #${billId}:`, e.message)
    );
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

  await maybeRunOcr(billId, projectId);

  const settings = await getProjectSettings(projectId);
  const ocrNote = settings.ocrEnabled ? '\nBeleganalyse läuft im Hintergrund.' : '';
  const chatId = buf.messages[0].chat.id;
  bot
    .sendMessage(
      chatId,
      `✓ ${photos.length} Foto(s) empfangen – Beleg als Entwurf gespeichert.\nBitte in SetCash vervollständigen.${ocrNote}`
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

  await maybeRunOcr(billId, projectId);

  const settings = await getProjectSettings(projectId);
  const ocrNote = settings.ocrEnabled ? '\nBeleganalyse läuft im Hintergrund.' : '';
  bot
    .sendMessage(
      msg.chat.id,
      `✓ Foto empfangen – Beleg als Entwurf gespeichert.\nBitte in SetCash vervollständigen.${ocrNote}`
    )
    .catch(() => {});
}

/**
 * Main message handler — routes incoming Telegram messages.
 */
export async function handleMessage(
  bot: TelegramBot,
  msg: TelegramBot.Message,
  projectId: string
): Promise<void> {
  // Handle /start
  if (msg.text && msg.text.startsWith('/start')) {
    bot
      .sendMessage(
        msg.chat.id,
        'Willkommen bei SetCash!\nSende /link <Code> um deinen Account zu verknüpfen.\nDen Code findest du in SetCash unter "Telegram verknüpfen".'
      )
      .catch(() => {});
    return;
  }

  // Handle /link <code>
  if (msg.text && msg.text.startsWith('/link ')) {
    const code = msg.text.split(' ')[1]?.trim();
    if (!code) {
      bot.sendMessage(msg.chat.id, 'Verwendung: /link <Code>').catch(() => {});
      return;
    }

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
      buf.timer = setTimeout(
        () => processMediaGroup(bufferKey, projectId, link.userEmail, bot),
        1500
      );
    } else {
      await processSinglePhoto(bot, msg, projectId, link.userEmail);
    }
  }
}
