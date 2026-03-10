"use strict";
// ============================================================================
// Telegram Bot Instance Management
// ============================================================================
// Manages per-project bot instances. Uses globalThis to survive Next.js HMR.
// ============================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.startProjectBot = startProjectBot;
exports.stopProjectBot = stopProjectBot;
exports.initAllBots = initAllBots;
exports.isBotRunning = isBotRunning;
const node_telegram_bot_api_1 = __importDefault(require("node-telegram-bot-api"));
const db_1 = require("../db");
const encryption_1 = require("./encryption");
const handlers_1 = require("./handlers");
// Use globalThis to survive Next.js HMR in development
const activeBots = (_a = globalThis.__activeBots) !== null && _a !== void 0 ? _a : (globalThis.__activeBots = new Map());
/**
 * Start a Telegram bot for a specific project.
 * Reads settings from DB, decrypts token, creates bot and registers handlers.
 */
async function startProjectBot(projectId) {
    // Stop existing bot if running
    if (activeBots.has(projectId)) {
        await stopProjectBot(projectId);
    }
    // Read settings from DB
    const settingsRows = await db_1.prisma.projectSettings.findMany({
        where: { projectId },
    });
    const settings = {};
    for (const row of settingsRows) {
        try {
            settings[row.key] = JSON.parse(row.value || 'null');
        }
        catch (_a) {
            settings[row.key] = row.value;
        }
    }
    if (!settings.telegramEnabled || !settings.telegramBotToken) {
        console.log(`[TG ${projectId}] Telegram not enabled or no token configured`);
        return;
    }
    const encryptedToken = settings.telegramBotToken;
    const token = (0, encryption_1.decrypt)(encryptedToken);
    if (!token) {
        console.error(`[TG ${projectId}] Failed to decrypt bot token`);
        return;
    }
    let bot;
    try {
        bot = new node_telegram_bot_api_1.default(token, {
            polling: { interval: 2000, autoStart: false },
        });
    }
    catch (e) {
        console.error(`[TG ${projectId}] Failed to create bot:`, e.message);
        return;
    }
    bot.on('message', async (msg) => {
        try {
            await (0, handlers_1.handleMessage)(bot, msg, projectId);
        }
        catch (e) {
            console.error(`[TG ${projectId}] Unhandled message error:`, e.message);
        }
    });
    bot.on('polling_error', (err) => {
        // 409 Conflict: bot is running elsewhere
        if (err.message && err.message.includes('409')) {
            console.error(`[TG ${projectId}] Bot already running elsewhere (409). Stopping.`);
            stopProjectBot(projectId);
        }
        else {
            console.error(`[TG ${projectId}] Polling error:`, err.message);
        }
    });
    bot.startPolling();
    activeBots.set(projectId, bot);
    console.log(`[TG ${projectId}] Bot started`);
}
/**
 * Stop a running bot and remove it from the map.
 */
async function stopProjectBot(projectId) {
    const bot = activeBots.get(projectId);
    if (bot) {
        try {
            await bot.stopPolling();
        }
        catch (_a) {
            // Ignore errors during stop
        }
        activeBots.delete(projectId);
        console.log(`[TG ${projectId}] Bot stopped`);
    }
}
/**
 * Start all enabled bots across all projects.
 * Called at server startup.
 */
async function initAllBots() {
    console.log('[Telegram] Initializing all project bots...');
    const projects = await db_1.prisma.project.findMany({
        select: { id: true },
    });
    for (const project of projects) {
        try {
            await startProjectBot(project.id);
        }
        catch (e) {
            console.error(`[TG ${project.id}] Failed to start bot:`, e.message);
        }
    }
    console.log(`[Telegram] Bot initialization complete. Running: ${activeBots.size}`);
}
/**
 * Check if a bot is currently running for a project.
 */
function isBotRunning(projectId) {
    return activeBots.has(projectId);
}
