require("dotenv").config();
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");

const DATA_DIR = path.join(__dirname, "data");
const DB_PATH = path.join(DATA_DIR, "vbudget.db");

// Legacy JSON file paths (for migration)
const USERS_FILE = path.join(DATA_DIR, "users.json");
const MOTIVES_FILE = path.join(DATA_DIR, "motives.json");
const BILLS_FILE = path.join(DATA_DIR, "bills.json");
const LOG_FILE = path.join(DATA_DIR, "editlog.json");
const VGELD_FILE = path.join(DATA_DIR, "vgeld.json");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

// Initialize SQLite database
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    hash TEXT NOT NULL,
    admin INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS motives (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    budget REAL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS bills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    email TEXT NOT NULL,
    bill_number TEXT,
    type TEXT,
    vendor TEXT,
    item TEXT,
    comment TEXT,
    motive TEXT,
    brutto19 REAL DEFAULT 0,
    brutto7 REAL DEFAULT 0,
    brutto0 REAL DEFAULT 0,
    amount REAL DEFAULT 0,
    filename TEXT,
    file TEXT
  );

  CREATE TABLE IF NOT EXISTS vgeld (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    amount REAL DEFAULT 0,
    from_user TEXT,
    to_user TEXT NOT NULL,
    created_by TEXT
  );

  CREATE TABLE IF NOT EXISTS editlog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    user TEXT NOT NULL,
    bill_id INTEGER,
    changes TEXT
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    budget REAL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS bill_motives (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_id INTEGER NOT NULL,
    motive_id INTEGER NOT NULL,
    percentage REAL NOT NULL DEFAULT 100,
    UNIQUE(bill_id, motive_id)
  );

  CREATE TABLE IF NOT EXISTS bill_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    percentage REAL NOT NULL DEFAULT 100,
    UNIQUE(bill_id, category_id)
  );

  CREATE TABLE IF NOT EXISTS budget_matrix (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    motive_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    amount REAL DEFAULT 0,
    UNIQUE(motive_id, category_id)
  );

  CREATE TABLE IF NOT EXISTS bill_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_id INTEGER NOT NULL,
    filename TEXT,
    file TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    subtitle TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS project_positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    UNIQUE(project_id, name)
  );

  CREATE TABLE IF NOT EXISTS project_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    project_role TEXT NOT NULL DEFAULT 'user',
    position_id INTEGER REFERENCES project_positions(id) ON DELETE SET NULL,
    UNIQUE(project_id, user_email)
  );

  CREATE TABLE IF NOT EXISTS project_settings (
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT,
    PRIMARY KEY(project_id, key)
  );

  CREATE TABLE IF NOT EXISTS telegram_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    telegram_user_id TEXT NOT NULL,
    user_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    linked_at TEXT DEFAULT (datetime('now')),
    UNIQUE(project_id, telegram_user_id)
  );

  CREATE TABLE IF NOT EXISTS telegram_link_codes (
    code TEXT PRIMARY KEY,
    user_email TEXT NOT NULL,
    project_id INTEGER NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Add OCR columns to bills if missing (migration)
try {
  db.prepare("SELECT ocr_status FROM bills LIMIT 1").get();
} catch (e) {
  db.exec("ALTER TABLE bills ADD COLUMN ocr_status TEXT DEFAULT NULL");
  console.log("Migrated: added ocr_status column to bills");
}
try {
  db.prepare("SELECT ocr_fields FROM bills LIMIT 1").get();
} catch (e) {
  db.exec("ALTER TABLE bills ADD COLUMN ocr_fields TEXT DEFAULT NULL");
  console.log("Migrated: added ocr_fields column to bills");
}

// Add bills.status column if missing (migration)
try {
  db.prepare("SELECT status FROM bills LIMIT 1").get();
} catch (e) {
  db.exec("ALTER TABLE bills ADD COLUMN status TEXT DEFAULT 'confirmed'");
  console.log("Migrated: added status column to bills");
}
// Rename legacy 'complete' status values to 'confirmed'
db.exec("UPDATE bills SET status = 'confirmed' WHERE status = 'complete'");

// Add bills.telegram_caption column if missing (migration)
try {
  db.prepare("SELECT telegram_caption FROM bills LIMIT 1").get();
} catch (e) {
  db.exec("ALTER TABLE bills ADD COLUMN telegram_caption TEXT");
  console.log("Migrated: added telegram_caption column to bills");
}

// Add netto_amount column if missing (migration)
try {
  db.prepare("SELECT netto_amount FROM bills LIMIT 1").get();
} catch (e) {
  db.exec("ALTER TABLE bills ADD COLUMN netto_amount REAL DEFAULT 0");
  db.exec(
    "UPDATE bills SET netto_amount = COALESCE(brutto19,0)/1.19 + COALESCE(brutto7,0)/1.07 + COALESCE(brutto0,0)",
  );
  console.log("Migrated: added netto_amount column and backfilled");
}

// Add role_id column to users if missing (migration)
try {
  db.prepare("SELECT role_id FROM users LIMIT 1").get();
} catch (e) {
  db.exec("ALTER TABLE users ADD COLUMN role_id INTEGER REFERENCES roles(id)");
  console.log("Migrated: added role_id column to users");
}

// Add super_admin column to users if missing (migration)
try {
  db.prepare("SELECT super_admin FROM users LIMIT 1").get();
} catch (e) {
  db.exec("ALTER TABLE users ADD COLUMN super_admin INTEGER DEFAULT 0");
  console.log("Migrated: added super_admin column to users");
}

// Add default_project_id column to users if missing (migration)
try {
  db.prepare("SELECT default_project_id FROM users LIMIT 1").get();
} catch (e) {
  db.exec("ALTER TABLE users ADD COLUMN default_project_id INTEGER");
  console.log("Migrated: added default_project_id column to users");
}

// Add project_id columns to data tables if missing (migration)
const projectIdMigrations = [
  { table: "bills", check: "SELECT project_id FROM bills LIMIT 1" },
  { table: "motives", check: "SELECT project_id FROM motives LIMIT 1" },
  { table: "categories", check: "SELECT project_id FROM categories LIMIT 1" },
  { table: "vgeld", check: "SELECT project_id FROM vgeld LIMIT 1" },
  { table: "editlog", check: "SELECT project_id FROM editlog LIMIT 1" },
  {
    table: "budget_matrix",
    check: "SELECT project_id FROM budget_matrix LIMIT 1",
  },
];
for (const m of projectIdMigrations) {
  try {
    db.prepare(m.check).get();
  } catch (e) {
    db.exec(
      `ALTER TABLE ${m.table} ADD COLUMN project_id INTEGER REFERENCES projects(id)`,
    );
    console.log(`Migrated: added project_id to ${m.table}`);
  }
}

// Legacy JSON helpers (for migration only)
function loadJSON(file, defaultValue = []) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    console.error("Error loading", file, e.message);
  }
  return defaultValue;
}

