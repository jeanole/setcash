require("dotenv").config();
const express = require("express");
const session = require("express-session");
const FileStore = require("session-file-store")(session);
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const multer = require("multer");
const path = require("path");

// Initialize DB (runs all migrations on require)
require("./db");

const { initGoogleServices } = require("./google");
const { getSettings } = require("./routes/helpers");
const { ensureCsrf } = require("./middleware");
// Route modules
const authRouter = require("./routes/auth");
const projectsRouter = require("./routes/projects");
const motivesRouter = require("./routes/motives");
const categoriesRouter = require("./routes/categories");
const positionsRouter = require("./routes/positions");
const budgetRouter = require("./routes/budget");
const billsRouter = require("./routes/bills");
const vgeldRouter = require("./routes/vgeld");
const membersRouter = require("./routes/members");
const notificationsRouter = require("./routes/notifications");
const settingsRouter = require("./routes/settings");
const reportingRouter = require("./routes/reporting");
const exportsRouter = require("./routes/exports");
const securityRouter = require("./routes/security");
const telegramRouter = require("./routes/telegram");
const superadminRouter = require("./routes/superadmin");
const ocrRouter = require("./routes/ocr");

const PORT = process.env.PORT || 3000;
const DEV_MODE = process.env.DEV_MODE === "true";
const DATA_DIR = path.join(__dirname, "data");

// Hardened secrets: refuse to start in production with weak session secret
const DEFAULT_SESSION_SECRET = "change-this-in-production";
const sessionSecret = process.env.SESSION_SECRET;
if (process.env.NODE_ENV === "production") {
  if (!sessionSecret || sessionSecret === DEFAULT_SESSION_SECRET || sessionSecret.length < 16) {
    console.error(
      "[Startup] SESSION_SECRET is missing, too short, or using a default/weak value. Refusing to start in production.",
    );
    process.exit(1);
  }
} else if (!sessionSecret || sessionSecret === DEFAULT_SESSION_SECRET) {
  console.warn(
    "[Startup] WARNING: SESSION_SECRET is not set or uses the default value. Set a strong SESSION_SECRET before storing API keys.",
  );
}

const app = express();

// Multer instance shared with route files via app.locals
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files (JPEG, PNG, WebP, GIF) are allowed"));
    }
  },
}); // 10MB per file
app.locals.upload = upload;

// Security: Block access to data directory
app.use("/data", (req, res) => res.status(403).send("Forbidden"));
app.use((req, res, next) => {
  if (req.path.includes("users.json") || req.path.includes("data/")) {
    return res.status(403).send("Forbidden");
  }
  next();
});

// Security headers
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "origin-when-cross-origin");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
});

// Body parsing middleware
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Session middleware
app.use(
  session({
    store: new FileStore({
      path: path.join(DATA_DIR, "sessions"),
      ttl: 86400,
      retries: 0,
    }),
    secret: process.env.SESSION_SECRET || DEFAULT_SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 },
  }),
);

// CSRF protection for state-changing requests
app.use(ensureCsrf);

// Static files
app.use(express.static("public"));

// Mount all routers
app.use(authRouter);
app.use(projectsRouter);
app.use(motivesRouter);
app.use(categoriesRouter);
app.use(positionsRouter);
app.use(budgetRouter);
app.use(billsRouter);
app.use(vgeldRouter);
app.use(membersRouter);
app.use(notificationsRouter);
app.use(settingsRouter);
app.use(reportingRouter);
app.use(exportsRouter);
app.use(telegramRouter);
app.use(superadminRouter);
app.use(ocrRouter);
app.use(securityRouter);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  if (DEV_MODE) console.log("DEV_MODE is enabled");

  // Initialize Google services
  console.log("=== Startup ===");
  console.log("DATA_DIR:", DATA_DIR);
  const settings = getSettings();
  console.log("Settings loaded:", settings);
  initGoogleServices();

  // Start all Telegram bots
  require("./routes/telegram").startAllBots();
});
