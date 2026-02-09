require('dotenv').config();
const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const PDFDocument = require('pdfkit');
const Database = require('better-sqlite3');

// Google Sheets setup
let sheets = null;

function getCredentialsPath() {
  const dataPath = path.join(__dirname, 'data', 'google-credentials.json');
  const rootPath = path.join(__dirname, 'google-credentials.json');
  if (fs.existsSync(dataPath)) return dataPath;
  if (fs.existsSync(rootPath)) return rootPath;
  return null;
}

async function initGoogleServices() {
  console.log('=== initGoogleServices called ===');
  try {
    const credPath = getCredentialsPath();
    console.log('Credentials path:', credPath);
    if (!credPath) {
      console.log('Google credentials not found, Google services disabled');
      return false;
    }
    const auth = new google.auth.GoogleAuth({
      keyFile: credPath,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    sheets = google.sheets({ version: 'v4', auth });
    console.log('Google Sheets connected successfully');
    return true;
  } catch (e) {
    console.error('Google services init error:', e.message);
    return false;
  }
}

const app = express();
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB per file

// Security: Block access to data directory
app.use('/data', (req, res) => res.status(403).send('Forbidden'));
app.use((req, res, next) => {
  if (req.path.includes('users.json') || req.path.includes('data/')) {
    return res.status(403).send('Forbidden');
  }
  next();
});

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Rate limiting for login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: 'Too many login attempts. Try again in 15 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
});

const PORT = process.env.PORT || 3000;
const DEV_MODE = process.env.DEV_MODE === 'true';
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'vbudget.db');

// Legacy JSON file paths (for migration)
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const MOTIVES_FILE = path.join(DATA_DIR, 'motives.json');
const BILLS_FILE = path.join(DATA_DIR, 'bills.json');
const LOG_FILE = path.join(DATA_DIR, 'editlog.json');
const VGELD_FILE = path.join(DATA_DIR, 'vgeld.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

// Initialize SQLite database
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

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
`);

// Add netto_amount column if missing (migration)
try {
  db.prepare("SELECT netto_amount FROM bills LIMIT 1").get();
} catch (e) {
  db.exec("ALTER TABLE bills ADD COLUMN netto_amount REAL DEFAULT 0");
  db.exec("UPDATE bills SET netto_amount = COALESCE(brutto19,0)/1.19 + COALESCE(brutto7,0)/1.07 + COALESCE(brutto0,0)");
  console.log('Migrated: added netto_amount column and backfilled');
}

// Legacy JSON helpers (for migration only)
function loadJSON(file, defaultValue = []) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) { console.error('Error loading', file, e.message); }
  return defaultValue;
}

// Migration: Import existing JSON data if tables are empty
function migrateData() {
  console.log('=== Checking for data migration ===');

  // Migrate users
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount === 0 && fs.existsSync(USERS_FILE)) {
    const users = loadJSON(USERS_FILE, []);
    if (users.length > 0) {
      const insert = db.prepare('INSERT INTO users (email, hash, admin) VALUES (?, ?, ?)');
      for (const u of users) {
        insert.run(u.email, u.hash, u.admin ? 1 : 0);
      }
      console.log(`Migrated ${users.length} users`);
    }
  }

  // Migrate motives
  const motiveCount = db.prepare('SELECT COUNT(*) as count FROM motives').get().count;
  if (motiveCount === 0 && fs.existsSync(MOTIVES_FILE)) {
    const motives = loadJSON(MOTIVES_FILE, []);
    if (motives.length > 0) {
      const insert = db.prepare('INSERT INTO motives (name, budget) VALUES (?, ?)');
      for (const m of motives) {
        insert.run(m.name, m.budget || 0);
      }
      console.log(`Migrated ${motives.length} motives`);
    }
  }

  // Migrate bills
  const billCount = db.prepare('SELECT COUNT(*) as count FROM bills').get().count;
  if (billCount === 0 && fs.existsSync(BILLS_FILE)) {
    const bills = loadJSON(BILLS_FILE, []);
    if (bills.length > 0) {
      const insert = db.prepare(`INSERT INTO bills
        (date, email, bill_number, type, vendor, item, comment, motive, brutto19, brutto7, brutto0, amount, filename, file)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const b of bills) {
        insert.run(
          b.date, b.email, b.billNumber || null, b.type || 'Kauf',
          b.vendor || '', b.item || '', b.comment || '', b.motive || '',
          b.brutto19 || 0, b.brutto7 || 0, b.brutto0 || 0, b.amount || 0,
          b.filename || '', b.file || ''
        );
      }
      console.log(`Migrated ${bills.length} bills`);
    }
  }

  // Migrate vgeld
  const vgeldCount = db.prepare('SELECT COUNT(*) as count FROM vgeld').get().count;
  if (vgeldCount === 0 && fs.existsSync(VGELD_FILE)) {
    const vgeld = loadJSON(VGELD_FILE, []);
    if (vgeld.length > 0) {
      const insert = db.prepare('INSERT INTO vgeld (date, amount, from_user, to_user, created_by) VALUES (?, ?, ?, ?, ?)');
      for (const v of vgeld) {
        insert.run(v.date, v.amount || 0, v.from || 'External', v.to, v.createdBy || '');
      }
      console.log(`Migrated ${vgeld.length} vgeld entries`);
    }
  }

  // Migrate editlog
  const logCount = db.prepare('SELECT COUNT(*) as count FROM editlog').get().count;
  if (logCount === 0 && fs.existsSync(LOG_FILE)) {
    const logs = loadJSON(LOG_FILE, []);
    if (logs.length > 0) {
      const insert = db.prepare('INSERT INTO editlog (timestamp, user, bill_id, changes) VALUES (?, ?, ?, ?)');
      for (const l of logs) {
        // Note: billIndex from old logs won't map correctly to new IDs, but we preserve the data
        insert.run(l.timestamp, l.user, l.billIndex !== undefined ? l.billIndex + 1 : null, JSON.stringify(l.changes));
      }
      console.log(`Migrated ${logs.length} editlog entries`);
    }
  }

  // Migrate settings
  const settingCount = db.prepare('SELECT COUNT(*) as count FROM settings').get().count;
  if (settingCount === 0 && fs.existsSync(SETTINGS_FILE)) {
    const settings = loadJSON(SETTINGS_FILE, {});
    const insert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    for (const [key, value] of Object.entries(settings)) {
      insert.run(key, JSON.stringify(value));
    }
    console.log(`Migrated settings`);
  }
}

// Initialize default admin if no users exist
function initUsers() {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount === 0) {
    const defaultPassword = 'admin123';
    const hash = bcrypt.hashSync(defaultPassword, 10);
    db.prepare('INSERT INTO users (email, hash, admin) VALUES (?, ?, ?)').run('admin@example.com', hash, 1);
    console.log('Created default admin: admin@example.com / admin123');
    console.log('CHANGE THIS PASSWORD IMMEDIATELY!');
  }
}

// Initialize default motives if none exist
function initMotives() {
  const motiveCount = db.prepare('SELECT COUNT(*) as count FROM motives').get().count;
  if (motiveCount === 0) {
    const defaultMotives = [
      { name: 'Office Supplies', budget: 500 },
      { name: 'Travel', budget: 2000 },
      { name: 'Software', budget: 1000 },
      { name: 'Hardware', budget: 1500 }
    ];
    const insert = db.prepare('INSERT INTO motives (name, budget) VALUES (?, ?)');
    for (const m of defaultMotives) {
      insert.run(m.name, m.budget);
    }
    console.log('Created default motives');
  }
  // Rename legacy "Uncategorized" motive to "Default"
  const legacyMotive = db.prepare('SELECT id FROM motives WHERE name = ?').get('Uncategorized');
  if (legacyMotive) {
    db.prepare('UPDATE motives SET name = ? WHERE id = ?').run('Default', legacyMotive.id);
    console.log('Renamed Uncategorized motive to Default');
  }
  // Ensure "Default" motive exists
  const defaultMotive = db.prepare('SELECT id FROM motives WHERE name = ?').get('Default');
  if (!defaultMotive) {
    db.prepare('INSERT INTO motives (name, budget) VALUES (?, 0)').run('Default');
    console.log('Created Default motive');
  }
}

// Initialize default categories if none exist
function initCategories() {
  const catCount = db.prepare('SELECT COUNT(*) as count FROM categories').get().count;
  if (catCount === 0) {
    const defaultCategories = [
      'Charakterprops', 'Fahrendes', 'Handys / Technik', 'Helping Hand',
      'Print/Grafiks', 'Entsorgung', 'Verbrauch', 'Deko Materialien',
      'Möbel', 'Kleinteiliges', 'Set Dressen', 'Baubühne',
      'Farbe', 'Folien', 'Bau Materialien'
    ];
    const insert = db.prepare('INSERT INTO categories (name, budget) VALUES (?, 0)');
    for (const name of defaultCategories) {
      insert.run(name);
    }
    console.log('Created default categories');
  }
  // Ensure "Uncategorized" category exists
  const uncatCategory = db.prepare('SELECT id FROM categories WHERE name = ?').get('Uncategorized');
  if (!uncatCategory) {
    db.prepare('INSERT INTO categories (name, budget) VALUES (?, 0)').run('Uncategorized');
    console.log('Created Uncategorized category');
  }
}

// Migrate existing bills.motive text values into bill_motives junction table
function migrateMotiveAllocations() {
  const junctionCount = db.prepare('SELECT COUNT(*) as count FROM bill_motives').get().count;
  if (junctionCount > 0) return; // Already migrated

  const bills = db.prepare("SELECT id, motive FROM bills WHERE motive IS NOT NULL AND motive != ''").all();
  if (bills.length === 0) return;

  const motives = db.prepare('SELECT id, name FROM motives').all();
  const motiveMap = {};
  for (const m of motives) {
    motiveMap[m.name] = m.id;
  }

  const insert = db.prepare('INSERT OR IGNORE INTO bill_motives (bill_id, motive_id, percentage) VALUES (?, ?, 100)');
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
  const imgCount = db.prepare('SELECT COUNT(*) as count FROM bill_images').get().count;
  if (imgCount > 0) return; // Already migrated

  const bills = db.prepare("SELECT id, filename, file FROM bills WHERE file IS NOT NULL AND file != ''").all();
  if (bills.length === 0) return;

  const insert = db.prepare('INSERT INTO bill_images (bill_id, filename, file, sort_order) VALUES (?, ?, ?, 0)');
  let migrated = 0;
  for (const bill of bills) {
    insert.run(bill.id, bill.filename || '', bill.file);
    migrated++;
  }
  if (migrated > 0) {
    console.log(`Migrated ${migrated} bill images to bill_images table`);
  }
}

