const router = require("express").Router();
const db = require("../db");
const { ensureProjectAccess, ensureProjectAdmin } = require("../middleware");

// API: Positions (per-project, replaces global roles for display/filter)
router.get("/api/positions", ensureProjectAccess, (req, res) => {
  const projectId = req.user.currentProjectId;
  const positions = db
    .prepare("SELECT * FROM project_positions WHERE project_id = ? ORDER BY id")
    .all(projectId);
  res.json(positions);
});

router.post("/api/admin/position", ensureProjectAdmin, (req, res) => {
  const projectId = req.user.currentProjectId;
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Position name required" });
  try {
    const result = db
      .prepare("INSERT INTO project_positions (project_id, name) VALUES (?, ?)")
      .run(projectId, name);
    res.json({ ok: true, id: result.lastInsertRowid });
  } catch (e) {
    if (e.message.includes("UNIQUE"))
      return res.status(400).json({ error: "Position already exists" });
    throw e;
  }
});

router.put("/api/admin/position/:id", ensureProjectAdmin, (req, res) => {
  const projectId = req.user.currentProjectId;
  const id = parseInt(req.params.id);
  const existing = db
    .prepare("SELECT * FROM project_positions WHERE id = ? AND project_id = ?")
    .get(id, projectId);
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (existing.name === "Misc")
    return res.status(400).json({ error: "Cannot edit Misc position" });
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Position name required" });
  try {
    db.prepare("UPDATE project_positions SET name = ? WHERE id = ?").run(
      name,
      id,
    );
    res.json({ ok: true });
  } catch (e) {
    if (e.message.includes("UNIQUE"))
      return res.status(400).json({ error: "Position already exists" });
    throw e;
  }
});

router.delete("/api/admin/position/:id", ensureProjectAdmin, (req, res) => {
  const projectId = req.user.currentProjectId;
  const id = parseInt(req.params.id);
  const position = db
    .prepare(
      "SELECT name FROM project_positions WHERE id = ? AND project_id = ?",
    )
    .get(id, projectId);
  if (!position) return res.status(404).json({ error: "Not found" });
  if (position.name === "Misc")
    return res.status(400).json({ error: "Cannot delete Misc position" });
  db.prepare(
    "UPDATE project_members SET position_id = NULL WHERE position_id = ?",
  ).run(id);
  db.prepare("DELETE FROM project_positions WHERE id = ?").run(id);
  res.json({ ok: true });
});

module.exports = router;
