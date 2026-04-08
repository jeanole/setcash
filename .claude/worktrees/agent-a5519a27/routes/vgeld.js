const router = require("express").Router();
const db = require("../db");
const { ensureProjectAccess, ensureProjectAdmin } = require("../middleware");

// V-Geld endpoints
router.get("/api/vgeld", ensureProjectAccess, (req, res) => {
  const projectId = req.user.currentProjectId;
  const vgeld = db
    .prepare("SELECT * FROM vgeld WHERE project_id = ? ORDER BY id")
    .all(projectId);
  const mapped = vgeld.map((v) => ({
    id: v.id,
    date: v.date,
    amount: v.amount,
    from: v.from_user,
    to: v.to_user,
    createdBy: v.created_by,
  }));
  res.json(mapped);
});

router.post("/api/vgeld", ensureProjectAdmin, (req, res) => {
  const projectId = req.user.currentProjectId;
  const { amount, from, to } = req.body;
  if (!amount || !to)
    return res.status(400).json({ error: "Amount and recipient required" });
  // Recipient must be a member of this project
  const member = db
    .prepare(
      "SELECT id FROM project_members WHERE project_id = ? AND LOWER(user_email) = LOWER(?)",
    )
    .get(projectId, to);
  if (!member)
    return res
      .status(400)
      .json({ error: "Recipient must be a project member" });
  const result = db
    .prepare(
      "INSERT INTO vgeld (date, amount, from_user, to_user, created_by, project_id) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(
      new Date().toISOString(),
      parseFloat(amount) || 0,
      from || "External",
      to,
      req.user.email,
      projectId,
    );
  res.json({ ok: true, id: result.lastInsertRowid });
});

router.delete("/api/vgeld/:id", ensureProjectAdmin, (req, res) => {
  const projectId = req.user.currentProjectId;
  const id = parseInt(req.params.id);
  const result = db
    .prepare("DELETE FROM vgeld WHERE id = ? AND project_id = ?")
    .run(id, projectId);
  if (result.changes === 0) return res.status(404).json({ error: "Not found" });
  res.json({ ok: true });
});

// V-Geld analysis per user
router.get("/api/vgeld/analysis", ensureProjectAccess, (req, res) => {
  const projectId = req.user.currentProjectId;
  const vgeldSums = db
    .prepare(
      "SELECT to_user as user, SUM(amount) as received FROM vgeld WHERE project_id = ? GROUP BY to_user",
    )
    .all(projectId);
  const billSums = db
    .prepare(
      "SELECT email as user, SUM(amount) as spent FROM bills WHERE project_id = ? GROUP BY email",
    )
    .all(projectId);

  const analysis = {};
  vgeldSums.forEach((v) => {
    if (!analysis[v.user]) analysis[v.user] = { received: 0, spent: 0 };
    analysis[v.user].received = v.received || 0;
  });
  billSums.forEach((b) => {
    if (!analysis[b.user]) analysis[b.user] = { received: 0, spent: 0 };
    analysis[b.user].spent = b.spent || 0;
  });

  const result = Object.entries(analysis).map(([user, data]) => ({
    user,
    received: data.received,
    spent: data.spent,
    remaining: data.received - data.spent,
    percentUsed: data.received > 0 ? (data.spent / data.received) * 100 : 0,
  }));

  res.json(result);
});

// V-Geld balance for current user (sidebar display)
router.get("/api/vgeld/balance", ensureProjectAccess, (req, res) => {
  const projectId = req.user.currentProjectId;
  const email = req.user.email;
  const received = db
    .prepare(
      "SELECT COALESCE(SUM(amount),0) as total FROM vgeld WHERE project_id = ? AND to_user = ?",
    )
    .get(projectId, email);
  const spent = db
    .prepare(
      "SELECT COALESCE(SUM(amount),0) as total FROM bills WHERE project_id = ? AND email = ?",
    )
    .get(projectId, email);
  res.json({ balance: (received.total || 0) - (spent.total || 0) });
});

module.exports = router;
