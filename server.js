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
const telegramRouter = require("./routes/telegram");
const superadminRouter = require("./routes/superadmin");

const PORT = process.env.PORT || 3000;
const DEV_MODE = process.env.DEV_MODE === "true";
const DATA_DIR = path.join(__dirname, "data");

const app = express();

// Multer instance shared with route files via app.locals
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB per file
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
    secret: process.env.SESSION_SECRET || "change-this-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 },
  }),
);

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
