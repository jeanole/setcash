/**
 * Telegram message handlers (real DB, fake Telegram client, local file server).
 *  - BUG-8:  deactivated users can neither link nor create bills
 *  - BUG-14: draft bills respect the project's uploadLimit and write an EditLog
 */

import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import type { AddressInfo } from 'net';
import type { Message } from 'node-telegram-bot-api';
import { db } from '@/lib/db';
import { createTestContext, cleanupTestContext, TestContext } from '../helpers';

// UPLOADS_DIR is read at module load, so set it before requiring the handlers
const UPLOADS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'setcash-tg-uploads-'));
process.env.UPLOADS_DIR = UPLOADS_DIR;
/* eslint-disable @typescript-eslint/no-require-imports */
const { handleMessage } = require('@/lib/telegram/handlers') as typeof import('@/lib/telegram/handlers');
/* eslint-enable @typescript-eslint/no-require-imports */

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);

let fileServer: http.Server;
let fileBaseUrl: string;

function fakeBot() {
  return {
    sendMessage: jest.fn().mockResolvedValue(undefined),
    getFile: jest.fn().mockResolvedValue({ file_id: 'f', file_path: 'photos/p.jpg' }),
    getFileUrl: jest.fn((filePath: string) => `${fileBaseUrl}/${filePath}`),
  };
}

let nextMessageId = 1;
function photoMessage(telegramUserId: number): Message {
  return {
    message_id: nextMessageId++,
    date: Math.floor(Date.now() / 1000),
    chat: { id: telegramUserId, type: 'private' },
    from: { id: telegramUserId, is_bot: false, first_name: 'T' },
    photo: [{ file_id: 'f', file_unique_id: 'u', width: 10, height: 10 }],
    caption: 'lunch',
  } as unknown as Message;
}

function textMessage(telegramUserId: number, text: string): Message {
  return {
    message_id: nextMessageId++,
    date: Math.floor(Date.now() / 1000),
    chat: { id: telegramUserId, type: 'private' },
    from: { id: telegramUserId, is_bot: false, first_name: 'T' },
    text,
  } as unknown as Message;
}

const sentTexts = (bot: ReturnType<typeof fakeBot>): string[] =>
  bot.sendMessage.mock.calls.map((c) => String(c[1]));