// Initialize default settings if none exist
function initSettings() {
  const settingCount = db.prepare('SELECT COUNT(*) as count FROM settings').get().count;
  if (settingCount === 0) {
    const insert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
    insert.run('googleSheetId', JSON.stringify('1-cWxjP16kyAPpkNqn27bU1-k3zfyMwQvh-daBugUSqg'));
    insert.run('googleSheetEnabled', JSON.stringify(true));
    console.log('Created default settings');
  }
}

// Run migrations and initialization
migrateData();
initUsers();
initMotives();
initCategories();
migrateMotiveAllocations();
migrateBillImages();
initSettings();

// Helper to get all settings as object
function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  for (const row of rows) {
    try {
      settings[row.key] = JSON.parse(row.value);
    } catch (e) {
      settings[row.key] = row.value;
    }
  }
  return settings;
}

// Initialize Google services after settings are loaded
console.log('=== Startup ===');
console.log('DATA_DIR:', DATA_DIR);
console.log('Database:', DB_PATH);
const settings = getSettings();
console.log('Settings loaded:', settings);
initGoogleServices();

async function appendBillToSheet(bill) {
  const settings = getSettings();
  console.log('appendBillToSheet called, sheets:', !!sheets, 'enabled:', settings?.googleSheetEnabled, 'sheetId:', settings?.googleSheetId);
  if (!sheets || !settings.googleSheetEnabled || !settings.googleSheetId) {
    console.log('Skipping sheet sync - not configured');
    return;
  }
  try {
    const typeMap = { 'Kauf': 'K', 'Leih': 'L', 'Verbrauch': 'V' };
    const motiveCol = bill.motiveDisplay || bill.motive || '';
    const row = [
      bill.comment || '',           // A: Notiz
      bill.item || '',              // B: WAS
      motiveCol,                    // C: Fur
      bill.vendor || '',            // D: WOHER
      '',                           // E: Kalkulation (brutto)
      '',                           // F: Angebot (brutto)
      bill.brutto19 || 0,           // G: brutto 19%
      bill.brutto7 || 0,            // H: brutto 7%
      bill.brutto0 || 0,            // I: brutto 0%
      new Date(bill.date).toLocaleDateString('de-DE'), // J: Datum
      bill.email || '',             // K: Wer
      typeMap[bill.type] || 'K',    // L: K/L/V
      bill.bill_number || '',       // M: Beleg Nr
      ''                            // N: V-Geld Abrechnungs Blatt
    ];
    await sheets.spreadsheets.values.append({
      spreadsheetId: settings.googleSheetId,
      range: 'A5:N',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [row] }
    });
    console.log('Bill synced to Google Sheet');
  } catch (e) {
    console.error('Sheet append error:', e.message);
  }
}

// Middleware
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
  store: new FileStore({
    path: path.join(DATA_DIR, 'sessions'),
    ttl: 86400,
    retries: 0
  }),
  secret: process.env.SESSION_SECRET || 'change-this-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }
}));

// Auth helpers
function findUser(email) {
  return db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(email);
}

function ensureAuth(req, res, next) {
  if (req.session && req.session.user) {
    req.user = req.session.user;
    return next();
  }
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Not logged in' });
  res.redirect('/login');
}

function ensureAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.admin) {
    req.user = req.session.user;
    return next();
  }
  if (req.path.startsWith('/api/')) return res.status(403).json({ error: 'Admin required' });
  res.status(403).send('Admin access required');
}

// Login page
app.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  const error = req.query.error === '1' ? '<div class="message error">Invalid email or password</div>' : '';
  res.send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>vBudget - Login</title><link rel="stylesheet" href="/style.css"></head>
<body><h1>vBudget</h1>
<div class="card"><h2>Login</h2>${error}
<form method="POST" action="/login">
<label>Email<input type="email" name="email" required autofocus></label>
<label>Password<input type="password" name="password" required></label>
<button type="submit">Login</button>
</form></div></body></html>`);
});

app.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;
  const user = findUser(email);
  if (!user || !bcrypt.compareSync(password, user.hash)) {
    return res.redirect('/login?error=1');
  }
  req.session.user = { email: user.email, admin: user.admin === 1 };
  res.redirect('/');
});

// Password validation
function validatePassword(password) {
  if (!password || password.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(password)) return 'Password must contain uppercase letter';
  if (!/[a-z]/.test(password)) return 'Password must contain lowercase letter';
  if (!/[0-9]/.test(password)) return 'Password must contain a number';
  return null;
}

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// Static files
app.use(express.static('public'));

// API: Current user
app.get('/api/user', (req, res) => {
  res.json(req.session.user || null);
});

// API: Motives
app.get('/api/motives', ensureAuth, (req, res) => {
  const motives = db.prepare('SELECT * FROM motives ORDER BY id').all();
  res.json(motives);
});

app.post('/api/admin/motive', ensureAdmin, (req, res) => {
  const { motive, budget } = req.body;
  if (!motive) return res.status(400).json({ error: 'Motive name required' });
  const result = db.prepare('INSERT INTO motives (name, budget) VALUES (?, ?)').run(motive, parseFloat(budget) || 0);
  res.json({ ok: true, id: result.lastInsertRowid });
});

app.put('/api/admin/motive/:id', ensureAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  const existing = db.prepare('SELECT * FROM motives WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  if (existing.name === 'Default') return res.status(400).json({ error: 'Cannot edit Default motive' });
  const { motive, budget } = req.body;
  const updates = [];
  const params = [];
  if (motive !== undefined) { updates.push('name = ?'); params.push(motive); }
  if (budget !== undefined) { updates.push('budget = ?'); params.push(parseFloat(budget) || 0); }
  if (updates.length > 0) {
    params.push(id);
    db.prepare(`UPDATE motives SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }
  res.json({ ok: true });
});

app.delete('/api/admin/motive/:id', ensureAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  const motive = db.prepare('SELECT name FROM motives WHERE id = ?').get(id);
  if (!motive) return res.status(404).json({ error: 'Not found' });
  if (motive.name === 'Default') {
    return res.status(400).json({ error: 'Cannot delete Default motive' });
  }
  const result = db.prepare('DELETE FROM motives WHERE id = ?').run(id);
  db.prepare('DELETE FROM bill_motives WHERE motive_id = ?').run(id);
  db.prepare('DELETE FROM budget_matrix WHERE motive_id = ?').run(id);
  res.json({ ok: true });
});

// API: Categories
app.get('/api/categories', ensureAuth, (req, res) => {
  const categories = db.prepare('SELECT * FROM categories ORDER BY id').all();
  res.json(categories);
});

app.post('/api/admin/category', ensureAdmin, (req, res) => {
  const { category, budget } = req.body;
  if (!category) return res.status(400).json({ error: 'Category name required' });
  const result = db.prepare('INSERT INTO categories (name, budget) VALUES (?, ?)').run(category, parseFloat(budget) || 0);
  res.json({ ok: true, id: result.lastInsertRowid });
});

