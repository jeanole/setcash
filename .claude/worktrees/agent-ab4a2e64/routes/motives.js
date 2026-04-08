const router = require("express").Router();
const db = require("../db");
const { ensureProjectAccess, ensureProjectAdmin } = require("../middleware");

// API: Motives
router.get("/api/motives", ensureProjectAccess, (req, res) => {
  const projectId = req.user.currentProjectId;
  const motives = db
    .prepare("SELECT * FROM motives WHERE project_id = ? ORDER BY id")
    .all(projectId);
  res.json(motives);
});

router.post("/api/admin/motive", ensureProjectAdmin, (req, res) => {
  const projectId = req.user.currentProjectId;
  const { motive, budget } = req.body;
  if (!motive) return res.status(400).json({ error: "Motive name required" });
  const result = db
    .prepare("INSERT INTO motives (name, budget, project_id) VALUES (?, ?, ?)")
    .run(motive, parseFloat(budget) || 0, projectId);
  res.json({ ok: true, id: result.lastInsertRowid });
});

router.put("/api/admin/motive/:id", ensureProjectAdmin, (req, res) => {
  const projectId = req.user.currentProjectId;
  const id = parseInt(req.params.id);
  const existing = db
    .prepare("SELECT * FROM motives WHERE id = ? AND project_id = ?")
    .get(id, projectId);
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (existing.name === "Default")
    return res.status(400).json({ error: "Cannot edit Default motive" });
  const { motive, budget } = req.body;
  const updates = [];
  const params = [];
  if (motive !== undefined) {
    updates.push("name = ?");
    params.push(motive);
  }
  if (budget !== undefined) {
    updates.push("budget = ?");
    params.push(parseFloat(budget) || 0);
  }
  if (updates.length > 0) {
    params.push(id);
    db.prepare(`UPDATE motives SET ${updates.join(", ")} WHERE id = ?`).run(
      ...params,
    );
  }
  res.json({ ok: true });
});

router.delete("/api/admin/motive/:id", ensureProjectAdmin, (req, res) => {
  const projectId = req.user.currentProjectId;
  const id = parseInt(req.params.id);
  const motive = db
    .prepare("SELECT name FROM motives WHERE id = ? AND project_id = ?")
    .get(id, projectId);
  if (!motive) return res.status(404).json({ error: "Not found" });
  if (motive.name === "Default") {
    return res.status(400).json({ error: "Cannot delete Default motive" });
  }
  db.prepare("DELETE FROM motives WHERE id = ?").run(id);
  db.prepare("DELETE FROM bill_motives WHERE motive_id = ?").run(id);
  db.prepare("DELETE FROM budget_matrix WHERE motive_id = ?").run(id);
  res.json({ ok: true });
});

module.exports = router;