// Migration: Import existing JSON data if tables are empty
function migrateData() {
  console.log("=== Checking for data migration ===");

  // Migrate users
  const userCount = db
    .prepare("SELECT COUNT(*) as count FROM users")
    .get().count;
  if (userCount === 0 && fs.existsSync(USERS_FILE)) {
    const users = loadJSON(USERS_FILE, []);
    if (users.length > 0) {
      const insert = db.prepare(
        "INSERT INTO users (email, hash, admin) VALUES (?, ?, ?)",
      );
      for (const u of users) {
        insert.run(u.email, u.hash, u.admin ? 1 : 0);
      }
      console.log(`Migrated ${users.length} users`);
    }
  }

  // Migrate motives
  const motiveCount = db
    .prepare("SELECT COUNT(*) as count FROM motives")
    .get().count;
  if (motiveCount === 0 && fs.existsSync(MOTIVES_FILE)) {
    const motives = loadJSON(MOTIVES_FILE, []);
    if (motives.length > 0) {
      const insert = db.prepare(
        "INSERT INTO motives (name, budget) VALUES (?, ?)",
      );
      for (const m of motives) {
        insert.run(m.name, m.budget || 0);
      }
      console.log(`Migrated ${motives.length} motives`);
    }
  }

  // Migrate bills
  const billCount = db
    .prepare("SELECT COUNT(*) as count FROM bills")
    .get().count;
  if (billCount === 0 && fs.existsSync(BILLS_FILE)) {
    const bills = loadJSON(BILLS_FILE, []);
    if (bills.length > 0) {
      const insert = db.prepare(`INSERT INTO bills
        (date, email, bill_number, type, vendor, item, comment, motive, brutto19, brutto7, brutto0, amount, filename, file)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const b of bills) {
        insert.run(
          b.date,
          b.email,
          b.billNumber || null,
          b.type || "Kauf",
          b.vendor || "",
          b.item || "",
          b.comment || "",
          b.motive || "",
          b.brutto19 || 0,
          b.brutto7 || 0,
          b.brutto0 || 0,
          b.amount || 0,
          b.filename || "",
          b.file || "",
        );
      }
      console.log(`Migrated ${bills.length} bills`);
    }
  }

  // Migrate vgeld
  const vgeldCount = db
    .prepare("SELECT COUNT(*) as count FROM vgeld")
    .get().count;
  if (vgeldCount === 0 && fs.existsSync(VGELD_FILE)) {
    const vgeld = loadJSON(VGELD_FILE, []);
    if (vgeld.length > 0) {
      const insert = db.prepare(
        "INSERT INTO vgeld (date, amount, from_user, to_user, created_by) VALUES (?, ?, ?, ?, ?)",
      );
      for (const v of vgeld) {
        insert.run(
          v.date,
          v.amount || 0,
          v.from || "External",
          v.to,
          v.createdBy || "",
        );
      }
      console.log(`Migrated ${vgeld.length} vgeld entries`);
    }
  }

  // Migrate editlog
  const logCount = db
    .prepare("SELECT COUNT(*) as count FROM editlog")
    .get().count;
  if (logCount === 0 && fs.existsSync(LOG_FILE)) {
    const logs = loadJSON(LOG_FILE, []);
    if (logs.length > 0) {
      const insert = db.prepare(
        "INSERT INTO editlog (timestamp, user, bill_id, changes) VALUES (?, ?, ?, ?)",
      );
      for (const l of logs) {
        insert.run(
          l.timestamp,
          l.user,
          l.billIndex !== undefined ? l.billIndex + 1 : null,
          JSON.stringify(l.changes),
        );
      }
      console.log(`Migrated ${logs.length} editlog entries`);
    }
  }

  // Migrate settings
  const settingCount = db
    .prepare("SELECT COUNT(*) as count FROM settings")
    .get().count;
  if (settingCount === 0 && fs.existsSync(SETTINGS_FILE)) {
    const settings = loadJSON(SETTINGS_FILE, {});
    const insert = db.prepare(
      "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
    );
    for (const [key, value] of Object.entries(settings)) {
      insert.run(key, JSON.stringify(value));
    }
    console.log(`Migrated settings`);
  }
}

// Initialize default admin if no users exist
function initUsers() {
  const userCount = db
    .prepare("SELECT COUNT(*) as count FROM users")
    .get().count;
  if (userCount === 0) {
    const email = process.env.ADMIN_EMAIL || "admin@example.com";
    const password = process.env.ADMIN_PASSWORD || "admin123";
    const hash = bcrypt.hashSync(password, 10);
    db.prepare("INSERT INTO users (email, hash, admin) VALUES (?, ?, ?)").run(
      email,
      hash,
      1,
    );
    console.log(`Created default admin: ${email} / ${password}`);
    console.log("CHANGE THIS PASSWORD IMMEDIATELY!");
  }
}

// Initialize default motives if none exist
function initMotives() {
  const motiveCount = db
    .prepare("SELECT COUNT(*) as count FROM motives")
    .get().count;
  if (motiveCount === 0) {
    const defaultMotives = [
      { name: "Office Supplies", budget: 500 },
      { name: "Travel", budget: 2000 },
      { name: "Software", budget: 1000 },
      { name: "Hardware", budget: 1500 },
    ];
    const insert = db.prepare(
      "INSERT INTO motives (name, budget) VALUES (?, ?)",
    );
    for (const m of defaultMotives) {
      insert.run(m.name, m.budget);
    }
    console.log("Created default motives");
  }
  // Rename legacy "Uncategorized" motive to "Default"
  const legacyMotive = db
    .prepare("SELECT id FROM motives WHERE name = ?")
    .get("Uncategorized");
  if (legacyMotive) {
    db.prepare("UPDATE motives SET name = ? WHERE id = ?").run(
      "Default",
      legacyMotive.id,
    );
    console.log("Renamed Uncategorized motive to Default");
  }
  // Ensure "Default" motive exists
  const defaultMotive = db
    .prepare("SELECT id FROM motives WHERE name = ?")
    .get("Default");
  if (!defaultMotive) {
    db.prepare("INSERT INTO motives (name, budget) VALUES (?, 0)").run(
      "Default",
    );
    console.log("Created Default motive");
  }
}

// Initialize default categories if none exist
function initCategories() {
  const catCount = db
    .prepare("SELECT COUNT(*) as count FROM categories")
    .get().count;
  if (catCount === 0) {
    const defaultCategories = [
      "Charakterprops",
      "Fahrendes",
      "Handys / Technik",
      "Helping Hand",
      "Print/Grafiks",
      "Entsorgung",
      "Verbrauch",
      "Deko Materialien",
      "Möbel",
      "Kleinteiliges",
      "Set Dressen",
      "Baubühne",
      "Farbe",
      "Folien",
      "Bau Materialien",
    ];
    const insert = db.prepare(
      "INSERT INTO categories (name, budget) VALUES (?, 0)",
    );
    for (const name of defaultCategories) {
      insert.run(name);
    }
    console.log("Created default categories");
  }
  // Ensure "Uncategorized" category exists
  const uncatCategory = db
    .prepare("SELECT id FROM categories WHERE name = ?")
    .get("Uncategorized");
  if (!uncatCategory) {
    db.prepare("INSERT INTO categories (name, budget) VALUES (?, 0)").run(
      "Uncategorized",
    );
    console.log("Created Uncategorized category");
  }
}

// Migrate existing bills.motive text values into bill_motives junction table
function migrateMotiveAllocations() {
  const junctionCount = db
    .prepare("SELECT COUNT(*) as count FROM bill_motives")
    .get().count;
  if (junctionCount > 0) return; // Already migrated

  const bills = db
    .prepare(
      "SELECT id, motive FROM bills WHERE motive IS NOT NULL AND motive != ''",
    )
    .all();
  if (bills.length === 0) return;

  const motives = db.prepare("SELECT id, name FROM motives").all();
  const motiveMap = {};
  for (const m of motives) {
    motiveMap[m.name] = m.id;
  }

  const insert = db.prepare(
    "INSERT OR IGNORE INTO bill_motives (bill_id, motive_id, percentage) VALUES (?, ?, 100)",
  );
  let migrated = 0;
  for (const bill of bills) {
    const motiveId = motiveMap[bill.motive];
    if (motiveId) {
      insert.run(bill.id, motiveId);
      migrated++;
    }
  }
  if (migrated > 0) {
    console.log(`Migrated ${migrated} bill motive allocations`);
  }
}

// Migrate existing bill images to bill_images table
function migrateBillImages() {
  const imgCount = db
    .prepare("SELECT COUNT(*) as count FROM bill_images")
    .get().count;
  if (imgCount > 0) return; // Already migrated

  const bills = db
    .prepare(
      "SELECT id, filename, file FROM bills WHERE file IS NOT NULL AND file != ''",
    )
    .all();
  if (bills.length === 0) return;

  const insert = db.prepare(
    "INSERT INTO bill_images (bill_id, filename, file, sort_order) VALUES (?, ?, ?, 0)",
  );
  let migrated = 0;
  for (const bill of bills) {
    insert.run(bill.id, bill.filename || "", bill.file);
    migrated++;
  }
  if (migrated > 0) {
    console.log(`Migrated ${migrated} bill images to bill_images table`);
  }
}

// Initialize default settings if none exist
function initSettings() {
  const settingCount = db
    .prepare("SELECT COUNT(*) as count FROM settings")
    .get().count;
  if (settingCount === 0) {
    const insert = db.prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?)",
    );
    console.log("Created default settings");
  }
}

// Initialize defaults for a new project
function initProjectDefaults(projectId) {
  // Default motive
  const defMotive = db
    .prepare("SELECT id FROM motives WHERE project_id = ? AND name = ?")
    .get(projectId, "Default");
  if (!defMotive) {
    db.prepare(
      "INSERT INTO motives (name, budget, project_id) VALUES (?, 0, ?)",
    ).run("Default", projectId);
  }
  // Uncategorized category
  const uncatCat = db
    .prepare("SELECT id FROM categories WHERE project_id = ? AND name = ?")
    .get(projectId, "Uncategorized");
  if (!uncatCat) {
    db.prepare(
      "INSERT INTO categories (name, budget, project_id) VALUES (?, 0, ?)",
    ).run("Uncategorized", projectId);
  }
  // Default positions
  const defaultPositions = [
    "Misc",
    "Szenenbild",
    "Props",
    "Set Dec",
    "Fahrer",
    "Baubühne",
  ];
  const insertPos = db.prepare(
    "INSERT OR IGNORE INTO project_positions (project_id, name) VALUES (?, ?)",
  );
  for (const name of defaultPositions) {
    insertPos.run(projectId, name);
  }
  // Default project_settings
  const insertSetting = db.prepare(
    "INSERT OR IGNORE INTO project_settings (project_id, key, value) VALUES (?, ?, ?)",
  );
}

// Migrate existing data to multi-project schema
function migrateToProjects() {
  const projectCount = db
    .prepare("SELECT COUNT(*) as count FROM projects")
    .get().count;
  if (projectCount > 0) return; // Already migrated

  // Get current project title/subtitle from settings
  const titleRow = db
    .prepare("SELECT value FROM settings WHERE key = 'projectTitle'")
    .get();
  const subtitleRow = db
    .prepare("SELECT value FROM settings WHERE key = 'projectSubtitle'")
    .get();
  let projName = "Default Project";
  let projSubtitle = null;
  try {
    if (titleRow) projName = JSON.parse(titleRow.value) || projName;
  } catch (e) {}
  try {
    if (subtitleRow) projSubtitle = JSON.parse(subtitleRow.value) || null;
  } catch (e) {}

  // Create default project
  const projResult = db
    .prepare("INSERT INTO projects (name, subtitle) VALUES (?, ?)")
    .run(projName, projSubtitle);
  const projectId = projResult.lastInsertRowid;

  // Stamp project_id = 1 on all existing data
  for (const table of [
    "bills",
    "motives",
    "categories",
    "vgeld",
    "editlog",
    "budget_matrix",
  ]) {
    db.prepare(
      `UPDATE ${table} SET project_id = ? WHERE project_id IS NULL`,
    ).run(projectId);
  }

  // Migrate global roles -> project_positions
  const roles = db.prepare("SELECT id, name FROM roles").all();
  const roleToPosition = {};
  const insertPos = db.prepare(
    "INSERT OR IGNORE INTO project_positions (project_id, name) VALUES (?, ?)",
  );
  for (const r of roles) {
    insertPos.run(projectId, r.name);
    const pos = db
      .prepare(
        "SELECT id FROM project_positions WHERE project_id = ? AND name = ?",
      )
      .get(projectId, r.name);
    if (pos) roleToPosition[r.id] = pos.id;
  }

  // Add all users to Default Project; map role_id -> position_id
  const users = db.prepare("SELECT id, email, admin, role_id FROM users").all();
  const insertMember = db.prepare(
    "INSERT OR IGNORE INTO project_members (project_id, user_email, project_role, position_id) VALUES (?, ?, ?, ?)",
  );
  for (const u of users) {
    const projectRole = u.admin === 1 ? "admin" : "user";
    const positionId = u.role_id ? roleToPosition[u.role_id] || null : null;
    insertMember.run(projectId, u.email, projectRole, positionId);
  }

  // Copy settings rows to project_settings for project 1
  const settingsRows = db.prepare("SELECT key, value FROM settings").all();
  const insertProjSetting = db.prepare(
    "INSERT OR IGNORE INTO project_settings (project_id, key, value) VALUES (?, ?, ?)",
  );
  for (const s of settingsRows) {
    insertProjSetting.run(projectId, s.key, s.value);
  }

  // Set super_admin = admin on all users (initial setup)
  db.prepare(
    "UPDATE users SET super_admin = admin WHERE super_admin IS NULL OR super_admin = 0",
  ).run();
  // Ensure at least one super_admin exists
  const adminCount = db
    .prepare("SELECT COUNT(*) as count FROM users WHERE admin = 1")
    .get().count;
  if (adminCount > 0) {
    db.prepare("UPDATE users SET super_admin = 1 WHERE admin = 1").run();
  }

  console.log(
    `Migrated to multi-project schema: created "${projName}" (id=${projectId}) with ${users.length} members`,
  );
}

// Recover stale OCR jobs: any bill left in ocr_status='pending' from a previous
// server run will never complete. Reset them to 'failed' and notify the owner.
function recoverStaleOcrJobs() {
  let stale;
  try {
    stale = db
      .prepare("SELECT id, email, project_id FROM bills WHERE ocr_status = 'pending'")
      .all();
  } catch (e) {
    // ocr_status column may not exist yet (migration runs above, but be defensive)
    return;
  }
  if (!stale || stale.length === 0) return;

  const resetStmt = db.prepare("UPDATE bills SET ocr_status = 'failed' WHERE id = ?");
  const notifyStmt = db.prepare(
    "INSERT INTO notifications (user_email, type, message, project_id) VALUES (?, 'ocr_failed', ?, ?)"
  );

  for (const bill of stale) {
    resetStmt.run(bill.id);
    if (bill.email) {
      notifyStmt.run(
        bill.email,
        "Bill analysis failed: server restarted during analysis",
        bill.project_id
      );
    }
  }

  console.log(`[OCR] Recovered ${stale.length} stale OCR job(s) — reset to failed`);
}

// Run migrations and initialization
migrateData();
initUsers();
initMotives();
initCategories();
migrateMotiveAllocations();
migrateBillImages();
initSettings();
migrateToProjects();
recoverStaleOcrJobs();

module.exports = db;
module.exports.DATA_DIR = DATA_DIR;
module.exports.initProjectDefaults = initProjectDefaults;
