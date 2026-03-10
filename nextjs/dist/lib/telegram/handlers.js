"use strict";
// ============================================================================
// Telegram Bot Message Handlers
// ============================================================================
// Handles incoming Telegram messages: /start, /link, and photo uploads.
// Albums (media groups) are buffered for 1.5s before creating a single bill.
// ============================================================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadTelegramFile = downloadTelegramFile;
exports.createDraftBill = createDraftBill;
exports.handleMessage = handleMessage;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const https_1 = __importDefault(require("https"));
const http_1 = __importDefault(require("http"));
const db_1 = require("../db");
const upload_1 = require("../upload");
const codes_1 = require("./codes");
// Album buffering: bufferKey -> { messages, timer }
const mediaGroupBuffers = new Map();
/**
 * Download a Telegram file to UPLOADS_DIR.
 * Returns { savedName, origName } for the saved file.
 */
async function downloadTelegramFile(bot, fileId) {
    const fileInfo = await bot.getFile(fileId);
    const filePath = fileInfo.file_path;
    if (!filePath) {
        throw new Error('File path not available from Telegram');
    }
    // Access the token via the internal options
    const token = bot.token;
    const url = `https://api.telegram.org/file/bot${token}/${filePath}`;
    const ext = path_1.default.extname(filePath) || '.jpg';
    const savedName = `tg_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
    if (!fs_1.default.existsSync(upload_1.UPLOADS_DIR)) {
        fs_1.default.mkdirSync(upload_1.UPLOADS_DIR, { recursive: true });
    }
    const destPath = path_1.default.join(upload_1.UPLOADS_DIR, savedName);
    return new Promise((resolve, reject) => {
        const proto = url.startsWith('https') ? https_1.default : http_1.default;
        const file = fs_1.default.createWriteStream(destPath);
        proto
            .get(url, (res) => {
            res.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve({ savedName, origName: path_1.default.basename(filePath) });
            });
        })
            .on('error', (err) => {
            fs_1.default.unlink(destPath, () => { });
            reject(err);
        });
    });
}
/**
 * Create a draft bill from Telegram photos using Prisma.
 * Assigns default motive and uncategorized category (100% each).
 */
async function createDraftBill(projectId, userEmail, photos, caption) {
    const billNumber = `TG-${Date.now()}`;
    const bill = await db_1.prisma.bill.create({
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
    const defaultMotive = await db_1.prisma.motive.findFirst({
        where: { projectId, name: 'Default' },
    });
    if (defaultMotive) {
        await db_1.prisma.billMotive.create({
            data: {
                billId,
                motiveId: defaultMotive.id,
                percentage: 100,
            },
        });
    }
    // Assign uncategorized category
    const defaultCategory = await db_1.prisma.category.findFirst({
        where: { projectId, name: 'Uncategorized' },
    });
    if (defaultCategory) {
        await db_1.prisma.billCategory.create({
            data: {
                billId,
                categoryId: defaultCategory.id,
                percentage: 100,
            },
        });
    }
    // Attach images
    for (let i = 0; i < photos.length; i++) {
        await db_1.prisma.billImage.create({
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
async function getProjectSettings(projectId) {
    const rows = await db_1.prisma.projectSettings.findMany({
        where: { projectId },
    });
    const settings = {};
    for (const row of rows) {
        try {
            settings[row.key] = JSON.parse(row.value || 'null');
        }
        catch (_a) {
            settings[row.key] = row.value;
        }
    }
    return settings;
}
/**
 * Trigger OCR fire-and-forget if enabled for the project.
 */
async function maybeRunOcr(billId, projectId) {
    const settings = await getProjectSettings(projectId);
    if (!settings.ocrEnabled)
        return;
    try {
        const { runOcrJob } = await Promise.resolve().then(() => __importStar(require('../ocr')));
        runOcrJob(billId, projectId).catch((e) => console.error(`[OCR] Unhandled error for bill #${billId}:`, e.message));
    }
    catch (e) {
        console.error('[Telegram] Failed to import OCR module:', e.message);
    }
}
/**
 * Process a buffered album (media group) — download all photos and create one bill.
 */
async function processMediaGroup(bufferKey, projectId, userEmail, bot) {
    const buf = mediaGroupBuffers.get(bufferKey);
    if (!buf)
        return;
    mediaGroupBuffers.delete(bufferKey);
    const photos = [];
    for (const msg of buf.messages) {
        const photo = msg.photo[msg.photo.length - 1];
        try {
            const p = await downloadTelegramFile(bot, photo.file_id);
            photos.push(p);
        }
        catch (e) {
            console.error(`[TG ${projectId}] Error downloading photo:`, e.message);
        }
    }
    if (photos.length === 0)
        return;
    const caption = buf.messages[0].caption || null;
    const billId = await createDraftBill(projectId, userEmail, photos, caption);
    console.log(`[TG ${projectId}] Created draft bill #${billId} with ${photos.length} image(s) for ${userEmail}`);
    await maybeRunOcr(billId, projectId);
    const settings = await getProjectSettings(projectId);
    const ocrNote = settings.ocrEnabled ? '\nBeleganalyse läuft im Hintergrund.' : '';
    const chatId = buf.messages[0].chat.id;
    bot
        .sendMessage(chatId, `✓ ${photos.length} Foto(s) empfangen – Beleg als Entwurf gespeichert.\nBitte in vBudget vervollständigen.${ocrNote}`)
        .catch(() => { });
}
/**
 * Process a single photo message.
 */
