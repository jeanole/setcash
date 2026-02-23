const db = require("./db");

function findUser(email) {
  return db
    .prepare("SELECT * FROM users WHERE LOWER(email) = LOWER(?)")
    .get(email);
}

function ensureAuth(req, res, next) {
  if (req.session && req.session.user) {
    req.user = req.session.user;
    return next();
  }
  if (req.path.startsWith("/api/"))
    return res.status(401).json({ error: "Not logged in" });
  res.redirect("/login");
}

function ensureSuperAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.superAdmin) {
    req.user = req.session.user;
    return next();
  }
  if (req.path.startsWith("/api/"))
    return res.status(403).json({ error: "Super-admin required" });
  res.status(403).send("Super-admin access required");
}

function ensureProjectAccess(req, res, next) {
  if (!req.session || !req.session.user) {
    if (req.path.startsWith("/api/"))
      return res.status(401).json({ error: "Not logged in" });
    return res.redirect("/login");
  }
  req.user = req.session.user;
  // Super-admins bypass project membership check
  if (req.user.superAdmin) return next();
  if (!req.user.currentProjectId) {
    return res.status(403).json({ error: "No project selected" });
  }
  return next();
}

function ensureProjectAdmin(req, res, next) {
  if (!req.session || !req.session.user) {
    if (req.path.startsWith("/api/"))
      return res.status(401).json({ error: "Not logged in" });
    return res.redirect("/login");
  }
  req.user = req.session.user;
  if (req.user.superAdmin) return next();
  if (!req.user.currentProjectId) {
    if (req.path.startsWith("/api/"))
      return res.status(403).json({ error: "No project selected" });
    return res.status(403).send("No project selected");
  }
  if (
    req.user.currentProjectRole !== "admin" &&
    req.user.currentProjectRole !== "owner"
  ) {
    if (req.path.startsWith("/api/"))
      return res.status(403).json({ error: "Project admin required" });
    return res.status(403).send("Project admin access required");
  }
  return next();
}

function ensureProjectOwner(req, res, next) {
  if (!req.session || !req.session.user) {
    if (req.path.startsWith("/api/"))
      return res.status(401).json({ error: "Not logged in" });
    return res.redirect("/login");
  }
  req.user = req.session.user;
  if (req.user.superAdmin) return next();
  if (!req.user.currentProjectId) {
    if (req.path.startsWith("/api/"))
      return res.status(403).json({ error: "No project selected" });
    return res.status(403).send("No project selected");
  }
  if (req.user.currentProjectRole !== "owner") {
    if (req.path.startsWith("/api/"))
      return res.status(403).json({ error: "Project owner required" });
    return res.status(403).send("Project owner access required");
  }
  return next();
}

module.exports = {
  findUser,
  ensureAuth,
  ensureSuperAdmin,
  ensureProjectAccess,
  ensureProjectAdmin,
  ensureProjectOwner,
};
