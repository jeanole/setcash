const router = require("express").Router();
const db = require("../db");
const { initProjectDefaults } = require("../db");
const { findUser, ensureAuth, ensureProjectAccess, ensureProjectOwner } = require("../middleware");

// API: Current user
router.get("/api/user", (req, res) => {
  if (!req.session.user) return res.json(null);
  // Include defaultProjectId from DB
  const dbUser = findUser(req.session.user.email);
  res.json({
    ...req.session.user,
    defaultProjectId: dbUser ? dbUser.default_project_id : null,
  });
});

// API: Projects — list accessible projects
router.get("/api/projects", ensureAuth, (req, res) => {
  let projects;
  if (req.session.user.superAdmin) {
    projects = db.prepare("SELECT * FROM projects ORDER BY id").all();
  } else {
    projects = db
      .prepare(
        `
      SELECT p.*, pm.project_role
      FROM projects p
      JOIN project_members pm ON pm.project_id = p.id
      WHERE LOWER(pm.user_email) = LOWER(?)
      ORDER BY p.id
    `,
      )
      .all(req.session.user.email);
  }
  res.json(projects);
});

// API: Select a project
router.post("/api/projects/select/:id", ensureAuth, (req, res) => {
  const projectId = parseInt(req.params.id);
  const project = db
    .prepare("SELECT * FROM projects WHERE id = ?")
    .get(projectId);
  if (!project) return res.status(404).json({ error: "Project not found" });

  // Super-admins can access any project
  if (req.session.user.superAdmin) {
    const membership = db
      .prepare(
        "SELECT project_role FROM project_members WHERE project_id = ? AND LOWER(user_email) = LOWER(?)",
      )
      .get(projectId, req.session.user.email);
    req.session.user.currentProjectId = projectId;
    req.session.user.currentProjectRole = membership
      ? membership.project_role
      : "admin";
    req.session.user.currentProjectName = project.name;
    return res.json({
      ok: true,
      projectId,
      projectName: project.name,
      projectRole: req.session.user.currentProjectRole,
    });
  }

  const membership = db
    .prepare(
      "SELECT project_role FROM project_members WHERE project_id = ? AND LOWER(user_email) = LOWER(?)",
    )
    .get(projectId, req.session.user.email);
  if (!membership)
    return res.status(403).json({ error: "Not a member of this project" });

  req.session.user.currentProjectId = projectId;
  req.session.user.currentProjectRole = membership.project_role;
  req.session.user.currentProjectName = project.name;
  res.json({
    ok: true,
    projectId,
    projectName: project.name,
    projectRole: membership.project_role,
  });
});

// API: Clear project selection
router.post("/api/projects/clear", ensureAuth, (req, res) => {
  req.session.user.currentProjectId = null;
  req.session.user.currentProjectRole = null;
  req.session.user.currentProjectName = null;
  res.json({ ok: true });
});

// API: Create project (any authenticated user becomes owner)
router.post("/api/projects", ensureAuth, (req, res) => {
  const { name, subtitle } = req.body;
  if (!name) return res.status(400).json({ error: "Project name required" });
  const result = db
    .prepare("INSERT INTO projects (name, subtitle) VALUES (?, ?)")
    .run(name, subtitle || null);
  const projectId = result.lastInsertRowid;
  initProjectDefaults(projectId);
  // Add creator as owner
  db.prepare(
    "INSERT INTO project_members (project_id, user_email, project_role) VALUES (?, ?, ?)",
  ).run(projectId, req.user.email, "owner");
  // Auto-select the new project
  req.session.user.currentProjectId = projectId;
  req.session.user.currentProjectRole = "owner";
  req.session.user.currentProjectName = name;
  res.json({ ok: true, id: projectId, name });
});

// API: Delete project (owner only)
router.delete("/api/project", ensureProjectOwner, (req, res) => {
  const projectId = req.user.currentProjectId;
  const DATA_DIR = db.DATA_DIR;
  const fs = require("fs");
  const path = require("path");

  // Delete all associated data
  const tables = [
    "bill_images",
    "bill_motives",
    "bill_categories",
    "editlog",
    "budget_matrix",
    "vgeld",
    "motives",
    "categories",
    "project_positions",
    "project_members",
    "project_settings",
    "telegram_links",
    "telegram_link_codes",
  ];
  // Delete bill images files from disk
  const images = db
    .prepare(
      "SELECT bi.file FROM bill_images bi JOIN bills b ON b.id = bi.bill_id WHERE b.project_id = ?",
    )
    .all(projectId);
  for (const img of images) {
    if (img.file) {
      const filePath = path.join(DATA_DIR, "uploads", img.file);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  }
  // Delete bills (must come after bill_images/bill_motives/bill_categories)
  for (const table of tables) {
    if (table === "editlog" || table === "vgeld") {
      db.prepare(`DELETE FROM ${table} WHERE project_id = ?`).run(projectId);
    } else if (
      table === "bill_images" ||
      table === "bill_motives" ||
      table === "bill_categories"
    ) {
      db.prepare(
        `DELETE FROM ${table} WHERE bill_id IN (SELECT id FROM bills WHERE project_id = ?)`,
      ).run(projectId);
    } else {
      db.prepare(`DELETE FROM ${table} WHERE project_id = ?`).run(projectId);
    }
  }
  db.prepare("DELETE FROM bills WHERE project_id = ?").run(projectId);
  db.prepare("DELETE FROM projects WHERE id = ?").run(projectId);
  // Clear session project
  req.session.user.currentProjectId = null;
  req.session.user.currentProjectRole = null;
  req.session.user.currentProjectName = null;
  res.json({ ok: true });
});

// API: Project info (public - no auth required)
router.get("/api/project-info", (req, res) => {
  const { getSettings } = require("./helpers");
  const projectId = req.session?.user?.currentProjectId || null;
  const settings = getSettings(projectId);
  // Fall back to global settings if no project
  const globalSettings = getSettings();
  const pkg = require("../package.json");
  // Get project name and subtitle directly from projects table (source of truth)
  const project = projectId
    ? db.prepare("SELECT name, subtitle FROM projects WHERE id = ?").get(projectId)
    : null;
  res.json({
    projectTitle: settings.projectTitle || globalSettings.projectTitle || "",
    projectSubtitle: project ? (project.subtitle || "") : (settings.projectSubtitle || globalSettings.projectSubtitle || ""),
    projectName: project ? project.name : null,
    version: pkg.version,
    currentProjectId: projectId,
    currentProjectName: req.session?.user?.currentProjectName || null,
  });
});

module.exports = router;
