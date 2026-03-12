import { createServer } from 'http';
import next from 'next';
import { initAllBots } from './lib/telegram/bot';

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '3001', 10);
const app = next({ dev, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  initAllBots().catch(console.error);

  createServer((req, res) => {
    handle(req, res);
  }).listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});