app.put('/api/admin/category/:id', ensureAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  if (existing.name === 'Uncategorized') return res.status(400).json({ error: 'Cannot edit Uncategorized category' });
  const { category, budget } = req.body;
  const updates = [];
  const params = [];
  if (category !== undefined) { updates.push('name = ?'); params.push(category); }
  if (budget !== undefined) { updates.push('budget = ?'); params.push(parseFloat(budget) || 0); }
  if (updates.length > 0) {
    params.push(id);
    db.prepare(`UPDATE categories SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }
  res.json({ ok: true });
});

app.delete('/api/admin/category/:id', ensureAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  const category = db.prepare('SELECT name FROM categories WHERE id = ?').get(id);
  if (!category) return res.status(404).json({ error: 'Not found' });
  if (category.name === 'Uncategorized') {
    return res.status(400).json({ error: 'Cannot delete Uncategorized category' });
  }
  const result = db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  db.prepare('DELETE FROM bill_categories WHERE category_id = ?').run(id);
  db.prepare('DELETE FROM budget_matrix WHERE category_id = ?').run(id);
  res.json({ ok: true });
});

// API: Budget Matrix
app.get('/api/budget-matrix', ensureAuth, (req, res) => {
  const motives = db.prepare("SELECT id, name FROM motives ORDER BY CASE WHEN name = 'Default' THEN 1 ELSE 0 END, id").all();
  const categories = db.prepare("SELECT id, name FROM categories ORDER BY CASE WHEN name = 'Uncategorized' THEN 1 ELSE 0 END, id").all();
  const rows = db.prepare('SELECT motive_id, category_id, amount FROM budget_matrix').all();

  const matrix = {};
  let grandTotal = 0;
  for (const r of rows) {
    matrix[r.category_id + '_' + r.motive_id] = r.amount;
    grandTotal += r.amount || 0;
  }

  // Spending per motive (proportional via junction table, netto)
  const motiveSpending = {};
  db.prepare(`
    SELECT bm.motive_id, SUM(b.netto_amount * bm.percentage / 100) as spent
    FROM bill_motives bm JOIN bills b ON b.id = bm.bill_id
    GROUP BY bm.motive_id
  `).all().forEach(r => { motiveSpending[r.motive_id] = r.spent || 0; });

  // Spending per category (proportional via junction table, netto)
  const categorySpending = {};
  db.prepare(`
    SELECT bc.category_id, SUM(b.netto_amount * bc.percentage / 100) as spent
    FROM bill_categories bc JOIN bills b ON b.id = bc.bill_id
    GROUP BY bc.category_id
  `).all().forEach(r => { categorySpending[r.category_id] = r.spent || 0; });

  // Spending per cell (motive x category intersection, netto)
  const cellSpending = {};
  db.prepare(`
    SELECT bm.motive_id, bc.category_id,
      SUM(b.netto_amount * bm.percentage / 100 * bc.percentage / 100) as spent
    FROM bill_motives bm
    JOIN bill_categories bc ON bc.bill_id = bm.bill_id
    JOIN bills b ON b.id = bm.bill_id
    GROUP BY bm.motive_id, bc.category_id
  `).all().forEach(r => { cellSpending[r.category_id + '_' + r.motive_id] = r.spent || 0; });

  res.json({ motives, categories, matrix, grandTotal, motiveSpending, categorySpending, cellSpending });
});

app.put('/api/admin/budget-matrix', ensureAdmin, (req, res) => {
  const { cells } = req.body;
  if (!Array.isArray(cells)) return res.status(400).json({ error: 'cells array required' });

  const upsert = db.prepare('INSERT OR REPLACE INTO budget_matrix (motive_id, category_id, amount) VALUES (?, ?, ?)');
  const runTransaction = db.transaction((cells) => {
    for (const cell of cells) {
      upsert.run(cell.motive_id, cell.category_id, parseFloat(cell.amount) || 0);
    }
  });
  runTransaction(cells);

  res.json({ ok: true });
});

// Helper: save allocations for a bill
function saveAllocations(billId, motiveAllocations, categoryAllocations) {
  db.prepare('DELETE FROM bill_motives WHERE bill_id = ?').run(billId);
  db.prepare('DELETE FROM bill_categories WHERE bill_id = ?').run(billId);

  // Get default IDs
  const uncatMotive = db.prepare('SELECT id FROM motives WHERE name = ?').get('Default');
  const uncatCategory = db.prepare('SELECT id FROM categories WHERE name = ?').get('Uncategorized');

  // Save motive allocations
  if (Array.isArray(motiveAllocations)) {
    const insertMotive = db.prepare('INSERT OR IGNORE INTO bill_motives (bill_id, motive_id, percentage) VALUES (?, ?, ?)');
    let totalMotivePct = 0;
    for (const a of motiveAllocations) {
      if (a.motiveId && a.percentage > 0) {
        const pct = Math.round(a.percentage);
        insertMotive.run(billId, a.motiveId, pct);
        totalMotivePct += pct;
      }
    }
    // Add uncategorized for remaining percentage
    if (totalMotivePct < 100 && uncatMotive) {
      const remaining = 100 - totalMotivePct;
      insertMotive.run(billId, uncatMotive.id, remaining);
    }
  } else if (uncatMotive) {
    // No allocations provided, allocate 100% to uncategorized
    db.prepare('INSERT INTO bill_motives (bill_id, motive_id, percentage) VALUES (?, ?, 100)').run(billId, uncatMotive.id);
  }

  // Save category allocations
  if (Array.isArray(categoryAllocations)) {
    const insertCat = db.prepare('INSERT OR IGNORE INTO bill_categories (bill_id, category_id, percentage) VALUES (?, ?, ?)');
    let totalCatPct = 0;
    for (const a of categoryAllocations) {
      if (a.categoryId && a.percentage > 0) {
        const pct = Math.round(a.percentage);
        insertCat.run(billId, a.categoryId, pct);
        totalCatPct += pct;
      }
    }
    // Add uncategorized for remaining percentage
    if (totalCatPct < 100 && uncatCategory) {
      const remaining = 100 - totalCatPct;
      insertCat.run(billId, uncatCategory.id, remaining);
    }
  } else if (uncatCategory) {
    // No allocations provided, allocate 100% to uncategorized
    db.prepare('INSERT INTO bill_categories (bill_id, category_id, percentage) VALUES (?, ?, 100)').run(billId, uncatCategory.id);
  }
}

// Helper: build motive display string from allocations
function getMotiveDisplayString(billId) {
  const allocs = db.prepare(`
    SELECT m.name, bm.percentage FROM bill_motives bm
    JOIN motives m ON m.id = bm.motive_id
    WHERE bm.bill_id = ?
  `).all(billId);
  if (allocs.length === 0) return '';
  if (allocs.length === 1 && allocs[0].percentage === 100) return allocs[0].name;
  return allocs.map(a => `${a.name} (${a.percentage}%)`).join(', ');
}

// API: Bills
app.get('/api/bills', ensureAuth, (req, res) => {
  const bills = db.prepare('SELECT * FROM bills ORDER BY id').all();

  // Bulk-fetch all allocations
  const allMotiveAllocs = db.prepare(`
    SELECT bm.bill_id, bm.motive_id, bm.percentage, m.name
    FROM bill_motives bm JOIN motives m ON m.id = bm.motive_id
  `).all();
  const allCategoryAllocs = db.prepare(`
    SELECT bc.bill_id, bc.category_id, bc.percentage, c.name
    FROM bill_categories bc JOIN categories c ON c.id = bc.category_id
  `).all();

  // Bulk-fetch all images
  const allImages = db.prepare('SELECT * FROM bill_images ORDER BY sort_order, id').all();
  const imagesByBill = {};
  for (const img of allImages) {
    if (!imagesByBill[img.bill_id]) imagesByBill[img.bill_id] = [];
    imagesByBill[img.bill_id].push({ id: img.id, filename: img.filename, file: img.file, sortOrder: img.sort_order });
  }

  const motivesByBill = {};
  for (const a of allMotiveAllocs) {
    if (!motivesByBill[a.bill_id]) motivesByBill[a.bill_id] = [];
    motivesByBill[a.bill_id].push({ motiveId: a.motive_id, name: a.name, percentage: a.percentage });
  }
  const categoriesByBill = {};
  for (const a of allCategoryAllocs) {
    if (!categoriesByBill[a.bill_id]) categoriesByBill[a.bill_id] = [];
    categoriesByBill[a.bill_id].push({ categoryId: a.category_id, name: a.name, percentage: a.percentage });
  }

  const mapped = bills.map(b => ({
    id: b.id,
    date: b.date,
    email: b.email,
    billNumber: b.bill_number,
    type: b.type,
    vendor: b.vendor,
    item: b.item,
    comment: b.comment,
    motive: b.motive,
    brutto19: b.brutto19,
    brutto7: b.brutto7,
    brutto0: b.brutto0,
    amount: b.amount,
    netto19: (b.brutto19 || 0) / 1.19,
    netto7: (b.brutto7 || 0) / 1.07,
    netto0: b.brutto0 || 0,
    nettoAmount: b.netto_amount || 0,
    filename: b.filename,
    file: b.file,
    images: imagesByBill[b.id] || [],
    motiveAllocations: motivesByBill[b.id] || [],
    categoryAllocations: categoriesByBill[b.id] || []
  }));
  res.json(mapped);
});

// Calculate bill number for a user (1.01-1.20, 2.01-2.20, etc.)
function calculateBillNumber(userEmail) {
  const count = db.prepare('SELECT COUNT(*) as count FROM bills WHERE LOWER(email) = LOWER(?)').get(userEmail).count;
  const group = Math.floor(count / 20) + 1;
  const position = (count % 20) + 1;
  return `${group}.${position.toString().padStart(2, '0')}`;
}

app.post('/upload', ensureAuth, upload.array('photos', 10), (req, res) => {
  const { type, vendor, comment, item, motive, brutto19, brutto7, brutto0 } = req.body;
  const b19 = parseFloat(brutto19) || 0;
  const b7 = parseFloat(brutto7) || 0;
  const b0 = parseFloat(brutto0) || 0;
  const billNumber = calculateBillNumber(req.user.email);

  // Parse allocation JSON strings from FormData
  let motiveAllocations = [];
  let categoryAllocations = [];
  try { if (req.body.motiveAllocations) motiveAllocations = JSON.parse(req.body.motiveAllocations); } catch (e) {}
  try { if (req.body.categoryAllocations) categoryAllocations = JSON.parse(req.body.categoryAllocations); } catch (e) {}

  // Build motive display string for legacy column
  let motiveDisplay = motive || '';
  if (motiveAllocations.length > 0) {
    motiveDisplay = motiveAllocations.map(a => a.name || '').filter(Boolean).join(', ');
  }

  let firstFilePath = '';
  let firstFilename = '';

  const nettoAmount = b19 / 1.19 + b7 / 1.07 + b0;

  const result = db.prepare(`INSERT INTO bills
    (date, email, bill_number, type, vendor, item, comment, motive, brutto19, brutto7, brutto0, amount, netto_amount, filename, file)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    new Date().toISOString(),
    req.user.email,
    billNumber,
    type || 'Kauf',
    vendor || '',
    item || '',
    comment || '',
    motiveDisplay,
    b19,
    b7,
    b0,
    b19 + b7 + b0,
    nettoAmount,
    '', // filename - will update after saving images
    ''  // file - will update after saving images
  );

  const billId = result.lastInsertRowid;

  // Save uploaded files
  const files = req.files || [];
  if (files.length > 0) {
    const userFolder = req.user.email.split('@')[0];
    const uploadsDir = path.join(DATA_DIR, 'uploads', userFolder);
    if (!fs.existsSync(path.join(DATA_DIR, 'uploads'))) fs.mkdirSync(path.join(DATA_DIR, 'uploads'));
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

    const insertImg = db.prepare('INSERT INTO bill_images (bill_id, filename, file, sort_order) VALUES (?, ?, ?, ?)');
    const dateStr = new Date().toISOString().split('T')[0];

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const ext = path.extname(f.originalname) || '.jpg';
      const suffix = files.length > 1 ? `_${i + 1}` : '';
      const savedFilename = `${userFolder}_${billNumber}_${dateStr}${suffix}${ext}`;
      const savedFilePath = path.join(uploadsDir, savedFilename);
      fs.writeFileSync(savedFilePath, f.buffer);
      const relPath = `${userFolder}/${savedFilename}`;
      insertImg.run(billId, f.originalname, relPath, i);

      if (i === 0) {
        firstFilePath = relPath;
        firstFilename = f.originalname;
      }
    }

    // Update legacy columns with first image for backward compat
    db.prepare('UPDATE bills SET filename = ?, file = ? WHERE id = ?').run(firstFilename, firstFilePath, billId);
  }

  // Save allocations to junction tables
  saveAllocations(billId, motiveAllocations, categoryAllocations);

  // Get the inserted bill for Google Sheets sync
  const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(billId);
  bill.motiveDisplay = getMotiveDisplayString(billId);
  appendBillToSheet(bill);

  res.json({ ok: true, id: billId });
});

