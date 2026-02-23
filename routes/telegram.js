const router = require("express").Router();
const fs = require("fs");
const path = require("path");
const TelegramBot = require("node-telegram-bot-api");
const db = require("../db");
const DATA_DIR = db.DATA_DIR;
const { ensureAuth, ensureProjectAdmin } = require("../middleware");

const activeBots = new Map(); // projectId -> TelegramBot instance
const mediaGroupBuffers = new Map(); // bufferKey -> { messages, timer }

function getProjectSettings(projectId) {
  const rows = db
    .prepare("SELECT key, value FROM project_settings WHERE project_id = ?")
    .all(projectId);
  const s = {};
  for (const r of rows) {
    try {
      s[r.key] = JSON.parse(r.value);
    } catch {
      s[r.key] = r.value;
    }
  }
  return s;
}

async function downloadTelegramFile(bot, fileId) {
  const fileInfo = await bot.getFile(fileId);
  const url = `https://api.telegram.org/file/bot${bot.token}/${fileInfo.file_path}`;
  const https = require("https");
  const http = require("http");
  return new Promise((resolve, reject) => {
    const ext = path.extname(fileInfo.file_path) || ".jpg";
    const savedName = `tg_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
    const uploadsDir = path.join(DATA_DIR, "uploads");
    if (!fs.existsSync(uploadsDir))
      fs.mkdirSync(uploadsDir, { recursive: true });
    const destPath = path.join(uploadsDir, savedName);
    const proto = url.startsWith("https") ? https : http;
    const file = fs.createWriteStream(destPath);
    proto
      .get(url, (res) => {
        res.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve({ savedName, origName: path.basename(fileInfo.file_path) });
        });
      })
      .on("error", (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
  });
}

function createDraftBill(projectId, userEmail, photos, caption) {
  const billNumber = `TG-${Date.now()}`;
  const insertBill = db.prepare(`
    INSERT INTO bills (date, email, bill_number, type, vendor, item, comment, brutto19, brutto7, brutto0, netto_amount, motive, project_id, status, telegram_caption)
    VALUES (datetime('now'), ?, ?, 'Kauf', '', '', ?, 0, 0, 0, 0, 'Default', ?, 'draft', ?)
  `);
  const result = insertBill.run(
    userEmail,
    billNumber,
    caption || "",
    projectId,
    caption || null,
  );
  const billId = result.lastInsertRowid;

  // Attach default motive allocation
  const defaultMotive = db
    .prepare("SELECT id FROM motives WHERE name = 'Default' AND project_id = ?")
    .get(projectId);
  if (defaultMotive) {
    db.prepare(
      "INSERT OR IGNORE INTO bill_motives (bill_id, motive_id, percentage) VALUES (?, ?, 100)",
    ).run(billId, defaultMotive.id);
  }
  const defaultCat = db
    .prepare(
      "SELECT id FROM categories WHERE name = 'Uncategorized' AND project_id = ?",
    )
    .get(projectId);
  if (defaultCat) {
    db.prepare(
      "INSERT OR IGNORE INTO bill_categories (bill_id, category_id, percentage) VALUES (?, ?, 100)",
    ).run(billId, defaultCat.id);
  }

  // Attach images
  const insertImg = db.prepare(
    "INSERT INTO bill_images (bill_id, filename, file, sort_order) VALUES (?, ?, ?, ?)",
  );
  photos.forEach((p, i) => insertImg.run(billId, p.origName, p.savedName, i));

  return billId;
}

async function processMediaGroup(bufferKey, projectId, userEmail) {
  const buf = mediaGroupBuffers.get(bufferKey);
  if (!buf) return;
  mediaGroupBuffers.delete(bufferKey);

  const bot = activeBots.get(projectId);
  if (!bot) return;

  const photos = [];
  for (const msg of buf.messages) {
    const photo = msg.photo[msg.photo.length - 1]; // largest size
    try {
      const p = await downloadTelegramFile(bot, photo.file_id);
      photos.push(p);
    } catch (e) {
      console.error(`[TG ${projectId}] Error downloading photo:`, e.message);
    }
  }

  if (photos.length === 0) return;
  const caption = buf.messages[0].caption || null;
  const billId = createDraftBill(projectId, userEmail, photos, caption);
  console.log(
    `[TG ${projectId}] Created draft bill #${billId} with ${photos.length} image(s) for ${userEmail}`,
  );

  const chatId = buf.messages[0].chat.id;
  bot
    .sendMessage(
      chatId,
      `✓ ${photos.length} Foto(s) empfangen – Beleg als Entwurf gespeichert.\nBitte in vBudget vervollständigen.`,
    )
    .catch(() => {});
}

async function processSinglePhoto(bot, msg, projectId, userEmail) {
  const photo = msg.photo[msg.photo.length - 1];
  let downloaded;
  try {
    downloaded = await downloadTelegramFile(bot, photo.file_id);
  } catch (e) {
    console.error(`[TG ${projectId}] Error downloading photo:`, e.message);
    bot
      .sendMessage(
        msg.chat.id,
        "Fehler beim Speichern des Fotos. Bitte erneut versuchen.",
      )
      .catch(() => {});
    return;
  }
  const caption = msg.caption || null;
  const billId = createDraftBill(projectId, userEmail, [downloaded], caption);
  console.log(
    `[TG ${projectId}] Created draft bill #${billId} for ${userEmail}`,
  );
  bot
    .sendMessage(
      msg.chat.id,
      `✓ Foto empfangen – Beleg als Entwurf gespeichert.\nBitte in vBudget vervollständigen.`,
    )
    .catch(() => {});
}

function startProjectBot(projectId) {
  if (activeBots.has(projectId)) {
    activeBots.get(projectId).stopPolling();
    activeBots.delete(projectId);
  }
  const settings = getProjectSettings(projectId);
  if (!settings.telegramEnabled || !settings.telegramBotToken) return;

  const token = settings.telegramBotToken;
  let bot;
  try {
    bot = new TelegramBot(token, {
      polling: { interval: 2000, autoStart: false },
    });
  } catch (e) {
    console.error(`[TG ${projectId}] Failed to create bot:`, e.message);
    return;
  }

  bot.on("message", async (msg) => {
    // Handle /start
    if (msg.text && msg.text.startsWith("/start")) {
      bot
        .sendMessage(
          msg.chat.id,
          'Willkommen bei vBudget!\nSende /link <Code> um deinen Account zu verknüpfen.\nDen Code findest du in vBudget unter "Telegram verknüpfen".',
        )
        .catch(() => {});
      return;
    }

    // Handle /link <code>
    if (msg.text && msg.text.startsWith("/link ")) {
      const code = msg.text.split(" ")[1]?.trim();
      if (!code) {
        bot
          .sendMessage(msg.chat.id, "Verwendung: /link <Code>")
          .catch(() => {});
        return;
      }
      const now = new Date().toISOString();
      const linkCode = db
        .prepare(
          "SELECT * FROM telegram_link_codes WHERE code = ? AND project_id = ? AND expires_at > ?",
        )
        .get(code, projectId, now);
      if (!linkCode) {
        bot
          .sendMessage(msg.chat.id, "Ungültiger oder abgelaufener Code.")
          .catch(() => {});
        return;
      }
      const telegramUserId = String(msg.from.id);
      try {
        db.prepare(
          "INSERT OR REPLACE INTO telegram_links (project_id, telegram_user_id, user_email) VALUES (?, ?, ?)",
        ).run(projectId, telegramUserId, linkCode.user_email);
        db.prepare("DELETE FROM telegram_link_codes WHERE code = ?").run(code);
        bot
          .sendMessage(
            msg.chat.id,
            `✓ Verknüpft mit ${linkCode.user_email}!\nSende jetzt einfach Fotos deiner Belege – sie werden automatisch als Entwurf gespeichert.`,
          )
          .catch(() => {});
      } catch (e) {
        console.error(`[TG ${projectId}] Link error:`, e.message);
        bot
          .sendMessage(
            msg.chat.id,
            "Fehler beim Verknüpfen. Bitte erneut versuchen.",
          )
          .catch(() => {});
      }
      return;
    }

    // Handle photos
    if (msg.photo) {
      const telegramUserId = String(msg.from.id);
      const link = db
        .prepare(
          "SELECT user_email FROM telegram_links WHERE project_id = ? AND telegram_user_id = ?",
        )
        .get(projectId, telegramUserId);
      if (!link) {
        bot
          .sendMessage(
            msg.chat.id,
            "Dein Telegram-Account ist noch nicht verknüpft.\nSende /link <Code> – den Code findest du in vBudget.",
          )
          .catch(() => {});
        return;
      }

      if (msg.media_group_id) {
        // Album: buffer and wait for all photos
        const bufferKey = `${projectId}:${msg.media_group_id}`;
        if (!mediaGroupBuffers.has(bufferKey)) {
          mediaGroupBuffers.set(bufferKey, { messages: [], timer: null });
        }
        const buf = mediaGroupBuffers.get(bufferKey);
        buf.messages.push(msg);
        if (buf.timer) clearTimeout(buf.timer);
        buf.timer = setTimeout(
          () => processMediaGroup(bufferKey, projectId, link.user_email),
          1500,
        );
      } else {
        await processSinglePhoto(bot, msg, projectId, link.user_email);
      }
    }
  });

  bot.on("polling_error", (err) => {
    if (err.code === "ETELEGRAM" && err.message.includes("409")) {
      console.error(
        `[TG ${projectId}] Bot already running elsewhere (409). Stopping.`,
      );
      stopProjectBot(projectId);
    } else {
      console.error(`[TG ${projectId}] Polling error:`, err.message);
    }
  });

  bot.startPolling();
  activeBots.set(projectId, bot);
  console.log(`[TG ${projectId}] Bot started`);
}

function stopProjectBot(projectId) {
  const bot = activeBots.get(projectId);
  if (bot) {
    bot.stopPolling().catch(() => {});
    activeBots.delete(projectId);
    console.log(`[TG ${projectId}] Bot stopped`);
  }
}

function startAllBots() {
  const projects = db.prepare("SELECT id FROM projects").all();
  for (const p of projects) {
    startProjectBot(p.id);
  }
}

// ============================================================
// TELEGRAM API ROUTES
// ============================================================

// Generate a linking code for current user (10 min TTL)
router.get("/api/telegram/link-code", ensureAuth, (req, res) => {
  const projectId = req.user.currentProjectId;
  if (!projectId) return res.status(400).json({ error: "No project selected" });
  const settings = getProjectSettings(projectId);
  if (!settings.telegramEnabled)
    return res
      .status(400)
      .json({ error: "Telegram not enabled for this project" });

  // Clean up expired codes for this user/project
  db.prepare(
    "DELETE FROM telegram_link_codes WHERE user_email = ? AND project_id = ?",
  ).run(req.user.email, projectId);

  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  db.prepare(
    "INSERT INTO telegram_link_codes (code, user_email, project_id, expires_at) VALUES (?, ?, ?, ?)",
  ).run(code, req.user.email, projectId, expires);

  res.json({ code, expires });
});

// Check current user's link status for this project
router.get("/api/telegram/status", ensureAuth, (req, res) => {
  const projectId = req.user.currentProjectId;
  if (!projectId) return res.json({ enabled: false, linked: false });
  const settings = getProjectSettings(projectId);
  const link = db
    .prepare(
      "SELECT telegram_user_id, linked_at FROM telegram_links WHERE project_id = ? AND user_email = ?",
    )
    .get(projectId, req.user.email);
  res.json({
    enabled: !!settings.telegramEnabled,
    linked: !!link,
    linkedAt: link?.linked_at || null,
  });
});

// Unlink own Telegram account
router.delete("/api/telegram/links/me", ensureAuth, (req, res) => {
  const projectId = req.user.currentProjectId;
  db.prepare(
    "DELETE FROM telegram_links WHERE project_id = ? AND user_email = ?",
  ).run(projectId, req.user.email);
  res.json({ ok: true });
});

// Admin: list all linked users for project
router.get("/api/admin/telegram/links", ensureProjectAdmin, (req, res) => {
  const projectId = req.user.currentProjectId;
  const links = db
    .prepare(
      "SELECT id, telegram_user_id, user_email, linked_at FROM telegram_links WHERE project_id = ? ORDER BY linked_at DESC",
    )
    .all(projectId);
  res.json(links);
});

// Admin: unlink any user
router.delete("/api/admin/telegram/links/:id", ensureProjectAdmin, (req, res) => {
  db.prepare("DELETE FROM telegram_links WHERE id = ?").run(
    parseInt(req.params.id),
  );
  res.json({ ok: true });
});

// Admin: get bot status
router.get("/api/admin/telegram/bot-status", ensureProjectAdmin, (req, res) => {
  const projectId = req.user.currentProjectId;
  const running = activeBots.has(projectId);
  res.json({ running });
});

// Admin: restart/stop bot (called after settings change)
router.post("/api/admin/telegram/restart", ensureProjectAdmin, (req, res) => {
  const projectId = req.user.currentProjectId;
  startProjectBot(projectId);
  res.json({ running: activeBots.has(projectId) });
});

module.exports = router;
module.exports.startAllBots = startAllBots;
module.exports.startProjectBot = startProjectBot;
module.exports.stopProjectBot = stopProjectBot;
