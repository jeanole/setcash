const router = require("express").Router();
const db = require("../db");
const { ensureProjectAccess, ensureProjectAdmin } = require("../middleware");

// API: Categories
router.get("/api/categories", ensureProjectAccess, (req, res) => {
  const projectId = req.user.currentProjectId;
  const categories = db
    .prepare("SELECT * FROM categories WHERE project_id = ? ORDER BY id")
    .all(projectId);
  res.json(categories);
});

router.post("/api/admin/category", ensureProjectAdmin, (req, res) => {
  const projectId = req.user.currentProjectId;
  const { category, budget } = req.body;
  if (!category)
    return res.status(400).json({ error: "Category name required" });
  const result = db
    .prepare(
      "INSERT INTO categories (name, budget, project_id) VALUES (?, ?, ?)",
    )
    .run(category, parseFloat(budget) || 0, projectId);
  res.json({ ok: true, id: result.lastInsertRowid });
});

router.put("/api/admin/category/:id", ensureProjectAdmin, (req, res) => {
  const projectId = req.user.currentProjectId;
  const id = parseInt(req.params.id);
  const existing = db
    .prepare("SELECT * FROM categories WHERE id = ? AND project_id = ?")
    .get(id, projectId);
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (existing.name === "Uncategorized")
    return res
      .status(400)
      .json({ error: "Cannot edit Uncategorized category" });
  const { category, budget } = req.body;
  const updates = [];
  const params = [];
  if (category !== undefined) {
    updates.push("name = ?");
    params.push(category);
  }
  if (budget !== undefined) {
    updates.push("budget = ?");
    params.push(parseFloat(budget) || 0);
  }
  if (updates.length > 0) {
    params.push(id);
    db.prepare(`UPDATE categories SET ${updates.join(", ")} WHERE id = ?`).run(
      ...params,
    );
  }
  res.json({ ok: true });
});

router.delete("/api/admin/category/:id", ensureProjectAdmin, (req, res) => {
  const projectId = req.user.currentProjectId;
  const id = parseInt(req.params.id);
  const category = db
    .prepare("SELECT name FROM categories WHERE id = ? AND project_id = ?")
    .get(id, projectId);
  if (!category) return res.status(404).json({ error: "Not found" });
  if (category.name === "Uncategorized") {
    return res
      .status(400)
      .json({ error: "Cannot delete Uncategorized category" });
  }
  db.prepare("DELETE FROM categories WHERE id = ?").run(id);
  db.prepare("DELETE FROM bill_categories WHERE category_id = ?").run(id);
  db.prepare("DELETE FROM budget_matrix WHERE category_id = ?").run(id);
  res.json({ ok: true });
});

module.exports = router;