async function processSinglePhoto(bot, msg, projectId, userEmail) {
    const photo = msg.photo[msg.photo.length - 1];
    let downloaded;
    try {
        downloaded = await downloadTelegramFile(bot, photo.file_id);
    }
    catch (e) {
        console.error(`[TG ${projectId}] Error downloading photo:`, e.message);
        bot
            .sendMessage(msg.chat.id, 'Fehler beim Speichern des Fotos. Bitte erneut versuchen.')
            .catch(() => { });
        return;
    }
    const caption = msg.caption || null;
    const billId = await createDraftBill(projectId, userEmail, [downloaded], caption);
    console.log(`[TG ${projectId}] Created draft bill #${billId} for ${userEmail}`);
    await maybeRunOcr(billId, projectId);
    const settings = await getProjectSettings(projectId);
    const ocrNote = settings.ocrEnabled ? '\nBeleganalyse läuft im Hintergrund.' : '';
    bot
        .sendMessage(msg.chat.id, `✓ Foto empfangen – Beleg als Entwurf gespeichert.\nBitte in vBudget vervollständigen.${ocrNote}`)
        .catch(() => { });
}
/**
 * Main message handler — routes incoming Telegram messages.
 */
async function handleMessage(bot, msg, projectId) {
    var _a;
    // Handle /start
    if (msg.text && msg.text.startsWith('/start')) {
        bot
            .sendMessage(msg.chat.id, 'Willkommen bei vBudget!\nSende /link <Code> um deinen Account zu verknüpfen.\nDen Code findest du in vBudget unter "Telegram verknüpfen".')
            .catch(() => { });
        return;
    }
    // Handle /link <code>
    if (msg.text && msg.text.startsWith('/link ')) {
        const code = (_a = msg.text.split(' ')[1]) === null || _a === void 0 ? void 0 : _a.trim();
        if (!code) {
            bot.sendMessage(msg.chat.id, 'Verwendung: /link <Code>').catch(() => { });
            return;
        }
        const result = await (0, codes_1.validateAndConsumeLinkCode)(code, projectId);
        if (!result) {
            bot.sendMessage(msg.chat.id, 'Ungültiger oder abgelaufener Code.').catch(() => { });
            return;
        }
        const telegramUserId = String(msg.from.id);
        try {
            await db_1.prisma.telegramLink.upsert({
                where: {
                    projectId_telegramUserId: { projectId, telegramUserId },
                },
                update: { userEmail: result.userEmail },
                create: { projectId, telegramUserId, userEmail: result.userEmail },
            });
            bot
                .sendMessage(msg.chat.id, `✓ Verknüpft mit ${result.userEmail}!\nSende jetzt einfach Fotos deiner Belege – sie werden automatisch als Entwurf gespeichert.`)
                .catch(() => { });
        }
        catch (e) {
            console.error(`[TG ${projectId}] Link error:`, e.message);
            bot
                .sendMessage(msg.chat.id, 'Fehler beim Verknüpfen. Bitte erneut versuchen.')
                .catch(() => { });
        }
        return;
    }
    // Handle photos
    if (msg.photo) {
        const telegramUserId = String(msg.from.id);
        const link = await db_1.prisma.telegramLink.findFirst({
            where: { projectId, telegramUserId },
            select: { userEmail: true },
        });
        if (!link) {
            bot
                .sendMessage(msg.chat.id, 'Dein Telegram-Account ist noch nicht verknüpft.\nSende /link <Code> – den Code findest du in vBudget.')
                .catch(() => { });
            return;
        }
        if (msg.media_group_id) {
            // Album: buffer and wait
            const bufferKey = `${projectId}:${msg.media_group_id}`;
            if (!mediaGroupBuffers.has(bufferKey)) {
                mediaGroupBuffers.set(bufferKey, { messages: [], timer: null });
            }
            const buf = mediaGroupBuffers.get(bufferKey);
            buf.messages.push(msg);
            if (buf.timer)
                clearTimeout(buf.timer);
            buf.timer = setTimeout(() => processMediaGroup(bufferKey, projectId, link.userEmail, bot), 1500);
        }
        else {
            await processSinglePhoto(bot, msg, projectId, link.userEmail);
        }
    }
}
