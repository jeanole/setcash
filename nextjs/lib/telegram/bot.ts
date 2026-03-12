// ============================================================================
// Telegram Bot Instance Management
// ============================================================================
// Manages per-project bot instances. Uses globalThis to survive Next.js HMR.
// ============================================================================

import TelegramBot from 'node-telegram-bot-api';
import { prisma } from '../db';
import { decrypt } from './encryption';
import { handleMessage } from './handlers';

// Use globalThis to survive Next.js HMR in development
const activeBots: Map<string, TelegramBot> = (globalThis as any).__activeBots ??
  ((globalThis as any).__activeBots = new Map<string, TelegramBot>());

/**
 * Start a Telegram bot for a specific project.
 * Reads settings from DB, decrypts token, creates bot and registers handlers.
 */
export async function startProjectBot(projectId: string): Promise<void> {
  // Stop existing bot if running
  if (activeBots.has(projectId)) {
    await stopProjectBot(projectId);
  }

  // Read settings from DB
  const settingsRows = await prisma.projectSettings.findMany({
    where: { projectId },
  });
  const settings: Record<string, unknown> = {};
  for (const row of settingsRows) {
    try {
      settings[row.key] = JSON.parse(row.value || 'null');
    } catch {
      settings[row.key] = row.value;
    }
  }

  if (!settings.telegramEnabled || !settings.telegramBotToken) {
    console.log(`[TG ${projectId}] Telegram not enabled or no token configured`);
    return;
  }

  const encryptedToken = settings.telegramBotToken as string;
  const token = decrypt(encryptedToken);
  if (!token) {
    console.error(`[TG ${projectId}] Failed to decrypt bot token`);
    return;
  }

  let bot: TelegramBot;
  try {
    bot = new TelegramBot(token, {
      polling: { interval: 2000, autoStart: false },
    });
  } catch (e) {
    console.error(`[TG ${projectId}] Failed to create bot:`, (e as Error).message);
    return;
  }

  bot.on('message', async (msg) => {
    try {
      await handleMessage(bot, msg, projectId);
    } catch (e) {
      console.error(`[TG ${projectId}] Unhandled message error:`, (e as Error).message);
    }
  });

  bot.on('polling_error', (err) => {
    const msg = err.message ?? '';
    if (msg.includes('409')) {
      console.error(`[TG ${projectId}] Bot already running elsewhere (409). Stopping.`);
      stopProjectBot(projectId);
    } else if (msg.includes('401') || msg.includes('404')) {
      // Invalid or deleted token — stop immediately to avoid spam
      console.error(`[TG ${projectId}] Invalid bot token (${msg.includes('401') ? '401' : '404'}). Stopping.`);
      stopProjectBot(projectId);
    } else {
      console.error(`[TG ${projectId}] Polling error:`, msg);
    }
  });

  bot.startPolling();
  activeBots.set(projectId, bot);
  console.log(`[TG ${projectId}] Bot started`);
}

/**
 * Stop a running bot and remove it from the map.
 */
export async function stopProjectBot(projectId: string): Promise<void> {
  const bot = activeBots.get(projectId);
  if (bot) {
    try {
      await bot.stopPolling();
    } catch {
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
export async function initAllBots(): Promise<void> {
  console.log('[Telegram] Initializing all project bots...');

  const projects = await prisma.project.findMany({
    select: { id: true },
  });

  for (const project of projects) {
    try {
      await startProjectBot(project.id);
    } catch (e) {
      console.error(`[TG ${project.id}] Failed to start bot:`, (e as Error).message);
    }
  }

  console.log(`[Telegram] Bot initialization complete. Running: ${activeBots.size}`);
}

/**
 * Check if a bot is currently running for a project.
 */
export function isBotRunning(projectId: string): boolean {
  return activeBots.has(projectId);
}
