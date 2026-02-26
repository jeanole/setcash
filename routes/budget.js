const router = require("express").Router();
const db = require("../db");
const { ensureProjectAccess, ensureProjectAdmin } = require("../middleware");

// API: Budget Matrix
router.get("/api/budget-matrix", ensureProjectAccess, (req, res) => {
  const projectId = req.user.currentProjectId;
  const motives = db
    .prepare(
      "SELECT id, name FROM motives WHERE project_id = ? ORDER BY CASE WHEN name = 'Default' THEN 1 ELSE 0 END, id",
    )
    .all(projectId);
  const categories = db
    .prepare(
      "SELECT id, name FROM categories WHERE project_id = ? ORDER BY CASE WHEN name = 'Uncategorized' THEN 1 ELSE 0 END, id",
    )
    .all(projectId);
  const rows = db
    .prepare(
      "SELECT motive_id, category_id, amount FROM budget_matrix WHERE project_id = ?",
    )
    .all(projectId);

  const matrix = {};
  let grandTotal = 0;
  for (const r of rows) {
    matrix[r.category_id + "_" + r.motive_id] = r.amount;
    grandTotal += r.amount || 0;
  }

  // Spending per motive (proportional via junction table, netto, exclude drafts)
  const motiveSpending = {};
  db.prepare(
    `
    SELECT bm.motive_id, SUM(b.netto_amount * bm.percentage / 100) as spent
    FROM bill_motives bm JOIN bills b ON b.id = bm.bill_id
    WHERE b.project_id = ? AND (b.status IS NULL OR b.status = 'confirmed')
    GROUP BY bm.motive_id
  `,
  )
    .all(projectId)
    .forEach((r) => {
      motiveSpending[r.motive_id] = r.spent || 0;
    });

  // Spending per category (proportional via junction table, netto, exclude drafts)
  const categorySpending = {};
  db.prepare(
    `
    SELECT bc.category_id, SUM(b.netto_amount * bc.percentage / 100) as spent
    FROM bill_categories bc JOIN bills b ON b.id = bc.bill_id
    WHERE b.project_id = ? AND (b.status IS NULL OR b.status = 'confirmed')
    GROUP BY bc.category_id
  `,
  )
    .all(projectId)
    .forEach((r) => {
      categorySpending[r.category_id] = r.spent || 0;
    });

  // Spending per cell (motive x category intersection, netto, exclude drafts)
  const cellSpending = {};
  db.prepare(
    `
    SELECT bm.motive_id, bc.category_id,
      SUM(b.netto_amount * bm.percentage / 100 * bc.percentage / 100) as spent
    FROM bill_motives bm
    JOIN bill_categories bc ON bc.bill_id = bm.bill_id
    JOIN bills b ON b.id = bm.bill_id
    WHERE b.project_id = ? AND (b.status IS NULL OR b.status = 'confirmed')
    GROUP BY bm.motive_id, bc.category_id
  `,
  )
    .all(projectId)
    .forEach((r) => {
      cellSpending[r.category_id + "_" + r.motive_id] = r.spent || 0;
    });

  res.json({
    motives,
    categories,
    matrix,
    grandTotal,
    motiveSpending,
    categorySpending,
    cellSpending,
  });
});

router.put("/api/admin/budget-matrix", ensureProjectAdmin, (req, res) => {
  const projectId = req.user.currentProjectId;
  const { cells } = req.body;
  if (!Array.isArray(cells))
    return res.status(400).json({ error: "cells array required" });

  const upsert = db.prepare(
    "INSERT OR REPLACE INTO budget_matrix (motive_id, category_id, amount, project_id) VALUES (?, ?, ?, ?)",
  );
  const runTransaction = db.transaction((cells) => {
    for (const cell of cells) {
      upsert.run(
        cell.motive_id,
        cell.category_id,
        parseFloat(cell.amount) || 0,
        projectId,
      );
    }
  });
  runTransaction(cells);

  res.json({ ok: true });
});

module.exports = router;
