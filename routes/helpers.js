const db = require("../db");

// Helper to get all settings as object (optionally scoped to a project)
function getSettings(projectId) {
  let rows;
  if (projectId) {
    rows = db
      .prepare("SELECT key, value FROM project_settings WHERE project_id = ?")
      .all(projectId);
    // Fall back to global settings for keys not in project_settings
    const globalRows = db.prepare("SELECT key, value FROM settings").all();
    const keys = new Set(rows.map((r) => r.key));
    for (const r of globalRows) {
      if (!keys.has(r.key)) rows.push(r);
    }
  } else {
    rows = db.prepare("SELECT key, value FROM settings").all();
  }
  const settings = {};
  for (const row of rows) {
    try {
      settings[row.key] = JSON.parse(row.value);
    } catch (e) {
      settings[row.key] = row.value;
    }
  }
  return settings;
}

// Helper: save allocations for a bill
function saveAllocations(
  billId,
  motiveAllocations,
  categoryAllocations,
  projectId,
) {
  db.prepare("DELETE FROM bill_motives WHERE bill_id = ?").run(billId);
  db.prepare("DELETE FROM bill_categories WHERE bill_id = ?").run(billId);

  // Get default IDs scoped to project
  const uncatMotive = projectId
    ? db
        .prepare("SELECT id FROM motives WHERE name = ? AND project_id = ?")
        .get("Default", projectId)
    : db.prepare("SELECT id FROM motives WHERE name = ?").get("Default");
  const uncatCategory = projectId
    ? db
        .prepare("SELECT id FROM categories WHERE name = ? AND project_id = ?")
        .get("Uncategorized", projectId)
    : db
        .prepare("SELECT id FROM categories WHERE name = ?")
        .get("Uncategorized");

  // Save motive allocations
  if (Array.isArray(motiveAllocations)) {
    const insertMotive = db.prepare(
      "INSERT OR IGNORE INTO bill_motives (bill_id, motive_id, percentage) VALUES (?, ?, ?)",
    );
    let totalMotivePct = 0;
    for (const a of motiveAllocations) {
      if (a.motiveId && a.percentage > 0) {
        const pct = Math.round(a.percentage);
        insertMotive.run(billId, a.motiveId, pct);
        totalMotivePct += pct;
      }
    }
    // Add uncategorized for remaining percentage
    if (totalMotivePct < 100 && uncatMotive) {
      const remaining = 100 - totalMotivePct;
      insertMotive.run(billId, uncatMotive.id, remaining);
    }
  } else if (uncatMotive) {
    // No allocations provided, allocate 100% to uncategorized
    db.prepare(
      "INSERT INTO bill_motives (bill_id, motive_id, percentage) VALUES (?, ?, 100)",
    ).run(billId, uncatMotive.id);
  }

  // Save category allocations
  if (Array.isArray(categoryAllocations)) {
    const insertCat = db.prepare(
      "INSERT OR IGNORE INTO bill_categories (bill_id, category_id, percentage) VALUES (?, ?, ?)",
    );
    let totalCatPct = 0;
    for (const a of categoryAllocations) {
      if (a.categoryId && a.percentage > 0) {
        const pct = Math.round(a.percentage);
        insertCat.run(billId, a.categoryId, pct);
        totalCatPct += pct;
      }
    }
    // Add uncategorized for remaining percentage
    if (totalCatPct < 100 && uncatCategory) {
      const remaining = 100 - totalCatPct;
      insertCat.run(billId, uncatCategory.id, remaining);
    }
  } else if (uncatCategory) {
    // No allocations provided, allocate 100% to uncategorized
    db.prepare(
      "INSERT INTO bill_categories (bill_id, category_id, percentage) VALUES (?, ?, 100)",
    ).run(billId, uncatCategory.id);
  }
}

// Helper: build motive display string from allocations
function getMotiveDisplayString(billId) {
  const allocs = db
    .prepare(
      `
    SELECT m.name, bm.percentage FROM bill_motives bm
    JOIN motives m ON m.id = bm.motive_id
    WHERE bm.bill_id = ?
  `,
    )
    .all(billId);
  if (allocs.length === 0) return "";
  if (allocs.length === 1 && allocs[0].percentage === 100)
    return allocs[0].name;
  return allocs.map((a) => `${a.name} (${a.percentage}%)`).join(", ");
}

module.exports = { getSettings, saveAllocations, getMotiveDisplayString };
