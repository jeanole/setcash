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
  const errorHtml = req.query.error === "1"
    ? `<div class="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
        <svg class="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>
        <span>Invalid email or password</span>
       </div>`
    : "";
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>vBudget — Login</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: { extend: { fontFamily: { sans: ["Inter","system-ui","-apple-system","sans-serif"] } } }
    };
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body class="font-sans min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col items-center justify-center p-4">

  <!-- Background decoration -->
  <div class="absolute inset-0 overflow-hidden pointer-events-none">
    <div class="absolute -top-40 -right-40 w-96 h-96 bg-indigo-500 rounded-full opacity-10 blur-3xl"></div>
    <div class="absolute -bottom-40 -left-40 w-96 h-96 bg-violet-500 rounded-full opacity-10 blur-3xl"></div>
  </div>

  <div class="relative w-full max-w-md">

    <!-- Brand header -->
    <div class="text-center mb-8">
      <div class="inline-flex items-center justify-center w-14 h-14 bg-indigo-600 rounded-2xl shadow-lg mb-4">
        <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z"/>
        </svg>
      </div>
      <h1 class="text-3xl font-bold text-white tracking-tight">vBudget</h1>
      <p class="text-indigo-300 text-sm mt-1">Expense tracking for film &amp; media productions</p>
    </div>

    <!-- Login card -->
    <div class="bg-white rounded-2xl shadow-2xl p-8">
      <h2 class="text-xl font-semibold text-slate-800 mb-6">Sign in to your account</h2>

      ${errorHtml}

      <form method="POST" action="/login" class="space-y-5">
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1.5" for="email">Email address</label>
          <input
            id="email" type="email" name="email" required autofocus
            class="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
            placeholder="you@example.com"
          >
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1.5" for="password">Password</label>
          <div class="relative">
            <input
              id="password" type="password" name="password" required
              class="w-full px-4 py-2.5 pr-12 rounded-lg border border-slate-300 text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              placeholder="••••••••"
            >
            <button type="button" onclick="togglePw(this)"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
              aria-label="Toggle password visibility">
              <svg id="eye-show" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/>
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
              <svg id="eye-hide" class="w-5 h-5 hidden" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"/>
              </svg>
            </button>
          </div>
        </div>

        <button type="submit"
          class="w-full bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold py-2.5 px-4 rounded-lg text-sm transition shadow-sm mt-2">
          Sign in
        </button>
      </form>
    </div>

    <p class="text-center text-slate-500 text-xs mt-6">vBudget &copy; ${new Date().getFullYear()}</p>
  </div>

  <script>
    function togglePw(btn) {
      const input = document.getElementById('password');
      const showIcon = document.getElementById('eye-show');
      const hideIcon = document.getElementById('eye-hide');
      const isHidden = input.type === 'password';
      input.type = isHidden ? 'text' : 'password';
      showIcon.classList.toggle('hidden', isHidden);
      hideIcon.classList.toggle('hidden', !isHidden);
    }
  </script>
</body>
</html>`);
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
