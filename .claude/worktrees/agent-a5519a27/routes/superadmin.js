const router = require("express").Router();
const path = require("path");
const bcrypt = require("bcryptjs");
const db = require("../db");
const { initProjectDefaults } = require("../db");
const { findUser, ensureSuperAdmin } = require("../middleware");
const { validatePassword } = require("./auth");

// Super-admin page
router.get("/superadmin", ensureSuperAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "superadmin.html"));
});

// ==== Super-Admin API Routes ====

// Projects CRUD
router.get("/api/superadmin/projects", ensureSuperAdmin, (req, res) => {
  const projects = db
    .prepare(
      `
    SELECT p.*, COUNT(pm.id) as member_count
    FROM projects p LEFT JOIN project_members pm ON pm.project_id = p.id
    GROUP BY p.id ORDER BY p.id
  `,
    )
    .all();
  res.json(projects);
});

router.post("/api/superadmin/projects", ensureSuperAdmin, (req, res) => {
  const { name, subtitle } = req.body;
  if (!name) return res.status(400).json({ error: "Project name required" });
  const result = db
    .prepare("INSERT INTO projects (name, subtitle) VALUES (?, ?)")
    .run(name, subtitle || null);
  const projectId = result.lastInsertRowid;
  initProjectDefaults(projectId);
  res.json({ ok: true, id: projectId });
});

router.put("/api/superadmin/projects/:id", ensureSuperAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  const project = db.prepare("SELECT id FROM projects WHERE id = ?").get(id);
  if (!project) return res.status(404).json({ error: "Not found" });
  const { name, subtitle } = req.body;
  const updates = [];
  const params = [];
  if (name !== undefined) {
    updates.push("name = ?");
    params.push(name);
  }
  if (subtitle !== undefined) {
    updates.push("subtitle = ?");
    params.push(subtitle || null);
  }
  if (updates.length > 0) {
    params.push(id);
    db.prepare(`UPDATE projects SET ${updates.join(", ")} WHERE id = ?`).run(
      ...params,
    );
  }
  res.json({ ok: true });
});

router.delete("/api/superadmin/projects/:id", ensureSuperAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  const project = db.prepare("SELECT id FROM projects WHERE id = ?").get(id);
  if (!project) return res.status(404).json({ error: "Not found" });
  // Note: CASCADE will delete project_members, project_positions, project_settings
  // Bills, motives, categories etc. have project_id set to null (not CASCADE) -- clean them up
  for (const table of [
    "bills",
    "motives",
    "categories",
    "vgeld",
    "editlog",
    "budget_matrix",
  ]) {
    db.prepare(`DELETE FROM ${table} WHERE project_id = ?`).run(id);
  }
  db.prepare("DELETE FROM projects WHERE id = ?").run(id);
  res.json({ ok: true });
});

// Super-admin: Global users CRUD
router.get("/api/superadmin/users", ensureSuperAdmin, (req, res) => {
  const users = db
    .prepare(
      `
    SELECT u.id, u.email, u.admin, u.super_admin,
           COUNT(pm.id) as project_count
    FROM users u LEFT JOIN project_members pm ON LOWER(pm.user_email) = LOWER(u.email)
    GROUP BY u.id ORDER BY u.email
  `,
    )
    .all();
  res.json(
    users.map((u) => ({
      id: u.id,
      email: u.email,
      admin: u.admin === 1,
      superAdmin: u.super_admin === 1,
      projectCount: u.project_count,
    })),
  );
});

router.post("/api/superadmin/users", ensureSuperAdmin, async (req, res) => {
  const { email, password, superAdmin } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email and password required" });
  const pwError = validatePassword(password);
  if (pwError) return res.status(400).json({ error: pwError });
  if (findUser(email))
    return res.status(400).json({ error: "User already exists" });
  const hash = await bcrypt.hash(password, 12);
  const result = db
    .prepare(
      "INSERT INTO users (email, hash, admin, super_admin) VALUES (?, ?, ?, ?)",
    )
    .run(email, hash, superAdmin ? 1 : 0, superAdmin ? 1 : 0);
  res.json({ ok: true, id: result.lastInsertRowid });
});

router.put("/api/superadmin/users/:email", ensureSuperAdmin, async (req, res) => {
  const user = findUser(req.params.email);
  if (!user) return res.status(404).json({ error: "User not found" });
  const { password, superAdmin } = req.body;
  const updates = [];
  const params = [];
  if (password) {
    const pwError = validatePassword(password);
    if (pwError) return res.status(400).json({ error: pwError });
    const hash = await bcrypt.hash(password, 12);
    updates.push("hash = ?");
    params.push(hash);
  }
  if (superAdmin !== undefined) {
    updates.push("super_admin = ?");
    params.push(superAdmin ? 1 : 0);
  }
  if (updates.length > 0) {
    params.push(user.id);
    db.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).run(
      ...params,
    );
  }
  res.json({ ok: true });
});

router.delete("/api/superadmin/users/:email", ensureSuperAdmin, (req, res) => {
  const user = findUser(req.params.email);
  if (!user) return res.status(404).json({ error: "User not found" });
  if (user.email.toLowerCase() === req.session.user.email.toLowerCase()) {
    return res.status(400).json({ error: "Cannot delete yourself" });
  }
  db.prepare(
    "DELETE FROM project_members WHERE LOWER(user_email) = LOWER(?)",
  ).run(user.email);
  db.prepare("DELETE FROM users WHERE id = ?").run(user.id);
  res.json({ ok: true });
});