app.put('/api/bills/:id', ensureAuth, (req, res) => {
  const id = parseInt(req.params.id);
  const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(id);
  if (!bill) return res.status(404).json({ error: 'Not found' });

  const { email, type, vendor, item, comment, motive, brutto19, brutto7, brutto0, motiveAllocations, categoryAllocations } = req.body;
  const changes = {};
  const updates = [];
  const params = [];

  if (email !== undefined && email !== bill.email) {
    changes.email = email;
    updates.push('email = ?');
    params.push(email);
  }
  if (type !== undefined && type !== bill.type) {
    changes.type = type;
    updates.push('type = ?');
    params.push(type);
  }
  if (vendor !== undefined && vendor !== bill.vendor) {
    changes.vendor = vendor;
    updates.push('vendor = ?');
    params.push(vendor);
  }
  if (item !== undefined && item !== bill.item) {
    changes.item = item;
    updates.push('item = ?');
    params.push(item);
  }
  if (comment !== undefined && comment !== bill.comment) {
    changes.comment = comment;
    updates.push('comment = ?');
    params.push(comment);
  }
  if (motive !== undefined && motive !== bill.motive) {
    changes.motive = motive;
    updates.push('motive = ?');
    params.push(motive);
  }
  if (brutto19 !== undefined && parseFloat(brutto19) !== bill.brutto19) {
    changes.brutto19 = parseFloat(brutto19);
    updates.push('brutto19 = ?');
    params.push(parseFloat(brutto19));
  }
  if (brutto7 !== undefined && parseFloat(brutto7) !== bill.brutto7) {
    changes.brutto7 = parseFloat(brutto7);
    updates.push('brutto7 = ?');
    params.push(parseFloat(brutto7));
  }
  if (brutto0 !== undefined && parseFloat(brutto0) !== bill.brutto0) {
    changes.brutto0 = parseFloat(brutto0);
    updates.push('brutto0 = ?');
    params.push(parseFloat(brutto0));
  }

  // Save allocations if provided
  if (motiveAllocations !== undefined || categoryAllocations !== undefined) {
    saveAllocations(id, motiveAllocations || [], categoryAllocations || []);
    // Update legacy motive column with display string
    const motiveStr = getMotiveDisplayString(id);
    if (motiveStr !== bill.motive) {
      changes.motive = motiveStr;
      updates.push('motive = ?');
      params.push(motiveStr);
    }
  }

  if (Object.keys(changes).length > 0) {
    // Recalculate total amount and netto
    const newB19 = changes.brutto19 !== undefined ? changes.brutto19 : bill.brutto19;
    const newB7 = changes.brutto7 !== undefined ? changes.brutto7 : bill.brutto7;
    const newB0 = changes.brutto0 !== undefined ? changes.brutto0 : bill.brutto0;
    updates.push('amount = ?');
    params.push((newB19 || 0) + (newB7 || 0) + (newB0 || 0));
    updates.push('netto_amount = ?');
    params.push((newB19 || 0) / 1.19 + (newB7 || 0) / 1.07 + (newB0 || 0));

    params.push(id);
    db.prepare(`UPDATE bills SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    // Log the edit
    db.prepare('INSERT INTO editlog (timestamp, user, bill_id, changes) VALUES (?, ?, ?, ?)')
      .run(new Date().toISOString(), req.user.email, id, JSON.stringify(changes));
  } else if (motiveAllocations !== undefined || categoryAllocations !== undefined) {
    // Log allocation changes even if no other fields changed
    db.prepare('INSERT INTO editlog (timestamp, user, bill_id, changes) VALUES (?, ?, ?, ?)')
      .run(new Date().toISOString(), req.user.email, id, JSON.stringify({ allocations: 'updated' }));
  }
  res.json({ ok: true });
});

app.delete('/api/bills/:id', ensureAdmin, (req, res) => {
  const id = parseInt(req.params.id);

  // Clean up image files from disk
  const images = db.prepare('SELECT file FROM bill_images WHERE bill_id = ?').all(id);
  for (const img of images) {
    if (img.file) {
      const imgPath = path.join(DATA_DIR, 'uploads', img.file);
      if (fs.existsSync(imgPath)) {
        try { fs.unlinkSync(imgPath); } catch (e) { console.error('Failed to delete image file:', e.message); }
      }
    }
  }

  db.prepare('DELETE FROM bill_images WHERE bill_id = ?').run(id);
  db.prepare('DELETE FROM bill_motives WHERE bill_id = ?').run(id);
  db.prepare('DELETE FROM bill_categories WHERE bill_id = ?').run(id);
  const result = db.prepare('DELETE FROM bills WHERE id = ?').run(id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// Bulk delete bills
app.post('/api/bills/bulk-delete', ensureAdmin, (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'No ids provided' });
  }

  const placeholders = ids.map(() => '?').join(',');

  // Clean up image files from disk
  const images = db.prepare(`SELECT file FROM bill_images WHERE bill_id IN (${placeholders})`).all(...ids);
  for (const img of images) {
    if (img.file) {
      const imgPath = path.join(DATA_DIR, 'uploads', img.file);
      if (fs.existsSync(imgPath)) {
        try { fs.unlinkSync(imgPath); } catch (e) { console.error('Failed to delete image file:', e.message); }
      }
    }
  }

  db.prepare(`DELETE FROM bill_images WHERE bill_id IN (${placeholders})`).run(...ids);
  db.prepare(`DELETE FROM bill_motives WHERE bill_id IN (${placeholders})`).run(...ids);
  db.prepare(`DELETE FROM bill_categories WHERE bill_id IN (${placeholders})`).run(...ids);
  const result = db.prepare(`DELETE FROM bills WHERE id IN (${placeholders})`).run(...ids);

  console.log('Bulk deleted', result.changes, 'bills');
  res.json({ ok: true, deleted: result.changes });
});

// Add images to existing bill
app.post('/api/bills/:id/images', ensureAuth, upload.array('photos', 10), (req, res) => {
  const id = parseInt(req.params.id);
  const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(id);
  if (!bill) return res.status(404).json({ error: 'Not found' });

  const files = req.files || [];
  if (files.length === 0) return res.status(400).json({ error: 'No files' });

  // Check current image count
  const currentCount = db.prepare('SELECT COUNT(*) as count FROM bill_images WHERE bill_id = ?').get(id).count;
  if (currentCount + files.length > 10) {
    return res.status(400).json({ error: 'Maximum 10 images per bill' });
  }

  const userFolder = bill.email.split('@')[0];
  const uploadsDir = path.join(DATA_DIR, 'uploads', userFolder);
  if (!fs.existsSync(path.join(DATA_DIR, 'uploads'))) fs.mkdirSync(path.join(DATA_DIR, 'uploads'));
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

  const insertImg = db.prepare('INSERT INTO bill_images (bill_id, filename, file, sort_order) VALUES (?, ?, ?, ?)');
  const dateStr = new Date().toISOString().split('T')[0];
  const newImages = [];

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const ext = path.extname(f.originalname) || '.jpg';
    const sortOrder = currentCount + i;
    const savedFilename = `${userFolder}_${bill.bill_number || id}_${dateStr}_${sortOrder}${ext}`;
    const savedFilePath = path.join(uploadsDir, savedFilename);
    fs.writeFileSync(savedFilePath, f.buffer);
    const relPath = `${userFolder}/${savedFilename}`;
    const imgResult = insertImg.run(id, f.originalname, relPath, sortOrder);
    newImages.push({ id: imgResult.lastInsertRowid, filename: f.originalname, file: relPath, sortOrder });
  }

  // Update legacy columns with first image
  syncLegacyImageColumns(id);

  db.prepare('INSERT INTO editlog (timestamp, user, bill_id, changes) VALUES (?, ?, ?, ?)')
    .run(new Date().toISOString(), req.user.email, id, JSON.stringify({ images: `added ${files.length}` }));

  res.json({ ok: true, images: newImages });
});

// Delete single image from bill
app.delete('/api/bills/:id/images/:imageId', ensureAuth, (req, res) => {
  const billId = parseInt(req.params.id);
  const imageId = parseInt(req.params.imageId);
  const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(billId);
  if (!bill) return res.status(404).json({ error: 'Bill not found' });

  const image = db.prepare('SELECT * FROM bill_images WHERE id = ? AND bill_id = ?').get(imageId, billId);
  if (!image) return res.status(404).json({ error: 'Image not found' });

  // Delete file from disk
  if (image.file) {
    const imgPath = path.join(DATA_DIR, 'uploads', image.file);
    if (fs.existsSync(imgPath)) {
      try { fs.unlinkSync(imgPath); } catch (e) { console.error('Failed to delete image file:', e.message); }
    }
  }

  db.prepare('DELETE FROM bill_images WHERE id = ?').run(imageId);

  // Update legacy columns
  syncLegacyImageColumns(billId);

  db.prepare('INSERT INTO editlog (timestamp, user, bill_id, changes) VALUES (?, ?, ?, ?)')
    .run(new Date().toISOString(), req.user.email, billId, JSON.stringify({ image: 'deleted' }));

  res.json({ ok: true });
});

// Keep legacy bills.filename/file in sync with first image
function syncLegacyImageColumns(billId) {
  const firstImage = db.prepare('SELECT filename, file FROM bill_images WHERE bill_id = ? ORDER BY sort_order, id LIMIT 1').get(billId);
  if (firstImage) {
    db.prepare('UPDATE bills SET filename = ?, file = ? WHERE id = ?').run(firstImage.filename, firstImage.file, billId);
  } else {
    db.prepare('UPDATE bills SET filename = ?, file = ? WHERE id = ?').run('', '', billId);
  }
}

// Legacy single image replace (backward compat)
app.post('/api/bills/:id/image', ensureAuth, upload.single('photo'), (req, res) => {
  const id = parseInt(req.params.id);
  const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(id);
  if (!bill) return res.status(404).json({ error: 'Not found' });
  if (!req.file) return res.status(400).json({ error: 'No file' });

  const userFolder = bill.email.split('@')[0];
  const uploadsDir = path.join(DATA_DIR, 'uploads', userFolder);
  if (!fs.existsSync(path.join(DATA_DIR, 'uploads'))) fs.mkdirSync(path.join(DATA_DIR, 'uploads'));
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

  const dateStr = new Date().toISOString().split('T')[0];
  const ext = path.extname(req.file.originalname) || '.jpg';
  const filename = `${userFolder}_${bill.bill_number || id}_${dateStr}${ext}`;
  const filePath = path.join(uploadsDir, filename);
  fs.writeFileSync(filePath, req.file.buffer);

  const file = `${userFolder}/${filename}`;
  // Also add to bill_images
  db.prepare('INSERT INTO bill_images (bill_id, filename, file, sort_order) VALUES (?, ?, ?, ?)')
    .run(id, req.file.originalname, file, 0);
  syncLegacyImageColumns(id);

  db.prepare('INSERT INTO editlog (timestamp, user, bill_id, changes) VALUES (?, ?, ?, ?)')
    .run(new Date().toISOString(), req.user.email, id, JSON.stringify({ image: 'added' }));

  res.json({ ok: true, file });
});

app.get('/api/bills/log', ensureAuth, (req, res) => {
  const logs = db.prepare('SELECT * FROM editlog ORDER BY id').all();
  // Map to frontend-expected format
  const mapped = logs.map(l => ({
    id: l.id,
    timestamp: l.timestamp,
    user: l.user,
    billId: l.bill_id,
    changes: JSON.parse(l.changes || '{}')
  }));
  res.json(mapped);
});

app.get('/api/bills/by-motive', ensureAuth, (req, res) => {
  // Use proportional calculation via junction table (netto)
  const allocated = db.prepare(`
    SELECT bm.motive_id, m.name as motive, SUM(b.netto_amount * bm.percentage / 100) as spent
    FROM bill_motives bm
    JOIN bills b ON b.id = bm.bill_id
    JOIN motives m ON m.id = bm.motive_id
    GROUP BY bm.motive_id
  `).all();

  // Also find bills with no motive allocations (uncategorized)
  const uncatSpent = db.prepare(`
    SELECT SUM(b.netto_amount) as spent FROM bills b
    WHERE b.id NOT IN (SELECT DISTINCT bill_id FROM bill_motives)
  `).get();

  const motives = db.prepare('SELECT * FROM motives ORDER BY id').all();
  const spending = {};
  allocated.forEach(a => { spending[a.motive] = a.spent || 0; });

  const result = motives.map(m => {
    const spent = spending[m.name] || 0;
    return {
      motive: m.name,
      budget: m.budget,
      spent,
      remaining: m.budget - spent,
      percent: m.budget > 0 ? (spent / m.budget) * 100 : 0
    };
  });

  if (uncatSpent && uncatSpent.spent > 0) {
    result.push({ motive: 'Default', budget: 0, spent: uncatSpent.spent, remaining: 0, percent: 0 });
  }
  res.json(result);
});

app.get('/api/bills/by-category', ensureAuth, (req, res) => {
  const allocated = db.prepare(`
    SELECT bc.category_id, c.name as category, SUM(b.netto_amount * bc.percentage / 100) as spent
    FROM bill_categories bc
    JOIN bills b ON b.id = bc.bill_id
    JOIN categories c ON c.id = bc.category_id
    GROUP BY bc.category_id
  `).all();

  const uncatSpent = db.prepare(`
    SELECT SUM(b.netto_amount) as spent FROM bills b
    WHERE b.id NOT IN (SELECT DISTINCT bill_id FROM bill_categories)
  `).get();

  const categories = db.prepare('SELECT * FROM categories ORDER BY id').all();
  const spending = {};
  allocated.forEach(a => { spending[a.category] = a.spent || 0; });

  const result = categories.map(c => {
    const spent = spending[c.name] || 0;
    return {
      category: c.name,
      budget: c.budget,
      spent,
      remaining: c.budget - spent,
      percent: c.budget > 0 ? (spent / c.budget) * 100 : 0
    };
  });

  if (uncatSpent && uncatSpent.spent > 0) {
    result.push({ category: 'Uncategorized', budget: 0, spent: uncatSpent.spent, remaining: 0, percent: 0 });
  }
  res.json(result);
});

// Serve uploaded files (supports subdirectories like /uploads/user/file.jpg)
app.get('/uploads/*', ensureAuth, (req, res) => {
  // Get the full path after /uploads/
  const filePath = req.params[0];
  const file = path.join(DATA_DIR, 'uploads', filePath);
  if (fs.existsSync(file)) return res.sendFile(file);
  res.status(404).send('Not found');
});

// API: Users list (for dropdowns)
app.get('/api/users', ensureAuth, (req, res) => {
  const users = db.prepare('SELECT email FROM users ORDER BY email').all();
  res.json(users);
});

// API: Users (admin only)
app.get('/api/admin/users', ensureAdmin, (req, res) => {
  const users = db.prepare('SELECT id, email, admin FROM users ORDER BY email').all();
  res.json(users.map(u => ({ id: u.id, email: u.email, admin: u.admin === 1 })));
});

app.post('/api/admin/users', ensureAdmin, async (req, res) => {
  const { email, password, admin } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const pwError = validatePassword(password);
  if (pwError) return res.status(400).json({ error: pwError });
  if (findUser(email)) return res.status(400).json({ error: 'User already exists' });
  const hash = await bcrypt.hash(password, 12);
  const result = db.prepare('INSERT INTO users (email, hash, admin) VALUES (?, ?, ?)').run(email, hash, admin === true ? 1 : 0);
  res.json({ ok: true, id: result.lastInsertRowid });
});

app.put('/api/admin/users/:email', ensureAdmin, async (req, res) => {
  const user = findUser(req.params.email);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { password, admin } = req.body;
  const updates = [];
  const params = [];
  if (password) {
    const pwError = validatePassword(password);
    if (pwError) return res.status(400).json({ error: pwError });
    const hash = await bcrypt.hash(password, 12);
    updates.push('hash = ?');
    params.push(hash);
  }
  if (admin !== undefined) {
    updates.push('admin = ?');
    params.push(admin === true ? 1 : 0);
  }
  if (updates.length > 0) {
    params.push(user.id);
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }
  res.json({ ok: true });
});

app.delete('/api/admin/users/:email', ensureAdmin, (req, res) => {
  const user = findUser(req.params.email);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.email.toLowerCase() === req.session.user.email.toLowerCase()) {
    return res.status(400).json({ error: 'Cannot delete yourself' });
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
  res.json({ ok: true });
});

// Change own password
app.post('/api/user/password', ensureAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords required' });
  const pwError = validatePassword(newPassword);
  if (pwError) return res.status(400).json({ error: pwError });
  const user = findUser(req.user.email);
  if (!bcrypt.compareSync(currentPassword, user.hash)) return res.status(400).json({ error: 'Current password incorrect' });
  const hash = await bcrypt.hash(newPassword, 12);
  db.prepare('UPDATE users SET hash = ? WHERE id = ?').run(hash, user.id);
  res.json({ ok: true });
});

// V-Geld endpoints
app.get('/api/vgeld', ensureAuth, (req, res) => {
  const vgeld = db.prepare('SELECT * FROM vgeld ORDER BY id').all();
  // Map to frontend-expected format
  const mapped = vgeld.map(v => ({
    id: v.id,
    date: v.date,
    amount: v.amount,
    from: v.from_user,
    to: v.to_user,
    createdBy: v.created_by
  }));
  res.json(mapped);
});

app.post('/api/vgeld', ensureAdmin, (req, res) => {
  const { amount, from, to } = req.body;
  if (!amount || !to) return res.status(400).json({ error: 'Amount and recipient required' });
  if (!findUser(to)) return res.status(400).json({ error: 'Recipient must be a registered user' });
  const result = db.prepare('INSERT INTO vgeld (date, amount, from_user, to_user, created_by) VALUES (?, ?, ?, ?, ?)')
    .run(new Date().toISOString(), parseFloat(amount) || 0, from || 'External', to, req.user.email);
  res.json({ ok: true, id: result.lastInsertRowid });
});

app.delete('/api/vgeld/:id', ensureAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  const result = db.prepare('DELETE FROM vgeld WHERE id = ?').run(id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// V-Geld analysis per user
app.get('/api/vgeld/analysis', ensureAuth, (req, res) => {
  // Sum v-geld received per user
  const vgeldSums = db.prepare('SELECT to_user as user, SUM(amount) as received FROM vgeld GROUP BY to_user').all();
  // Sum spending per user
  const billSums = db.prepare('SELECT email as user, SUM(amount) as spent FROM bills GROUP BY email').all();

  const analysis = {};
  vgeldSums.forEach(v => {
    if (!analysis[v.user]) analysis[v.user] = { received: 0, spent: 0 };
    analysis[v.user].received = v.received || 0;
  });
  billSums.forEach(b => {
    if (!analysis[b.user]) analysis[b.user] = { received: 0, spent: 0 };
    analysis[b.user].spent = b.spent || 0;
  });

  const result = Object.entries(analysis).map(([user, data]) => ({
    user,
    received: data.received,
    spent: data.spent,
    remaining: data.received - data.spent,
    percentUsed: data.received > 0 ? (data.spent / data.received) * 100 : 0
  }));

  res.json(result);
});

// Settings API
app.get('/api/admin/settings', ensureAdmin, (req, res) => {
  res.json(getSettings());
});

app.put('/api/admin/settings', ensureAdmin, (req, res) => {
  console.log('=== Settings update ===');
  console.log('Request body:', req.body);
  const { googleSheetId, googleSheetEnabled } = req.body;
  const insert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  if (googleSheetId !== undefined) insert.run('googleSheetId', JSON.stringify(googleSheetId));
  if (googleSheetEnabled !== undefined) insert.run('googleSheetEnabled', JSON.stringify(googleSheetEnabled === true));
  const newSettings = getSettings();
  console.log('New settings:', newSettings);
  res.json({ ok: true });
});

app.post('/api/admin/google-credentials', ensureAdmin, async (req, res) => {
  console.log('=== Credentials upload ===');
  const { credentials } = req.body;
  if (!credentials) return res.status(400).json({ error: 'Credentials required' });
  try {
    const parsed = JSON.parse(credentials);
    console.log('Parsed credentials type:', parsed.type);
    console.log('Service account email:', parsed.client_email);
    if (parsed.type !== 'service_account') {
      return res.status(400).json({ error: 'Must be a service account JSON' });
    }
    const credPath = path.join(DATA_DIR, 'google-credentials.json');
    console.log('Saving credentials to:', credPath);
    fs.writeFileSync(credPath, JSON.stringify(parsed, null, 2));
    const initResult = await initGoogleServices();
    console.log('Init result:', initResult);
    res.json({ ok: true, email: parsed.client_email });
  } catch (e) {
    console.error('Credentials error:', e);
    res.status(400).json({ error: 'Invalid JSON: ' + e.message });
  }
});

app.get('/api/admin/google-credentials/status', ensureAdmin, (req, res) => {
  const credPath = getCredentialsPath();
  if (!credPath) return res.json({ configured: false });
  try {
    const creds = JSON.parse(fs.readFileSync(credPath, 'utf8'));
    res.json({ configured: true, email: creds.client_email });
  } catch (e) {
    res.json({ configured: false });
  }
});

// Create unique key for duplicate detection
function billKey(bill) {
  // Primary: billNumber + email (should be unique per user)
  const billNumber = bill.bill_number || bill.billNumber;
  if (billNumber && bill.email) {
    return `${billNumber.trim()}|${bill.email.trim().toLowerCase()}`;
  }
  // Fallback: date + email + total amount (rounded to avoid float issues)
  const date = bill.date ? new Date(bill.date).toISOString().split('T')[0] : '';
  const total = Math.round(((bill.brutto19 || 0) + (bill.brutto7 || 0) + (bill.brutto0 || 0)) * 100);
  return `${date}|${(bill.email || '').trim().toLowerCase()}|${total}`;
}

function sheetRowKey(row) {
  const billNumber = (row[12] || '').trim();
  const email = (row[10] || '').trim().toLowerCase();
  // Primary: billNumber + email
  if (billNumber && email) {
    return `${billNumber}|${email}`;
  }
  // Fallback: date + email + total
  const dateStr = row[9] || '';
  const date = parseGermanDate(dateStr)?.split('T')[0] || '';
  const b19 = parseSheetNumber(row[6]);
  const b7 = parseSheetNumber(row[7]);
  const b0 = parseSheetNumber(row[8]);
  const total = Math.round((b19 + b7 + b0) * 100);
  return `${date}|${email}|${total}`;
}

// Sync all bills to Google Sheet (append only, no duplicates)
app.post('/api/sync/to-sheet', ensureAdmin, async (req, res) => {
  console.log('=== Sync to Sheet ===');
  const settings = getSettings();
  if (!sheets || !settings.googleSheetEnabled || !settings.googleSheetId) {
    return res.status(400).json({ error: 'Google Sheets not configured' });
  }
  try {
    // First, read existing data from sheet to check for duplicates
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: settings.googleSheetId,
      range: 'A5:N1000'
    });
    const existingRows = existing.data.values || [];

    // Build set of existing keys from sheet
    const existingKeys = new Set();
    for (const row of existingRows) {
      if (!row[1] && !row[6] && !row[7] && !row[8]) continue;
      existingKeys.add(sheetRowKey(row));
    }
    console.log('Existing entries in sheet:', existingKeys.size);

    const bills = db.prepare('SELECT * FROM bills ORDER BY id').all();
    const typeMap = { 'Kauf': 'K', 'Leih': 'L', 'Verbrauch': 'V' };
    const newRows = [];

    for (const bill of bills) {
      const key = billKey(bill);
      if (existingKeys.has(key)) continue; // Skip duplicates

      const motiveCol = getMotiveDisplayString(bill.id) || bill.motive || '';
      newRows.push([
        bill.comment || '',           // A: Notiz
        bill.item || '',              // B: WAS
        motiveCol,                    // C: Fur
        bill.vendor || '',            // D: WOHER
        '',                           // E: Kalkulation (brutto)
        '',                           // F: Angebot (brutto)
        bill.brutto19 || 0,           // G: brutto 19%
        bill.brutto7 || 0,            // H: brutto 7%
        bill.brutto0 || 0,            // I: brutto 0%
        new Date(bill.date).toLocaleDateString('de-DE'), // J: Datum
        bill.email || '',             // K: Wer
        typeMap[bill.type] || 'K',    // L: K/L/V
        bill.bill_number || '',       // M: Beleg Nr
        ''                            // N: V-Geld Abrechnungs Blatt
      ]);
    }

    // Append only new bills
    if (newRows.length > 0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: settings.googleSheetId,
        range: 'A5:N',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: newRows }
      });
    }
    console.log('Added', newRows.length, 'new bills to sheet (skipped', bills.length - newRows.length, 'duplicates)');
    res.json({ ok: true, added: newRows.length, skipped: bills.length - newRows.length });
  } catch (e) {
    console.error('Sync to sheet error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Sync from Google Sheet to local (append only, no duplicates)
app.post('/api/sync/from-sheet', ensureAdmin, async (req, res) => {
  console.log('=== Sync from Sheet ===');
  const settings = getSettings();
  if (!sheets || !settings.googleSheetEnabled || !settings.googleSheetId) {
    return res.status(400).json({ error: 'Google Sheets not configured' });
  }
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: settings.googleSheetId,
      range: 'A5:N1000'
    });

    const rows = response.data.values || [];
    console.log('Read', rows.length, 'rows from sheet');

    // Build set of existing local bill keys
    const bills = db.prepare('SELECT * FROM bills').all();
    const existingKeys = new Set(bills.map(b => billKey(b)));
    console.log('Existing local bills:', existingKeys.size);

    const typeMap = { 'K': 'Kauf', 'L': 'Leih', 'V': 'Verbrauch' };
    let added = 0;
    let skipped = 0;

    const insert = db.prepare(`INSERT INTO bills
      (date, email, bill_number, type, vendor, item, comment, motive, brutto19, brutto7, brutto0, amount, filename, file)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', '')`);

    for (const row of rows) {
      // Skip empty rows (check WAS and brutto columns)
      if (!row[1] && !row[6] && !row[7] && !row[8]) continue;

      console.log('Sheet row raw values - col6:', row[6], 'col7:', row[7], 'col8:', row[8]);

      const bill = {
        comment: row[0] || '',           // A: Notiz
        item: row[1] || '',              // B: WAS
        motive: row[2] || '',            // C: Fur
        vendor: row[3] || '',            // D: WOHER
        brutto19: parseSheetNumber(row[6]),  // G: brutto 19%
        brutto7: parseSheetNumber(row[7]),   // H: brutto 7%
        brutto0: parseSheetNumber(row[8]),   // I: brutto 0%
        date: parseGermanDate(row[9]) || new Date().toISOString(),    // J: Datum
        email: row[10] || 'imported@sheet',                           // K: Wer
        type: typeMap[row[11]] || 'Kauf',                             // L: K/L/V
        bill_number: row[12] || '',                                   // M: Beleg Nr
        amount: 0
      };
      bill.amount = bill.brutto19 + bill.brutto7 + bill.brutto0;
      console.log('Parsed bill brutto values:', bill.brutto19, bill.brutto7, bill.brutto0);

      // Check duplicate using bill key
      const key = billKey(bill);
      if (existingKeys.has(key)) {
        skipped++;
        continue;
      }

      existingKeys.add(key);
      insert.run(
        bill.date, bill.email, bill.bill_number, bill.type,
        bill.vendor, bill.item, bill.comment, bill.motive,
        bill.brutto19, bill.brutto7, bill.brutto0, bill.amount
      );
      added++;
    }

    console.log('Added', added, 'bills from sheet (skipped', skipped, 'duplicates)');
    res.json({ ok: true, added, skipped });
  } catch (e) {
    console.error('Sync from sheet error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

function parseGermanDate(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split('.');
  if (parts.length === 3) {
    return new Date(parts[2], parts[1] - 1, parts[0]).toISOString();
  }
  return new Date(dateStr).toISOString();
}

// Parse number from sheet (handles currency symbols, comma decimals, etc.)
function parseSheetNumber(val) {
  if (val === null || val === undefined || val === '') return 0;
  // Convert to string and clean up
  let str = String(val)
    .replace(/[^\d,.\-]/g, '')      // Remove currency symbols and whitespace
    .trim();

  // Handle German format: 1.234,56 -> 1234.56
  if (str.includes(',') && str.includes('.')) {
    // Has both - assume German format (. is thousand sep, , is decimal)
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes(',')) {
    // Only comma - assume decimal separator
    str = str.replace(',', '.');
  }

  const num = parseFloat(str);
  console.log('parseSheetNumber:', val, '->', num);
  return isNaN(num) ? 0 : num;
}

// PDF Report per user
app.get('/api/report/:email', ensureAuth, async (req, res) => {
  const targetEmail = decodeURIComponent(req.params.email);

  // Only admins can view other users' reports
  if (!req.user.admin && req.user.email.toLowerCase() !== targetEmail.toLowerCase()) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const userBills = db.prepare('SELECT * FROM bills WHERE LOWER(email) = LOWER(?) ORDER BY date').all(targetEmail);
  const userVGeld = db.prepare('SELECT * FROM vgeld WHERE LOWER(to_user) = LOWER(?) ORDER BY date').all(targetEmail);

  if (userBills.length === 0 && userVGeld.length === 0) {
    return res.status(404).json({ error: 'No data found for this user' });
  }

  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="report_${targetEmail.split('@')[0]}_${new Date().toISOString().split('T')[0]}.pdf"`);

  doc.pipe(res);

  // Title
  doc.fontSize(20).font('Helvetica-Bold').text('vBudget - Belegubersicht', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(14).font('Helvetica').text(`Benutzer: ${targetEmail}`, { align: 'center' });
  doc.fontSize(10).text(`Erstellt: ${new Date().toLocaleDateString('de-DE')}`, { align: 'center' });
  doc.moveDown(1);

  // V-Geld section
  const totalVGeld = userVGeld.reduce((sum, v) => sum + (v.amount || 0), 0);
  doc.fontSize(12).font('Helvetica-Bold').text('V-Geld Zahlungen');
  doc.fontSize(10).font('Helvetica');

  if (userVGeld.length === 0) {
    doc.text('Keine V-Geld Zahlungen vorhanden.');
  } else {
    for (const v of userVGeld) {
      doc.text(`${new Date(v.date).toLocaleDateString('de-DE')} - ${(v.amount || 0).toFixed(2)} EUR von ${v.from_user || 'Extern'}`);
    }
    doc.moveDown(0.3);
    doc.font('Helvetica-Bold').text(`V-Geld Gesamt: ${totalVGeld.toFixed(2)} EUR`);
  }
  doc.moveDown(1);

  // Line separator
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(1);

  // Bills table
  if (userBills.length > 0) {
    doc.fontSize(12).font('Helvetica-Bold').text('Belegubersicht');
    doc.moveDown(0.5);

    const tableTop = doc.y;
    const colX = [50, 75, 125, 190, 250, 295, 340, 385, 430, 475, 515];

    // Table header
    doc.font('Helvetica-Bold').fontSize(6);
    doc.text('Nr.', colX[0], tableTop);
    doc.text('Datum', colX[1], tableTop);
    doc.text('Handler', colX[2], tableTop);
    doc.text('Artikel', colX[3], tableTop);
    doc.text('Br. 19%', colX[4], tableTop);
    doc.text('Br. 7%', colX[5], tableTop);
    doc.text('Br. 0%', colX[6], tableTop);
    doc.text('Brutto', colX[7], tableTop);
    doc.text('Nt. 19%', colX[8], tableTop);
    doc.text('Nt. 7%', colX[9], tableTop);
    doc.text('Netto', colX[10], tableTop);

    // Header underline
    doc.moveTo(50, tableTop + 10).lineTo(545, tableTop + 10).stroke();

    // Table rows
    doc.font('Helvetica').fontSize(6);
    let rowY = tableTop + 14;
    for (let i = 0; i < userBills.length; i++) {
      const bill = userBills[i];
      if (rowY > 750) {
        doc.addPage();
        rowY = 50;
      }
      const b19 = bill.brutto19 || 0;
      const b7 = bill.brutto7 || 0;
      const b0 = bill.brutto0 || 0;
      const n19 = b19 / 1.19;
      const n7 = b7 / 1.07;
      const netto = n19 + n7 + b0;
      doc.text(bill.bill_number || String(i + 1), colX[0], rowY, { width: 23 });
      doc.text(new Date(bill.date).toLocaleDateString('de-DE'), colX[1], rowY, { width: 48 });
      doc.text((bill.vendor || '-').substring(0, 11), colX[2], rowY, { width: 63 });
      doc.text((bill.item || '-').substring(0, 10), colX[3], rowY, { width: 58 });
      doc.text(b19.toFixed(2), colX[4], rowY, { width: 43 });
      doc.text(b7.toFixed(2), colX[5], rowY, { width: 43 });
      doc.text(b0.toFixed(2), colX[6], rowY, { width: 43 });
      doc.font('Helvetica-Bold').text((b19 + b7 + b0).toFixed(2), colX[7], rowY, { width: 43 });
      doc.font('Helvetica').text(n19.toFixed(2), colX[8], rowY, { width: 43 });
      doc.text(n7.toFixed(2), colX[9], rowY, { width: 38 });
      doc.font('Helvetica-Bold').text(netto.toFixed(2), colX[10], rowY, { width: 38 });
      doc.font('Helvetica');
      rowY += 11;
    }
    doc.y = rowY;
    doc.moveDown(1);
  }

  // Line separator
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(1);

  // Bills Summary
  const totalAmount = userBills.reduce((sum, b) => sum + (b.amount || 0), 0);
  const total19 = userBills.reduce((sum, b) => sum + (b.brutto19 || 0), 0);
  const total7 = userBills.reduce((sum, b) => sum + (b.brutto7 || 0), 0);
  const total0 = userBills.reduce((sum, b) => sum + (b.brutto0 || 0), 0);
  const totalNetto19 = total19 / 1.19;
  const totalNetto7 = total7 / 1.07;
  const totalNetto = totalNetto19 + totalNetto7 + total0;

  const summaryX = 50;
  const bruttoX = 200;
  const nettoX = 320;
  doc.fontSize(12).font('Helvetica-Bold').text('Ausgaben Zusammenfassung', summaryX);
  doc.moveDown(0.5);
  let summaryY = doc.y;

  // Column headers
  doc.fontSize(9).font('Helvetica-Bold');
  doc.text('', summaryX, summaryY);
  doc.text('Brutto', bruttoX, summaryY);
  doc.text('Netto', nettoX, summaryY);
  summaryY += 14;

  doc.fontSize(10).font('Helvetica');
  doc.text('Anzahl Belege:', summaryX, summaryY);
  doc.text(String(userBills.length), bruttoX, summaryY);
  summaryY += 14;

  doc.text('Gesamt 19%:', summaryX, summaryY);
  doc.text(`${total19.toFixed(2)} EUR`, bruttoX, summaryY);
  doc.text(`${totalNetto19.toFixed(2)} EUR`, nettoX, summaryY);
  summaryY += 14;

  doc.text('Gesamt 7%:', summaryX, summaryY);
  doc.text(`${total7.toFixed(2)} EUR`, bruttoX, summaryY);
  doc.text(`${totalNetto7.toFixed(2)} EUR`, nettoX, summaryY);
  summaryY += 14;

  doc.text('Gesamt 0%:', summaryX, summaryY);
  doc.text(`${total0.toFixed(2)} EUR`, bruttoX, summaryY);
  doc.text(`${total0.toFixed(2)} EUR`, nettoX, summaryY);
  summaryY += 14;

  doc.moveTo(summaryX, summaryY).lineTo(420, summaryY).stroke();
  summaryY += 6;

  doc.font('Helvetica-Bold');
  doc.text('Ausgaben Gesamt:', summaryX, summaryY);
  doc.text(`${totalAmount.toFixed(2)} EUR`, bruttoX, summaryY);
  doc.text(`${totalNetto.toFixed(2)} EUR`, nettoX, summaryY);
  summaryY += 14;

  doc.text('V-Geld Gesamt:', summaryX, summaryY);
  doc.text(`${totalVGeld.toFixed(2)} EUR`, bruttoX, summaryY);
  summaryY += 14;

  // Balance (brutto)
  const balance = totalVGeld - totalAmount;
  doc.fillColor(balance >= 0 ? 'green' : 'red');
  doc.text('Saldo (brutto):', summaryX, summaryY);
  doc.text(`${balance.toFixed(2)} EUR`, bruttoX, summaryY);
  doc.fillColor('black');

  doc.y = summaryY + 20;

  // New page for bills
  if (userBills.length > 0) {
    doc.addPage();
    doc.fontSize(14).font('Helvetica-Bold').text('Belege', 50);
    doc.moveDown(1);
  }

  // Bulk-fetch allocations for all user bills
  const billIds = userBills.map(b => b.id);
  const pdfMotiveAllocs = {};
  const pdfCategoryAllocs = {};
  if (billIds.length > 0) {
    const ph = billIds.map(() => '?').join(',');
    const ma = db.prepare(`SELECT bm.bill_id, m.name, bm.percentage FROM bill_motives bm JOIN motives m ON m.id = bm.motive_id WHERE bm.bill_id IN (${ph})`).all(...billIds);
    for (const a of ma) {
      if (!pdfMotiveAllocs[a.bill_id]) pdfMotiveAllocs[a.bill_id] = [];
      pdfMotiveAllocs[a.bill_id].push(a);
    }
    const ca = db.prepare(`SELECT bc.bill_id, c.name, bc.percentage FROM bill_categories bc JOIN categories c ON c.id = bc.category_id WHERE bc.bill_id IN (${ph})`).all(...billIds);
    for (const a of ca) {
      if (!pdfCategoryAllocs[a.bill_id]) pdfCategoryAllocs[a.bill_id] = [];
      pdfCategoryAllocs[a.bill_id].push(a);
    }
  }

  // Each bill
  for (let i = 0; i < userBills.length; i++) {
    const bill = userBills[i];

    // Check if we need a new page (leave room for image)
    if (doc.y > 600) {
      doc.addPage();
    }

    // Bill header
    doc.fontSize(12).font('Helvetica-Bold');
    doc.text(`Beleg ${bill.bill_number || (i + 1)}`, { continued: true });
    doc.font('Helvetica').text(` - ${new Date(bill.date).toLocaleDateString('de-DE')}`);

    // Motive allocations display
    const billMotives = pdfMotiveAllocs[bill.id] || [];
    let motiveStr = bill.motive || '-';
    if (billMotives.length > 0) {
      motiveStr = billMotives.length === 1 && billMotives[0].percentage === 100
        ? billMotives[0].name
        : billMotives.map(a => `${a.name} (${a.percentage}%)`).join(', ');
    }

    // Category allocations display
    const billCategories = pdfCategoryAllocs[bill.id] || [];
    let categoryStr = '';
    if (billCategories.length > 0) {
      categoryStr = billCategories.length === 1 && billCategories[0].percentage === 100
        ? billCategories[0].name
        : billCategories.map(a => `${a.name} (${a.percentage}%)`).join(', ');
    }

    doc.fontSize(10).font('Helvetica');
    doc.text(`Typ: ${bill.type || 'Kauf'} | Motiv: ${motiveStr}`);
    if (categoryStr) {
      doc.text(`Kategorie: ${categoryStr}`);
    }
    doc.text(`Handler: ${bill.vendor || '-'} | Artikel: ${bill.item || '-'}`);

    // Amounts (brutto + netto)
    const b19 = bill.brutto19 || 0;
    const b7 = bill.brutto7 || 0;
    const b0 = bill.brutto0 || 0;
    const n19 = b19 / 1.19;
    const n7 = b7 / 1.07;
    const billNetto = n19 + n7 + b0;
    const bruttoAmounts = [];
    if (b19) bruttoAmounts.push(`19%: ${b19.toFixed(2)}`);
    if (b7) bruttoAmounts.push(`7%: ${b7.toFixed(2)}`);
    if (b0) bruttoAmounts.push(`0%: ${b0.toFixed(2)}`);
    doc.text(`Brutto: ${bruttoAmounts.join(' | ') || '-'} | Gesamt: ${(b19 + b7 + b0).toFixed(2)} EUR`);
    const nettoAmounts = [];
    if (b19) nettoAmounts.push(`19%: ${n19.toFixed(2)}`);
    if (b7) nettoAmounts.push(`7%: ${n7.toFixed(2)}`);
    if (b0) nettoAmounts.push(`0%: ${b0.toFixed(2)}`);
    doc.text(`Netto:  ${nettoAmounts.join(' | ') || '-'} | Gesamt: ${billNetto.toFixed(2)} EUR`);

    if (bill.comment) {
      doc.text(`Notiz: ${bill.comment}`);
    }
    doc.moveDown(0.5);

    // Images from bill_images table
    const billImages = db.prepare('SELECT * FROM bill_images WHERE bill_id = ? ORDER BY sort_order, id').all(bill.id);
    if (billImages.length > 0) {
      for (let imgIdx = 0; imgIdx < billImages.length; imgIdx++) {
        const img = billImages[imgIdx];
        if (!img.file) continue;
        const imagePath = path.join(DATA_DIR, 'uploads', img.file);
        if (fs.existsSync(imagePath)) {
          try {
            const ext = path.extname(imagePath).toLowerCase();
            if (['.jpg', '.jpeg', '.png'].includes(ext)) {
              if (doc.y > 450) {
                doc.addPage();
              }
              if (billImages.length > 1) {
                doc.fontSize(8).fillColor('gray').text(`Bild ${imgIdx + 1} / ${billImages.length}`);
                doc.fillColor('black');
              }
              const maxWidth = 400;
              const maxHeight = 300;
              doc.image(imagePath, {
                fit: [maxWidth, maxHeight],
                align: 'center'
              });
              doc.moveDown(0.5);
            } else {
              doc.fontSize(9).fillColor('gray').text(`[Bild: ${img.file} - Format nicht unterstutzt]`);
              doc.fillColor('black');
            }
          } catch (imgErr) {
            console.error('PDF image error:', imgErr.message);
            doc.fontSize(9).fillColor('gray').text(`[Bild konnte nicht geladen werden: ${img.file}]`);
            doc.fillColor('black');
          }
        } else {
          doc.fontSize(9).fillColor('gray').text(`[Bild nicht gefunden: ${img.file}]`);
          doc.fillColor('black');
        }
      }
    } else if (bill.file) {
      // Fallback to legacy column
      const imagePath = path.join(DATA_DIR, 'uploads', bill.file);
      if (fs.existsSync(imagePath)) {
        try {
          const ext = path.extname(imagePath).toLowerCase();
          if (['.jpg', '.jpeg', '.png'].includes(ext)) {
            if (doc.y > 450) { doc.addPage(); }
            doc.image(imagePath, { fit: [400, 300], align: 'center' });
            doc.moveDown(0.5);
          }
        } catch (imgErr) {
          console.error('PDF image error:', imgErr.message);
        }
      }
    }

    doc.moveDown(0.5);

    // Separator between bills
    if (i < userBills.length - 1) {
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#cccccc').stroke();
      doc.strokeColor('black');
      doc.moveDown(1);
    }
  }

  doc.end();
});

// List users for report dropdown (admins see all, users see only themselves)
app.get('/api/report-users', ensureAuth, (req, res) => {
  if (req.user.admin) {
    // Admins see all users who have bills
    const usersWithBills = db.prepare('SELECT DISTINCT email FROM bills ORDER BY email').all();
    res.json(usersWithBills);
  } else {
    // Regular users only see themselves
    res.json([{ email: req.user.email }]);
  }
});

// Budget Matrix PDF Report
app.get('/api/budget-report', ensureAuth, (req, res) => {
  const motives = db.prepare("SELECT id, name FROM motives ORDER BY CASE WHEN name = 'Default' THEN 1 ELSE 0 END, id").all();
  const categories = db.prepare("SELECT id, name FROM categories ORDER BY CASE WHEN name = 'Uncategorized' THEN 1 ELSE 0 END, id").all();
  const rows = db.prepare('SELECT motive_id, category_id, amount FROM budget_matrix').all();

  const matrix = {};
  let grandTotal = 0;
  for (const r of rows) {
    matrix[r.category_id + '_' + r.motive_id] = r.amount;
    grandTotal += r.amount || 0;
  }

  const motiveSpending = {};
  db.prepare(`
    SELECT bm.motive_id, SUM(b.netto_amount * bm.percentage / 100) as spent
    FROM bill_motives bm JOIN bills b ON b.id = bm.bill_id
    GROUP BY bm.motive_id
  `).all().forEach(r => { motiveSpending[r.motive_id] = r.spent || 0; });

  const categorySpending = {};
  db.prepare(`
    SELECT bc.category_id, SUM(b.netto_amount * bc.percentage / 100) as spent
    FROM bill_categories bc JOIN bills b ON b.id = bc.bill_id
    GROUP BY bc.category_id
  `).all().forEach(r => { categorySpending[r.category_id] = r.spent || 0; });

  const eur = (v) => (v || 0).toFixed(2).replace('.', ',') + ' €';

  const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="budget_matrix_${new Date().toISOString().split('T')[0]}.pdf"`);
  doc.pipe(res);

  // Title
  doc.fontSize(18).font('Helvetica-Bold').text('vBudget - Budget Matrix (netto)', { align: 'center' });
  doc.fontSize(10).font('Helvetica').text(`Erstellt: ${new Date().toLocaleDateString('de-DE')}`, { align: 'center' });
  doc.moveDown(1);

  // Table layout
  const leftMargin = 40;
  const rowHeaderWidth = 110;
  const cellWidth = motives.length > 0
    ? Math.min(100, (doc.page.width - 80 - rowHeaderWidth - 100 - 100) / motives.length)
    : 80;
  const totalColWidth = 80;
  const spentColWidth = 80;
  const rowHeight = 18;
  const headerHeight = 22;

  let x = leftMargin;
  let y = doc.y;

  // --- Header row ---
  doc.fontSize(7).font('Helvetica-Bold');

  // Corner cell
  doc.rect(x, y, rowHeaderWidth, headerHeight).fillAndStroke('#2c3e50', '#999');
  doc.fillColor('#fff').text('Kategorie \\ Motiv', x + 4, y + 6, { width: rowHeaderWidth - 8 });
  x += rowHeaderWidth;

  // Motive column headers
  for (const m of motives) {
    doc.rect(x, y, cellWidth, headerHeight).fillAndStroke('#34495e', '#999');
    doc.fillColor('#fff').text(m.name, x + 3, y + 6, { width: cellWidth - 6, ellipsis: true });
    x += cellWidth;
  }

  // Budget total header
  doc.rect(x, y, totalColWidth, headerHeight).fillAndStroke('#ecf0f1', '#999');
  doc.fillColor('#2c3e50').text('Budget (netto)', x + 3, y + 6, { width: totalColWidth - 6 });
  x += totalColWidth;

  // Spent total header
  doc.rect(x, y, spentColWidth, headerHeight).fillAndStroke('#ecf0f1', '#999');
  doc.fillColor('#5b6b7a').text('Ausgaben (netto)', x + 3, y + 6, { width: spentColWidth - 6 });

  y += headerHeight;

  // --- Data rows ---
  doc.font('Helvetica').fontSize(7);

  for (const cat of categories) {
    x = leftMargin;

    // Row header
    doc.rect(x, y, rowHeaderWidth, rowHeight).fillAndStroke('#f0f3f6', '#ccc');
    doc.fillColor('#2c3e50').font('Helvetica-Bold')
      .text(cat.name, x + 4, y + 5, { width: rowHeaderWidth - 8, ellipsis: true });
    x += rowHeaderWidth;

    // Cell values
    let rowBudget = 0;
    doc.font('Helvetica');
    for (const m of motives) {
      const val = matrix[cat.id + '_' + m.id] || 0;
      rowBudget += val;

      // Cell background color based on value
      let bgColor = '#fff';
      if (val > 0) bgColor = '#f9fff9';

      doc.rect(x, y, cellWidth, rowHeight).fillAndStroke(bgColor, '#ddd');
      doc.fillColor('#333').text(eur(val), x + 2, y + 5, { width: cellWidth - 4, align: 'right' });
      x += cellWidth;
    }

    // Row budget total
    doc.rect(x, y, totalColWidth, rowHeight).fillAndStroke('#f7f9fb', '#ccc');
    doc.fillColor('#2c3e50').font('Helvetica-Bold')
      .text(eur(rowBudget), x + 2, y + 5, { width: totalColWidth - 4, align: 'right' });
    x += totalColWidth;

    // Row spent
    const catSpent = categorySpending[cat.id] || 0;
    const spentPct = rowBudget > 0 ? catSpent / rowBudget : 0;
    let spentBg = '#f7f9fb';
    let spentColor = '#27ae60';
    if (spentPct >= 1) { spentBg = '#fdedec'; spentColor = '#e74c3c'; }
    else if (spentPct >= 0.8) { spentBg = '#fef9e7'; spentColor = '#e67e22'; }

    doc.rect(x, y, spentColWidth, rowHeight).fillAndStroke(spentBg, '#ccc');
    doc.fillColor(spentColor).font('Helvetica-Bold')
      .text(eur(catSpent), x + 2, y + 5, { width: spentColWidth - 4, align: 'right' });

    y += rowHeight;

    // Page break if needed
    if (y > doc.page.height - 80) {
      doc.addPage();
      y = 40;
    }
  }

  // --- Footer: Budget totals ---
  x = leftMargin;
  doc.font('Helvetica-Bold').fontSize(7);

  doc.rect(x, y, rowHeaderWidth, rowHeight).fillAndStroke('#ecf0f1', '#999');
  doc.fillColor('#2c3e50').text('Budget (netto)', x + 4, y + 5, { width: rowHeaderWidth - 8 });
  x += rowHeaderWidth;

  let footerGrand = 0;
  for (const m of motives) {
    let colTotal = 0;
    for (const cat of categories) {
      colTotal += matrix[cat.id + '_' + m.id] || 0;
    }
    footerGrand += colTotal;

    doc.rect(x, y, cellWidth, rowHeight).fillAndStroke('#ecf0f1', '#999');
    doc.fillColor('#2c3e50').text(eur(colTotal), x + 2, y + 5, { width: cellWidth - 4, align: 'right' });
    x += cellWidth;
  }

  // Grand total cell
  doc.rect(x, y, totalColWidth, rowHeight).fillAndStroke('#dce3ea', '#999');
  doc.fillColor('#2c3e50').text(eur(footerGrand), x + 2, y + 5, { width: totalColWidth - 4, align: 'right' });
  x += totalColWidth;

  // Empty spent cell in budget footer
  doc.rect(x, y, spentColWidth, rowHeight).fillAndStroke('#ecf0f1', '#999');

  y += rowHeight;

  // --- Footer: Spent totals ---
  x = leftMargin;

  doc.rect(x, y, rowHeaderWidth, rowHeight).fillAndStroke('#ecf0f1', '#999');
  doc.fillColor('#5b6b7a').text('Ausgaben (netto)', x + 4, y + 5, { width: rowHeaderWidth - 8 });
  x += rowHeaderWidth;

  let footerSpentGrand = 0;
  for (const m of motives) {
    const motSpent = motiveSpending[m.id] || 0;
    footerSpentGrand += motSpent;

    let colBudget = 0;
    for (const cat of categories) {
      colBudget += matrix[cat.id + '_' + m.id] || 0;
    }

    const pct = colBudget > 0 ? motSpent / colBudget : 0;
    let bg = '#ecf0f1';
    let clr = '#27ae60';
    if (pct >= 1) { bg = '#fdedec'; clr = '#e74c3c'; }
    else if (pct >= 0.8) { bg = '#fef9e7'; clr = '#e67e22'; }

    doc.rect(x, y, cellWidth, rowHeight).fillAndStroke(bg, '#999');
    doc.fillColor(clr).text(eur(motSpent), x + 2, y + 5, { width: cellWidth - 4, align: 'right' });
    x += cellWidth;
  }

  // Empty budget cell in spent footer
  doc.rect(x, y, totalColWidth, rowHeight).fillAndStroke('#ecf0f1', '#999');
  x += totalColWidth;

  // Grand spent total
  const grandPct = footerGrand > 0 ? footerSpentGrand / footerGrand : 0;
  let grandBg = '#dce3ea';
  let grandClr = '#27ae60';
  if (grandPct >= 1) { grandBg = '#fdedec'; grandClr = '#e74c3c'; }
  else if (grandPct >= 0.8) { grandBg = '#fef9e7'; grandClr = '#e67e22'; }

  doc.rect(x, y, spentColWidth, rowHeight).fillAndStroke(grandBg, '#999');
  doc.fillColor(grandClr).text(eur(footerSpentGrand), x + 2, y + 5, { width: spentColWidth - 4, align: 'right' });

  y += rowHeight + 20;

  // Summary section
  doc.fillColor('#000');
  doc.fontSize(11).font('Helvetica-Bold').text('Zusammenfassung', leftMargin, y);
  y += 18;
  doc.fontSize(10).font('Helvetica');
  doc.text(`Total Budget (netto): ${eur(footerGrand)}`, leftMargin, y);
  y += 15;
  doc.text(`Total Ausgaben (netto): ${eur(footerSpentGrand)}`, leftMargin, y);
  y += 15;
  const remaining = footerGrand - footerSpentGrand;
  doc.fillColor(remaining >= 0 ? '#27ae60' : '#e74c3c');
  doc.font('Helvetica-Bold').text(`Verbleibend: ${eur(remaining)}`, leftMargin, y);
  y += 15;
  const usedPct = footerGrand > 0 ? (footerSpentGrand / footerGrand * 100).toFixed(1) : '0.0';
  doc.text(`Verbraucht: ${usedPct}%`, leftMargin, y);

  doc.end();
});

// Admin page
app.get('/admin', ensureAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  if (DEV_MODE) console.log('DEV_MODE is enabled');
});
