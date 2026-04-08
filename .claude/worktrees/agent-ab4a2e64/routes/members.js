const router = require("express").Router();
const bcrypt = require("bcryptjs");
const db = require("../db");
const { findUser, ensureAuth, ensureProjectAccess, ensureProjectAdmin, ensureSuperAdmin } = require("../middleware");
const { validatePassword } = require("./auth");

// API: Users list for dropdowns (members of current project)
router.get("/api/users", ensureProjectAccess, (req, res) => {
  const projectId = req.user.currentProjectId;
  const users = db
    .prepare(
      `
    SELECT DISTINCT pm.user_email as email
    FROM project_members pm
    WHERE pm.project_id = ?
    ORDER BY pm.user_email
  `,
    )
    .all(projectId);
  res.json(users);
});

// API: Project members (project-admin)
router.get("/api/admin/project/members", ensureProjectAdmin, (req, res) => {
  const projectId = req.user.currentProjectId;
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
});

router.post("/api/admin/project/members", ensureProjectAdmin, (req, res) => {
  const projectId = req.user.currentProjectId;
  const { email, projectRole, positionId } = req.body;
  if (!email) return res.status(400).json({ error: "Email required" });
  const validRoles = ["user", "admin", "owner"];
  const role = projectRole || "user";
  if (!validRoles.includes(role))
    return res.status(400).json({ error: "Invalid role" });
  // Only owners/super-admins can assign owner role
  if (
    role === "owner" &&
    !req.user.superAdmin &&
    req.user.currentProjectRole !== "owner"
  )
    return res.status(403).json({ error: "Only owners can assign owner role" });
  const foundUser = findUser(email);
  if (!foundUser) return res.status(400).json({ error: "User not found" });
  try {
    const result = db
      .prepare(
        "INSERT INTO project_members (project_id, user_email, project_role, position_id) VALUES (?, ?, ?, ?)",
      )
      .run(projectId, foundUser.email, role, positionId || null);
    // Notify the invited user
    const project = db.prepare("SELECT name FROM projects WHERE id = ?").get(projectId);
    const projectName = project ? project.name : "a project";
    db.prepare(
      "INSERT INTO notifications (user_email, type, message, project_id) VALUES (?, ?, ?, ?)",
    ).run(
      foundUser.email,
      "project_invite",
      `You have been added to "${projectName}" as ${role}.`,
      projectId,
    );
    res.json({ ok: true, id: result.lastInsertRowid });
  } catch (e) {
    if (e.message.includes("UNIQUE"))
      return res.status(400).json({ error: "User is already a member" });
    throw e;
  }
});

router.put("/api/admin/project/members/:id", ensureProjectAdmin, (req, res) => {
  const projectId = req.user.currentProjectId;
  const id = parseInt(req.params.id);
  const member = db
    .prepare("SELECT * FROM project_members WHERE id = ? AND project_id = ?")
    .get(id, projectId);
  if (!member) return res.status(404).json({ error: "Member not found" });
  const { projectRole, positionId } = req.body;
  const updates = [];
  const params = [];
  if (projectRole !== undefined) {
    const validRoles = ["user", "admin", "owner"];
    if (!validRoles.includes(projectRole))
      return res.status(400).json({ error: "Invalid role" });
    // Only owners/super-admins can promote to/demote from owner
    if (
      (projectRole === "owner" || member.project_role === "owner") &&
      !req.user.superAdmin &&
      req.user.currentProjectRole !== "owner"
    )
      return res
        .status(403)
        .json({ error: "Only owners can change owner role" });
    updates.push("project_role = ?");
    params.push(projectRole);
  }
  if (positionId !== undefined) {
    updates.push("position_id = ?");
    params.push(positionId || null);
  }
  if (updates.length > 0) {
    params.push(id);
    db.prepare(
      `UPDATE project_members SET ${updates.join(", ")} WHERE id = ?`,
    ).run(...params);
  }
  res.json({ ok: true });
});

router.delete("/api/admin/project/members/:id", ensureProjectAdmin, (req, res) => {
  const projectId = req.user.currentProjectId;
  const id = parseInt(req.params.id);
  const member = db
    .prepare("SELECT * FROM project_members WHERE id = ? AND project_id = ?")
    .get(id, projectId);
  if (!member) return res.status(404).json({ error: "Member not found" });
  db.prepare("DELETE FROM project_members WHERE id = ?").run(id);
  res.json({ ok: true });
});

// Super-admin user management
router.get("/api/admin/users", ensureSuperAdmin, (req, res) => {
  const users = db
    .prepare(
      `SELECT u.id, u.email, u.super_admin FROM users u ORDER BY u.email`,
    )
    .all();
  res.json(
    users.map((u) => ({
      id: u.id,
      email: u.email,
      superAdmin: u.super_admin === 1,
    })),
  );
});

router.post("/api/admin/users", ensureSuperAdmin, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email and password required" });
  const pwError = validatePassword(password);
  if (pwError) return res.status(400).json({ error: pwError });
  if (findUser(email))
    return res.status(400).json({ error: "User already exists" });
  const hash = await bcrypt.hash(password, 12);
  const result = db
    .prepare("INSERT INTO users (email, hash) VALUES (?, ?)")
    .run(email, hash);
  res.json({ ok: true, id: result.lastInsertRowid });
});

router.put("/api/admin/users/:email", ensureSuperAdmin, async (req, res) => {
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
    params.push(superAdmin === true ? 1 : 0);
  }
  if (updates.length > 0) {
    params.push(user.id);
    db.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).run(
      ...params,
    );
  }
  res.json({ ok: true });
});

router.delete("/api/admin/users/:email", ensureSuperAdmin, (req, res) => {
  const user = findUser(req.params.email);
  if (!user) return res.status(404).json({ error: "User not found" });
  if (user.email.toLowerCase() === req.session.user.email.toLowerCase()) {
    return res.status(400).json({ error: "Cannot delete yourself" });
  }
  db.prepare("DELETE FROM users WHERE id = ?").run(user.id);
  res.json({ ok: true });
});

// Change own password
router.post("/api/user/password", ensureAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword)
    return res.status(400).json({ error: "Both passwords required" });
  const pwError = validatePassword(newPassword);
  if (pwError) return res.status(400).json({ error: pwError });
  const user = findUser(req.user.email);
  if (!bcrypt.compareSync(currentPassword, user.hash))
    return res.status(400).json({ error: "Current password incorrect" });
  const hash = await bcrypt.hash(newPassword, 12);
  db.prepare("UPDATE users SET hash = ? WHERE id = ?").run(hash, user.id);
  res.json({ ok: true });
});

module.exports = router;
