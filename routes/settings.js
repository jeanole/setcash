const router = require("express").Router();
const fs = require("fs");
const path = require("path");
const db = require("../db");
const DATA_DIR = db.DATA_DIR;
const { ensureProjectAdmin } = require("../middleware");
const { getSettings } = require("./helpers");

// These are imported lazily in the route to avoid circular deps
// startProjectBot comes from telegram module

router.get("/api/admin/settings", ensureProjectAdmin, (req, res) => {
  const projectId = req.user.currentProjectId;
  res.json(getSettings(projectId));
});

router.put("/api/admin/settings", ensureProjectAdmin, (req, res) => {
  const projectId = req.user.currentProjectId;
  const { projectTitle, projectSubtitle, exportSheetId, telegramBotToken, telegramEnabled } = req.body;
  // Save project name/subtitle directly to projects table (source of truth)
  if (projectTitle !== undefined || projectSubtitle !== undefined) {
    const updates = [];
    const params = [];
    if (projectTitle !== undefined) { updates.push("name = ?"); params.push(projectTitle); }
    if (projectSubtitle !== undefined) { updates.push("subtitle = ?"); params.push(projectSubtitle !== null ? projectSubtitle : null); }
    params.push(projectId);
    db.prepare(`UPDATE projects SET ${updates.join(", ")} WHERE id = ?`).run(...params);
    // Keep session in sync
    if (projectTitle !== undefined && req.session?.user) {
      req.session.user.currentProjectName = projectTitle;
    }
  }
  const insert = db.prepare(
    "INSERT OR REPLACE INTO project_settings (project_id, key, value) VALUES (?, ?, ?)",
  );
  if (exportSheetId !== undefined)
    insert.run(projectId, "exportSheetId", JSON.stringify(exportSheetId));
  if (telegramBotToken !== undefined)
    insert.run(projectId, "telegramBotToken", JSON.stringify(telegramBotToken));
  if (telegramEnabled !== undefined) {
    insert.run(
      projectId,
      "telegramEnabled",
      JSON.stringify(telegramEnabled === true),
    );
    // Restart bot to pick up changes
    const { startProjectBot } = require("./telegram");
    startProjectBot(projectId);
  }
  res.json({ ok: true });
});

function getCredentialsPath() {
  const dataPath = path.join(DATA_DIR, "google-credentials.json");
  const rootPath = path.join(__dirname, "..", "google-credentials.json");
  if (fs.existsSync(dataPath)) return dataPath;
  if (fs.existsSync(rootPath)) return rootPath;
  return null;
}

router.post(
  "/api/admin/google-credentials",
  ensureProjectAdmin,
  async (req, res) => {
    console.log("=== Credentials upload ===");
    const { credentials } = req.body;
    if (!credentials)
      return res.status(400).json({ error: "Credentials required" });
    try {
      const parsed = JSON.parse(credentials);
      console.log("Parsed credentials type:", parsed.type);
      console.log("Service account email:", parsed.client_email);
      if (parsed.type !== "service_account") {
        return res
          .status(400)
          .json({ error: "Must be a service account JSON" });
      }
      const credPath = path.join(DATA_DIR, "google-credentials.json");
      console.log("Saving credentials to:", credPath);
      fs.writeFileSync(credPath, JSON.stringify(parsed, null, 2));
      // Re-initialize google services
      const googleModule = require("../google");
      const initResult = await googleModule.initGoogleServices();
      console.log("Init result:", initResult);
      res.json({ ok: true, email: parsed.client_email });
    } catch (e) {
      console.error("Credentials error:", e);
      res.status(400).json({ error: "Invalid JSON: " + e.message });
    }
  },
);

router.get(
  "/api/admin/google-credentials/status",
  ensureProjectAdmin,
  (req, res) => {
    const credPath = getCredentialsPath();
    if (!credPath) return res.json({ configured: false });
    try {
      const creds = JSON.parse(fs.readFileSync(credPath, "utf8"));
      res.json({ configured: true, email: creds.client_email });
    } catch (e) {
      res.json({ configured: false });
    }
  },
);

module.exports = router;
module.exports.getCredentialsPath = getCredentialsPath;
