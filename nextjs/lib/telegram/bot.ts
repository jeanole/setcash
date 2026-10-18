// ============================================================================
// Telegram Bot Instance Management
// ============================================================================
// Manages per-project bot instances. Uses globalThis to survive Next.js HMR.
// ============================================================================

import { Bot, TelegramApiError } from 'node-telegram-bot-api';
import { prisma } from '../db';
import { decrypt } from './encryption';
import { handleMessage } from './handlers';
import { createTelegramClient } from './client';

// Long-poll wait (seconds) passed to getUpdates
const POLL_TIMEOUT_SECONDS = 30;
// Client-side timeout (ms) for ordinary API calls (sendMessage, getFile)
const API_TIMEOUT_MS = 30_000;
// Delay (ms) before resuming polling after an unexpected non-transient failure
const POLL_RESTART_DELAY_MS = 5000;

interface ActiveBot {
  bot: Bot;
  stopped: boolean;
  nextOffset?: number;
}

// Use globalThis to survive Next.js HMR in development
const activeBots: Map<string, ActiveBot> = (globalThis as any).__activeTelegramBots ??
  ((globalThis as any).__activeTelegramBots = new Map<string, ActiveBot>());

/**
 * Error text that is safe to log (never includes the request URL / token).
 */
function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Run the long-poll loop for one bot until it is stopped.
 * v2 retries transient errors itself (reported via onError); startPolling only
 * rejects on fatal errors, which are mapped here to the v1 polling_error rules:
 * 409/401/404 stop the bot, anything else is logged and polling is resumed.
 */
async function runPolling(projectId: string, entry: ActiveBot): Promise<void> {
  while (!entry.stopped) {
    try {
      await entry.bot.startPolling(undefined, {
        timeout: POLL_TIMEOUT_SECONDS,
        offset: entry.nextOffset,
        allowedUpdates: ['message'],
        onError: (err) => {
          console.error(`[TG ${projectId}] Polling error:`, errorMessage(err));
        },
      });
      return; // Resolved: polling was stopped via stop()
    } catch (err) {
      if (entry.stopped) return;

      const code = err instanceof TelegramApiError ? err.errorCode : undefined;
      if (code === 409) {
        console.error(`[TG ${projectId}] Bot already running elsewhere (409). Stopping.`);
        stopBot(projectId, entry);
        return;
      }
      if (code === 401 || code === 404) {
        // Invalid or deleted token — stop immediately to avoid spam
        console.error(`[TG ${projectId}] Invalid bot token (${code}). Stopping.`);
        stopBot(projectId, entry);
        return;
      }

      console.error(`[TG ${projectId}] Polling error:`, errorMessage(err));
      await new Promise((resolve) => setTimeout(resolve, POLL_RESTART_DELAY_MS));
    }
  }
}

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

  let bot: Bot;
  try {
    bot = new Bot(token, { timeoutMs: API_TIMEOUT_MS });
  } catch (e) {
    console.error(`[TG ${projectId}] Failed to create bot:`, errorMessage(e));
    return;
  }

  const client = createTelegramClient(bot.api, token);
  const entry: ActiveBot = { bot, stopped: false };

  // Remember the last seen update so a resumed poll does not redeliver it
  bot.use(async (ctx, next) => {
    entry.nextOffset = ctx.update.update_id + 1;
    await next();
  });

  // Handlers run concurrently and are not awaited, so a slow photo download
  // never blocks polling (same as the v1 event emitter behaviour).
  bot.on('message', (ctx, next) => {
    const msg = ctx.message;
    if (msg) {
      handleMessage(client, msg, projectId).catch((e) => {
        console.error(`[TG ${projectId}] Unhandled message error:`, errorMessage(e));
      });
    }
    return next();
  });

  // Last-resort boundary; log the message only (never the request URL / token)
  bot.catch((err) => {
    console.error(`[TG ${projectId}] Update handling error:`, errorMessage(err));
  });

  activeBots.set(projectId, entry);
  runPolling(projectId, entry).catch((e) => {
    console.error(`[TG ${projectId}] Polling loop crashed:`, errorMessage(e));
    stopBot(projectId, entry);
  });
  console.log(`[TG ${projectId}] Bot started`);
}

/**
 * Stop a bot instance and remove it from the map.
 * When `only` is given, it is stopped only if it is still the active instance
 * (so a stale polling loop cannot stop a newer bot for the same project).
 */
function stopBot(projectId: string, only?: ActiveBot): void {
  const entry = activeBots.get(projectId);
  if (!entry || (only && entry !== only)) return;

  entry.stopped = true;
  try {
    entry.bot.stop();
  } catch {
    // Ignore errors during stop
  }
  activeBots.delete(projectId);
  console.log(`[TG ${projectId}] Bot stopped`);
}

/**
 * Stop a running bot and remove it from the map.
 */
export async function stopProjectBot(projectId: string): Promise<void> {
  stopBot(projectId);
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
      console.error(`[TG ${project.id}] Failed to start bot:`, errorMessage(e));
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
