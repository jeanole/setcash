"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = require("http");
const next_1 = __importDefault(require("next"));
const bot_1 = require("./lib/telegram/bot");
const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '3001', 10);
const app = (0, next_1.default)({ dev, port });
const handle = app.getRequestHandler();
app.prepare().then(() => {
    (0, bot_1.initAllBots)().catch(console.error);
    (0, http_1.createServer)((req, res) => {
        handle(req, res);
    }).listen(port, () => {
        console.log(`> Ready on http://localhost:${port}`);
    });
});