describe('Telegram handlers', () => {
  let ctx: TestContext;
  let telegramUserId: number;

  beforeAll(async () => {
    fileServer = http.createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'image/jpeg' });
      res.end(JPEG);
    });
    await new Promise<void>((resolve) => fileServer.listen(0, '127.0.0.1', resolve));
    fileBaseUrl = `http://127.0.0.1:${(fileServer.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => fileServer.close(() => resolve()));
    fs.rmSync(UPLOADS_DIR, { recursive: true, force: true });
  });

  beforeEach(async () => {
    ctx = await createTestContext();
    telegramUserId = 100_000 + Math.floor(Math.random() * 900_000);
    await db.telegramLink.create({
      data: { projectId: ctx.projectId, telegramUserId: String(telegramUserId), userEmail: ctx.userEmail },
    });
    for (const f of fs.readdirSync(UPLOADS_DIR)) fs.rmSync(path.join(UPLOADS_DIR, f), { force: true });
  });

  afterEach(async () => {
    await cleanupTestContext(ctx);
  });

  describe('photo from a linked, active member', () => {
    it('should create a draft bill and an EditLog entry with source telegram', async () => {
      const bot = fakeBot();

      await handleMessage(bot, photoMessage(telegramUserId), ctx.projectId);

      const bills = await db.bill.findMany({ where: { projectId: ctx.projectId } });
      expect(bills).toHaveLength(1);
      expect(bills[0]).toMatchObject({ status: 'draft', submittedByEmail: ctx.userEmail });
      const logs = await db.editLog.findMany({ where: { billId: bills[0].id } });
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        projectId: ctx.projectId,
        user: ctx.userEmail,
        source: 'telegram',
        changes: { _event: 'created' },
      });
    });
  });

  describe('BUG-8: deactivated users', () => {
    it('should refuse a photo, reply, and create no bill', async () => {
      await db.user.update({ where: { email: ctx.userEmail }, data: { isActive: false } });
      const bot = fakeBot();

      await handleMessage(bot, photoMessage(telegramUserId), ctx.projectId);

      expect(await db.bill.count({ where: { projectId: ctx.projectId } })).toBe(0);
      expect(sentTexts(bot).join('\n')).toMatch(/deaktiviert/);
      expect(bot.getFile).not.toHaveBeenCalled();
    });

    it('should keep the link so re-activation restores the channel', async () => {
      await db.user.update({ where: { email: ctx.userEmail }, data: { isActive: false } });
      await handleMessage(fakeBot(), photoMessage(telegramUserId), ctx.projectId);
      expect(await db.telegramLink.count({ where: { projectId: ctx.projectId } })).toBe(1);

      await db.user.update({ where: { email: ctx.userEmail }, data: { isActive: true } });
      await handleMessage(fakeBot(), photoMessage(telegramUserId), ctx.projectId);

      expect(await db.bill.count({ where: { projectId: ctx.projectId } })).toBe(1);
    });

    it('should refuse to link a Telegram account to a deactivated user', async () => {
      await db.telegramLink.deleteMany({ where: { projectId: ctx.projectId } });
      await db.user.update({ where: { email: ctx.userEmail }, data: { isActive: false } });
      const code = `T${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
      await db.telegramLinkCode.create({
        data: {
          code,
          userEmail: ctx.userEmail,
          projectId: ctx.projectId,
          expiresAt: new Date(Date.now() + 60_000),
        },
      });
      const bot = fakeBot();

      await handleMessage(bot, textMessage(telegramUserId, `/link ${code}`), ctx.projectId);

      expect(await db.telegramLink.count({ where: { projectId: ctx.projectId } })).toBe(0);
      expect(sentTexts(bot).join('\n')).toMatch(/deaktiviert/);
    });
  });

  describe('BUG-14: upload limit', () => {
    it('should refuse a draft bill when the project is at its uploadLimit', async () => {
      await db.bill.create({
        data: {
          projectId: ctx.projectId,
          submittedByEmail: ctx.userEmail,
          billNumber: '1.01',
          date: new Date(),
          type: 'Kauf',
          status: 'draft',
        },
      });
      await db.project.update({ where: { id: ctx.projectId }, data: { uploadLimit: 1 } });
      const bot = fakeBot();

      await handleMessage(bot, photoMessage(telegramUserId), ctx.projectId);

      expect(await db.bill.count({ where: { projectId: ctx.projectId } })).toBe(1);
      expect(sentTexts(bot).join('\n')).toMatch(/Upload-Limit/);
      expect(await db.editLog.count({ where: { projectId: ctx.projectId } })).toBe(0);
    });

    it('should not leave the downloaded file behind when refused', async () => {
      await db.project.update({ where: { id: ctx.projectId }, data: { uploadLimit: 1 } });
      await db.bill.create({
        data: {
          projectId: ctx.projectId,
          submittedByEmail: ctx.userEmail,
          billNumber: '1.01',
          date: new Date(),
          type: 'Kauf',
          status: 'draft',
        },
      });

      await handleMessage(fakeBot(), photoMessage(telegramUserId), ctx.projectId);
      await new Promise((resolve) => setTimeout(resolve, 100)); // async unlink

      expect(fs.readdirSync(UPLOADS_DIR)).toEqual([]);
    });

    it('should accept a bill while below the uploadLimit', async () => {
      await db.project.update({ where: { id: ctx.projectId }, data: { uploadLimit: 2 } });

      await handleMessage(fakeBot(), photoMessage(telegramUserId), ctx.projectId);

      expect(await db.bill.count({ where: { projectId: ctx.projectId } })).toBe(1);
    });

    it('should not exceed the uploadLimit with concurrent uploads', async () => {
      await db.project.update({ where: { id: ctx.projectId }, data: { uploadLimit: 2 } });

      await Promise.all(
        [1, 2, 3, 4].map(() => handleMessage(fakeBot(), photoMessage(telegramUserId), ctx.projectId))
      );

      expect(await db.bill.count({ where: { projectId: ctx.projectId } })).toBe(2);
    });
  });
});
