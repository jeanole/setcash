const router = require("express").Router();
const db = require("../db");
const { ensureAuth } = require("../middleware");

// Notifications API
router.get("/api/notifications", ensureAuth, (req, res) => {
  const email = req.user.email;
  const notifications = db
    .prepare(
      "SELECT id, type, message, project_id, is_read, created_at FROM notifications WHERE user_email = ? ORDER BY created_at DESC LIMIT 50",
    )
    .all(email);
  res.json(notifications);
});

router.post("/api/notifications/:id/read", ensureAuth, (req, res) => {
  const id = parseInt(req.params.id);
  const email = req.user.email;
  db.prepare("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_email = ?").run(id, email);
  res.json({ ok: true });
});

router.post("/api/notifications/read-all", ensureAuth, (req, res) => {
  const email = req.user.email;
  db.prepare("UPDATE notifications SET is_read = 1 WHERE user_email = ?").run(email);
  res.json({ ok: true });
});

module.exports = router;
