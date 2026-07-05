import { createServer, Server } from 'http';
import next from 'next';
import { initAllBots, stopProjectBot } from './lib/telegram/bot';
import { assertOcrEncryptionConfigured } from './lib/ocr';
import { db } from './lib/db';

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '3001', 10);
const app = next({ dev, port });
const handle = app.getRequestHandler();

// Validate TELEGRAM_ENCRYPTION_KEY at startup when Telegram is in use.
// Bot tokens are stored encrypted at rest; without this key, encrypt() will throw.
if (!process.env.TELEGRAM_ENCRYPTION_KEY) {
  if (process.env.NODE_ENV === 'production') {
    console.error(
      '[Startup] TELEGRAM_ENCRYPTION_KEY is not set. Bot tokens cannot be encrypted. ' +
        'Set a 64-hex-character key before configuring Telegram in any project.'
    );
    process.exit(1);
  } else {
    console.warn(
      '[Startup] TELEGRAM_ENCRYPTION_KEY is not set. Calls to encrypt() will throw if a Telegram bot token is saved.'
    );
  }
}

// Validate the OCR/API-key encryption secret at startup (production-only).
// This check lives here rather than at module load so `next build` is not
// affected; the server refuses to start if the secret is misconfigured.
try {
  assertOcrEncryptionConfigured();
} catch (err) {
  console.error('[Startup]', err instanceof Error ? err.message : err);
  process.exit(1);
}

let httpServer: Server | undefined;
let shuttingDown = false;

app
  .prepare()
  .then(() => {
    initAllBots().catch(console.error);

    httpServer = createServer((req, res) => {
      handle(req, res);
    }).listen(port, () => {
      console.log(`> Ready on http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error('[Startup] Failed to prepare Next.js app:', err);
    process.exit(1);
  });

// ---------------------------------------------------------------------------
// Graceful shutdown — stop accepting new connections, stop all Telegram bot
// polling, disconnect Prisma, then exit. A hard-exit timeout guards against a
// hung close() call (e.g. long-lived keep-alive connections).
// ---------------------------------------------------------------------------
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`[Shutdown] Received ${signal}, shutting down gracefully...`);

  const forceExitTimer = setTimeout(() => {
    console.error('[Shutdown] Graceful shutdown timed out after 10s — forcing exit.');
    process.exit(1);
  }, 10_000);
  forceExitTimer.unref();

  if (httpServer) {
    try {
      await new Promise<void>((resolve, reject) => {
        httpServer!.close((err) => (err ? reject(err) : resolve()));
      });
    } catch (err) {
      console.error('[Shutdown] Error closing HTTP server:', err);
    }
  }

  try {
    const projects = await db.project.findMany({ select: { id: true } });
    await Promise.all(projects.map((project) => stopProjectBot(project.id)));
  } catch (err) {
    console.error('[Shutdown] Error stopping Telegram bots:', err);
  }

  try {
    await db.$disconnect();
  } catch (err) {
    console.error('[Shutdown] Error disconnecting Prisma:', err);
  }

  clearTimeout(forceExitTimer);
  console.log('[Shutdown] Complete.');
  process.exit(0);
}

process.on('SIGTERM', () => {
  shutdown('SIGTERM').catch((err) => {
    console.error('[Shutdown] Unexpected error during shutdown:', err);
    process.exit(1);
  });
});

process.on('SIGINT', () => {
  shutdown('SIGINT').catch((err) => {
    console.error('[Shutdown] Unexpected error during shutdown:', err);
    process.exit(1);
  });
});
