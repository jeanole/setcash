import { createServer } from 'http';
import next from 'next';
import { initAllBots } from './lib/telegram/bot';

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

app.prepare().then(() => {
  initAllBots().catch(console.error);

  createServer((req, res) => {
    handle(req, res);
  }).listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});
