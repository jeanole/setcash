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
    ? `<div class="error-banner">
        <svg width="16" height="16" style="flex-shrink:0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>
        <span>Invalid email or password</span>
       </div>`
    : "";
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>vBudget — Login</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', system-ui, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      overflow: hidden;
      background: #0d0221;
      position: relative;
    }

    /* ── Animated gradient background ── */
    body::before {
      content: '';
      position: fixed;
      inset: -50%;
      background: conic-gradient(
        from 0deg at 50% 50%,
        #ff006e, #fb5607, #ffbe0b, #3a86ff, #8338ec, #ff006e
      );
      animation: spin-bg 12s linear infinite;
      opacity: 0.18;
      filter: blur(60px);
      z-index: 0;
    }

    @keyframes spin-bg {
      to { transform: rotate(360deg); }
    }

    /* ── Floating blobs ── */
    .blob {
      position: fixed;
      border-radius: 50%;
      filter: blur(55px);
      opacity: 0.55;
      pointer-events: none;
      z-index: 0;
    }
    .blob-1 { width: 420px; height: 420px; background: #ff006e; top: -100px; left: -120px; animation: float1 9s ease-in-out infinite; }
    .blob-2 { width: 380px; height: 380px; background: #3a86ff; bottom: -100px; right: -100px; animation: float2 11s ease-in-out infinite; }
    .blob-3 { width: 300px; height: 300px; background: #ffbe0b; top: 40%; left: 55%; animation: float3 7s ease-in-out infinite; }
    .blob-4 { width: 260px; height: 260px; background: #8338ec; top: 10%; right: 15%; animation: float4 13s ease-in-out infinite; }
    .blob-5 { width: 220px; height: 220px; background: #06d6a0; bottom: 15%; left: 10%; animation: float5 8s ease-in-out infinite; }
    .blob-6 { width: 180px; height: 180px; background: #fb5607; top: 55%; left: 20%; animation: float6 10s ease-in-out infinite; }

    @keyframes float1 { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(60px,-40px) scale(1.08)} 66%{transform:translate(-30px,50px) scale(0.95)} }
    @keyframes float2 { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(-50px,30px) scale(1.1)} 66%{transform:translate(40px,-60px) scale(0.92)} }
    @keyframes float3 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-70px,40px) scale(1.15)} }
    @keyframes float4 { 0%,100%{transform:translate(0,0) rotate(0deg)} 50%{transform:translate(30px,60px) rotate(45deg) scale(1.2)} }
    @keyframes float5 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(80px,-30px) scale(0.85)} }
    @keyframes float6 { 0%,100%{transform:translate(0,0)} 33%{transform:translate(-40px,-50px) scale(1.1)} 66%{transform:translate(50px,20px) scale(0.9)} }

    /* ── Orbiting ring of dots ── */
    .orbit {
      position: fixed;
      top: 50%; left: 50%;
      width: 700px; height: 700px;
      margin: -350px 0 0 -350px;
      animation: orbit-spin 20s linear infinite;
      z-index: 0;
      pointer-events: none;
    }
    .orbit-dot {
      position: absolute;
      width: 14px; height: 14px;
      border-radius: 50%;
      top: 50%; left: 50%;
    }
    .orbit-dot:nth-child(1)  { background:#ff006e; transform:rotate(0deg)   translateX(350px) translateY(-50%); }
    .orbit-dot:nth-child(2)  { background:#fb5607; transform:rotate(45deg)  translateX(350px) translateY(-50%); }
    .orbit-dot:nth-child(3)  { background:#ffbe0b; transform:rotate(90deg)  translateX(350px) translateY(-50%); }
    .orbit-dot:nth-child(4)  { background:#06d6a0; transform:rotate(135deg) translateX(350px) translateY(-50%); }
    .orbit-dot:nth-child(5)  { background:#3a86ff; transform:rotate(180deg) translateX(350px) translateY(-50%); }
    .orbit-dot:nth-child(6)  { background:#8338ec; transform:rotate(225deg) translateX(350px) translateY(-50%); }
    .orbit-dot:nth-child(7)  { background:#ff006e; transform:rotate(270deg) translateX(350px) translateY(-50%); }
    .orbit-dot:nth-child(8)  { background:#ffbe0b; transform:rotate(315deg) translateX(350px) translateY(-50%); }
    @keyframes orbit-spin { to { transform: rotate(360deg); } }

    /* ── Card wrapper ── */
    .card-wrap {
      position: relative;
      z-index: 10;
      width: 100%;
      max-width: 420px;
      animation: card-entrance 0.7s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
    }
    @keyframes card-entrance {
      from { opacity:0; transform: scale(0.7) translateY(40px); }
      to   { opacity:1; transform: scale(1) translateY(0); }
    }

    /* ── Brand header ── */
    .brand {
      text-align: center;
      margin-bottom: 1.5rem;
    }
    .logo-ring {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 72px; height: 72px;
      border-radius: 24px;
      background: linear-gradient(135deg, #ff006e, #fb5607, #ffbe0b);
      box-shadow: 0 0 40px rgba(255,0,110,0.6), 0 0 80px rgba(251,86,7,0.3);
      margin-bottom: 1rem;
      animation: logo-wobble 3s ease-in-out infinite;
    }
    @keyframes logo-wobble {
      0%,100% { transform: rotate(-4deg) scale(1); }
      25%      { transform: rotate(4deg) scale(1.07); }
      50%      { transform: rotate(-2deg) scale(0.95); }
      75%      { transform: rotate(6deg) scale(1.05); }
    }
    .logo-ring svg { width: 38px; height: 38px; color: #fff; animation: icon-spin 8s linear infinite; }
    @keyframes icon-spin { 50% { transform: rotateY(180deg); } }

    .brand-title {
      font-size: 2.8rem;
      font-weight: 900;
      letter-spacing: -1px;
      background: linear-gradient(90deg, #ff006e, #fb5607, #ffbe0b, #06d6a0, #3a86ff, #8338ec, #ff006e);
      background-size: 300%;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      animation: rainbow-text 5s linear infinite;
    }
    @keyframes rainbow-text { to { background-position: 300% center; } }

    .brand-sub {
      color: rgba(255,255,255,0.7);
      font-size: 0.875rem;
      margin-top: 0.25rem;
      animation: pulse-sub 2.5s ease-in-out infinite;
    }
    @keyframes pulse-sub { 0%,100%{opacity:.7} 50%{opacity:1} }

    /* ── Login card ── */
    .card {
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.18);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border-radius: 24px;
      padding: 2rem;
      box-shadow: 0 8px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.2);
      animation: card-wobble 6s ease-in-out infinite;
    }
    @keyframes card-wobble {
      0%,100% { transform: rotate(0deg) translateY(0px); }
      20%      { transform: rotate(-0.4deg) translateY(-3px); }
      40%      { transform: rotate(0.5deg) translateY(2px); }
      60%      { transform: rotate(-0.3deg) translateY(-2px); }
      80%      { transform: rotate(0.4deg) translateY(1px); }
    }

    .card-title {
      font-size: 1.125rem;
      font-weight: 700;
      color: #fff;
      margin-bottom: 1.5rem;
    }

    /* ── Error banner ── */
    .error-banner {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(255,0,110,0.15);
      border: 1px solid rgba(255,0,110,0.4);
      color: #ff6b9d;
      font-size: 0.875rem;
      border-radius: 10px;
      padding: 0.75rem 1rem;
      margin-bottom: 1rem;
      animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
    }
    @keyframes shake {
      10%,90%  { transform: translateX(-2px); }
      20%,80%  { transform: translateX(4px); }
      30%,50%,70% { transform: translateX(-6px); }
      40%,60%  { transform: translateX(6px); }
    }

    /* ── Form elements ── */
    .field { margin-bottom: 1.1rem; }
    label {
      display: block;
      font-size: 0.8rem;
      font-weight: 600;
      color: rgba(255,255,255,0.75);
      margin-bottom: 0.4rem;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    input[type="email"], input[type="password"], input[type="text"] {
      width: 100%;
      padding: 0.7rem 1rem;
      border-radius: 12px;
      border: 1.5px solid rgba(255,255,255,0.15);
      background: rgba(255,255,255,0.07);
      color: #fff;
      font-size: 0.9rem;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s, transform 0.15s;
      font-family: inherit;
    }
    input::placeholder { color: rgba(255,255,255,0.3); }
    input:focus {
      border-color: #ff006e;
      box-shadow: 0 0 0 3px rgba(255,0,110,0.25), 0 0 20px rgba(255,0,110,0.2);
      transform: scale(1.01);
    }

    .pw-wrap { position: relative; }
    .pw-toggle {
      position: absolute;
      right: 0.75rem;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      color: rgba(255,255,255,0.4);
      cursor: pointer;
      padding: 0;
      display: flex;
      transition: color 0.2s;
    }
    .pw-toggle:hover { color: rgba(255,255,255,0.8); }

    /* ── Submit button ── */
    .btn-submit {
      width: 100%;
      margin-top: 0.5rem;
      padding: 0.85rem 1rem;
      border: none;
      border-radius: 14px;
      background: linear-gradient(135deg, #ff006e, #fb5607, #ffbe0b);
      background-size: 200%;
      color: #fff;
      font-size: 0.95rem;
      font-weight: 700;
      font-family: inherit;
      letter-spacing: 0.02em;
      cursor: pointer;
      box-shadow: 0 4px 30px rgba(255,0,110,0.5);
      animation: btn-pulse 2.5s ease-in-out infinite, btn-gradient 4s linear infinite;
      transition: transform 0.15s, box-shadow 0.15s;
    }
    @keyframes btn-pulse {
      0%,100% { box-shadow: 0 4px 30px rgba(255,0,110,0.5); }
      50%      { box-shadow: 0 4px 50px rgba(255,0,110,0.8), 0 0 60px rgba(251,86,7,0.4); }
    }
    @keyframes btn-gradient { to { background-position: 200% center; } }
    .btn-submit:hover {
      transform: scale(1.03) translateY(-2px);
      box-shadow: 0 8px 40px rgba(255,0,110,0.7);
      animation: btn-wobble 0.4s ease-in-out infinite, btn-gradient 4s linear infinite;
    }
    @keyframes btn-wobble {
      0%,100% { transform: scale(1.03) translateY(-2px) rotate(0deg); }
      25%      { transform: scale(1.04) translateY(-3px) rotate(-1deg); }
      75%      { transform: scale(1.04) translateY(-3px) rotate(1deg); }
    }
    .btn-submit:active { transform: scale(0.97); }

    /* ── Footer ── */
    .footer {
      text-align: center;
      color: rgba(255,255,255,0.35);
      font-size: 0.75rem;
      margin-top: 1.25rem;
    }

    /* ── Hidden util ── */
    .hidden { display: none !important; }
  </style>
</head>
<body>

  <!-- Animated blobs -->
  <div class="blob blob-1"></div>
  <div class="blob blob-2"></div>
  <div class="blob blob-3"></div>
  <div class="blob blob-4"></div>
  <div class="blob blob-5"></div>
  <div class="blob blob-6"></div>

  <!-- Orbiting dots -->
  <div class="orbit" aria-hidden="true">
    <div class="orbit-dot"></div>
    <div class="orbit-dot"></div>
    <div class="orbit-dot"></div>
    <div class="orbit-dot"></div>
    <div class="orbit-dot"></div>
    <div class="orbit-dot"></div>
    <div class="orbit-dot"></div>
    <div class="orbit-dot"></div>
  </div>

  <div class="card-wrap">

    <!-- Brand header -->
    <div class="brand">
      <div class="logo-ring">
        <svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z"/>
        </svg>
      </div>
      <div class="brand-title">vBudget</div>
      <div class="brand-sub">Expense tracking for film &amp; media productions</div>
    </div>

    <!-- Login card -->
    <div class="card">
      <div class="card-title">Sign in to your account</div>

      ${errorHtml}

      <form method="POST" action="/login">
        <div class="field">
          <label for="email">Email address</label>
          <input id="email" type="email" name="email" required autofocus placeholder="you@example.com">
        </div>

        <div class="field">
          <label for="password">Password</label>
          <div class="pw-wrap">
            <input id="password" type="password" name="password" required placeholder="••••••••" style="padding-right:2.75rem">
            <button type="button" class="pw-toggle" onclick="togglePw()" aria-label="Toggle password visibility">
              <svg id="eye-show" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/>
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
              <svg id="eye-hide" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" class="hidden">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"/>
              </svg>
            </button>
          </div>
        </div>

        <button type="submit" class="btn-submit">Sign in</button>
      </form>
    </div>

    <div class="footer">vBudget &copy; ${new Date().getFullYear()}</div>
  </div>

  <script>
    function togglePw() {
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
