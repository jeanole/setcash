const router = require("express").Router();
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const db = require("../db");
const { findUser, ensureAuth } = require("../middleware");

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: "Too many login attempts. Try again in 15 minutes.",
  standardHeaders: true,
  legacyHeaders: false,
});

// Password validation
function validatePassword(password) {
  if (!password || password.length < 8)
    return "Password must be at least 8 characters";
  if (!/[A-Z]/.test(password)) return "Password must contain uppercase letter";
  if (!/[a-z]/.test(password)) return "Password must contain lowercase letter";
  if (!/[0-9]/.test(password)) return "Password must contain a number";
  return null;
}

// Login page
router.get("/login", (req, res) => {
  if (req.session.user) return res.redirect("/");
  const error =
    req.query.error === "1"
      ? '<div class="message error">Invalid email or password</div>'
      : "";
  res.send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>vBudget - Login</title><link rel="stylesheet" href="/style.css"></head>
<body><h1>vBudget</h1>
<div class="card"><h2>Login</h2>${error}
<form method="POST" action="/login">
<label>Email<input type="email" name="email" required autofocus></label>
<label>Password<div class="password-wrapper"><input type="password" name="password" required><button type="button" class="password-toggle" onclick="togglePw(this)">Show</button></div></label>
<script>function togglePw(btn){const i=btn.previousElementSibling;const show=i.type==='password';i.type=show?'text':'password';btn.textContent=show?'Hide':'Show';}</script>
<button type="submit">Login</button>
</form></div></body></html>`);
});

router.post("/login", loginLimiter, async (req, res) => {
  const { email, password } = req.body;
  const user = findUser(email);
  if (!user || !bcrypt.compareSync(password, user.hash)) {
    return res.redirect("/login?error=1");
  }
  const superAdmin = user.super_admin === 1;

  // Auto-select project if user is member of exactly one project
  let currentProjectId = null;
  let currentProjectRole = null;
  let currentProjectName = null;

  if (superAdmin) {
    const projects = db.prepare("SELECT * FROM projects ORDER BY id").all();
    // Try default project first
    if (user.default_project_id) {
      const defProject = projects.find((p) => p.id === user.default_project_id);
      if (defProject) {
        currentProjectId = defProject.id;
        currentProjectName = defProject.name;
        const membership = db
          .prepare(
            "SELECT project_role FROM project_members WHERE project_id = ? AND LOWER(user_email) = LOWER(?)",
          )
          .get(currentProjectId, email);
        currentProjectRole = membership ? membership.project_role : "admin";
      }
    }
    // Fall back: auto-select if only one project
    if (!currentProjectId && projects.length === 1) {
      currentProjectId = projects[0].id;
      currentProjectName = projects[0].name;
      const membership = db
        .prepare(
          "SELECT project_role FROM project_members WHERE project_id = ? AND LOWER(user_email) = LOWER(?)",
        )
        .get(currentProjectId, email);
      currentProjectRole = membership ? membership.project_role : "admin";
    }
  } else {
    const memberships = db
      .prepare(
        `
      SELECT pm.project_id, pm.project_role, p.name
      FROM project_members pm JOIN projects p ON p.id = pm.project_id
      WHERE LOWER(pm.user_email) = LOWER(?)
    `,
      )
      .all(email);
    // Try default project first
    if (user.default_project_id) {
      const defMembership = memberships.find(
        (m) => m.project_id === user.default_project_id,
      );
      if (defMembership) {
        currentProjectId = defMembership.project_id;
        currentProjectRole = defMembership.project_role;
        currentProjectName = defMembership.name;
      }
    }
    // Fall back: auto-select if only one project
    if (!currentProjectId && memberships.length === 1) {
      currentProjectId = memberships[0].project_id;
      currentProjectRole = memberships[0].project_role;
      currentProjectName = memberships[0].name;
    }
  }

  req.session.user = {
    email: user.email,
    superAdmin,
    currentProjectId,
    currentProjectRole,
    currentProjectName,
  };
  res.redirect("/");
});

router.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/login");
});

// API: Set default project for current user
router.put("/api/user/default-project", ensureAuth, (req, res) => {
  const { projectId } = req.body;
  const email = req.session.user.email;

  if (projectId !== null) {
    // Validate membership (or super admin)
    if (!req.session.user.superAdmin) {
      const membership = db
        .prepare(
          "SELECT 1 FROM project_members WHERE project_id = ? AND LOWER(user_email) = LOWER(?)",
        )
        .get(projectId, email);
      if (!membership)
        return res.status(403).json({ error: "Not a member of this project" });
    }
    const project = db
      .prepare("SELECT id FROM projects WHERE id = ?")
      .get(projectId);
    if (!project) return res.status(404).json({ error: "Project not found" });
  }

  db.prepare(
    "UPDATE users SET default_project_id = ? WHERE LOWER(email) = LOWER(?)",
  ).run(projectId, email);
  res.json({ ok: true, defaultProjectId: projectId });
});

module.exports = router;
module.exports.validatePassword = validatePassword;