// Super-admin: Project members
router.get(
  "/api/superadmin/projects/:id/members",
  ensureSuperAdmin,
  (req, res) => {
    const projectId = parseInt(req.params.id);
    const members = db
      .prepare(
        `
    SELECT pm.id, pm.user_email as email, pm.project_role, pm.position_id,
           COALESCE(pp.name, 'Misc') as position_name
    FROM project_members pm
    LEFT JOIN project_positions pp ON pp.id = pm.position_id
    WHERE pm.project_id = ?
    ORDER BY pm.user_email
  `,
      )
      .all(projectId);
    res.json(
      members.map((m) => ({
        id: m.id,
        email: m.email,
        projectRole: m.project_role,
        positionId: m.position_id,
        positionName: m.position_name,
      })),
    );
  },
);

router.post(
  "/api/superadmin/projects/:id/members",
  ensureSuperAdmin,
  (req, res) => {
    const projectId = parseInt(req.params.id);
    const { email, projectRole, positionId } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });
    const foundUser = findUser(email);
    if (!foundUser) return res.status(400).json({ error: "User not found" });
    try {
      const result = db
        .prepare(
          "INSERT INTO project_members (project_id, user_email, project_role, position_id) VALUES (?, ?, ?, ?)",
        )
        .run(
          projectId,
          foundUser.email,
          projectRole || "user",
          positionId || null,
        );
      res.json({ ok: true, id: result.lastInsertRowid });
    } catch (e) {
      if (e.message.includes("UNIQUE"))
        return res.status(400).json({ error: "User is already a member" });
      throw e;
    }
  },
);

router.put(
  "/api/superadmin/projects/:id/members/:memberId",
  ensureSuperAdmin,
  (req, res) => {
    const projectId = parseInt(req.params.id);
    const memberId = parseInt(req.params.memberId);
    const member = db
      .prepare("SELECT * FROM project_members WHERE id = ? AND project_id = ?")
      .get(memberId, projectId);
    if (!member) return res.status(404).json({ error: "Member not found" });
    const { projectRole, positionId } = req.body;
    const updates = [];
    const params = [];
    if (projectRole !== undefined) {
      updates.push("project_role = ?");
      params.push(projectRole);
    }
    if (positionId !== undefined) {
      updates.push("position_id = ?");
      params.push(positionId || null);
    }
    if (updates.length > 0) {
      params.push(memberId);
      db.prepare(
        `UPDATE project_members SET ${updates.join(", ")} WHERE id = ?`,
      ).run(...params);
    }
    res.json({ ok: true });
  },
);

router.delete(
  "/api/superadmin/projects/:id/members/:memberId",
  ensureSuperAdmin,
  (req, res) => {
    const projectId = parseInt(req.params.id);
    const memberId = parseInt(req.params.memberId);
    const result = db
      .prepare("DELETE FROM project_members WHERE id = ? AND project_id = ?")
      .run(memberId, projectId);
    if (result.changes === 0)
      return res.status(404).json({ error: "Member not found" });
    res.json({ ok: true });
  },
);

// Super-admin: Positions per project
router.get(
  "/api/superadmin/projects/:id/positions",
  ensureSuperAdmin,
  (req, res) => {
    const projectId = parseInt(req.params.id);
    const positions = db
      .prepare(
        "SELECT * FROM project_positions WHERE project_id = ? ORDER BY id",
      )
      .all(projectId);
    res.json(positions);
  },
);

router.post(
  "/api/superadmin/projects/:id/positions",
  ensureSuperAdmin,
  (req, res) => {
    const projectId = parseInt(req.params.id);
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Name required" });
    try {
      const result = db
        .prepare(
          "INSERT INTO project_positions (project_id, name) VALUES (?, ?)",
        )
        .run(projectId, name);
      res.json({ ok: true, id: result.lastInsertRowid });
    } catch (e) {
      if (e.message.includes("UNIQUE"))
        return res.status(400).json({ error: "Position already exists" });
      throw e;
    }
  },
);

router.put(
  "/api/superadmin/projects/:id/positions/:posId",
  ensureSuperAdmin,
  (req, res) => {
    const projectId = parseInt(req.params.id);
    const posId = parseInt(req.params.posId);
    const pos = db
      .prepare(
        "SELECT * FROM project_positions WHERE id = ? AND project_id = ?",
      )
      .get(posId, projectId);
    if (!pos) return res.status(404).json({ error: "Not found" });
    if (pos.name === "Misc")
      return res.status(400).json({ error: "Cannot edit Misc position" });
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Name required" });
    db.prepare("UPDATE project_positions SET name = ? WHERE id = ?").run(
      name,
      posId,
    );
    res.json({ ok: true });
  },
);

router.delete(
  "/api/superadmin/projects/:id/positions/:posId",
  ensureSuperAdmin,
  (req, res) => {
    const projectId = parseInt(req.params.id);
    const posId = parseInt(req.params.posId);
    const pos = db
      .prepare(
        "SELECT * FROM project_positions WHERE id = ? AND project_id = ?",
      )
      .get(posId, projectId);
    if (!pos) return res.status(404).json({ error: "Not found" });
    if (pos.name === "Misc")
      return res.status(400).json({ error: "Cannot delete Misc position" });
    db.prepare(
      "UPDATE project_members SET position_id = NULL WHERE position_id = ?",
    ).run(posId);
    db.prepare("DELETE FROM project_positions WHERE id = ?").run(posId);
    res.json({ ok: true });
  },
);

module.exports = router;
