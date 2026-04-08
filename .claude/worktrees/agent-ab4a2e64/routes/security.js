const router = require("express").Router();
const crypto = require("crypto");
const { ensureAuth } = require("../middleware");

// Issue a CSRF token tied to the current session for use by SPA/XHR clients
router.get("/api/csrf-token", ensureAuth, (req, res) => {
  if (!req.session) {
    return res.status(500).json({ error: "Session not available" });
  }
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  }
  res.json({ token: req.session.csrfToken });
});

module.exports = router;

