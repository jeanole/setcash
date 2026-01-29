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

// Google Sheets setup
let sheets = null;

function getCredentialsPath() {
  const dataPath = path.join(__dirname, 'data', 'google-credentials.json');
  const rootPath = path.join(__dirname, 'google-credentials.json');
  if (fs.existsSync(dataPath)) return dataPath;
  if (fs.existsSync(rootPath)) return rootPath;
  return null;
}

async function initGoogleSheets() {
  console.log('=== initGoogleSheets called ===');
  try {
    const credPath = getCredentialsPath();
    console.log('Credentials path:', credPath);
    if (!credPath) {
      console.log('Google credentials not found, Sheets sync disabled');
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
    console.error('Google Sheets init error:', e.message);
    return false;
  }
}

async function appendBillToSheet(bill) {
  console.log('appendBillToSheet called, sheets:', !!sheets, 'enabled:', settings?.googleSheetEnabled, 'sheetId:', settings?.googleSheetId);
  if (!sheets || !settings.googleSheetEnabled || !settings.googleSheetId) {
    console.log('Skipping sheet sync - not configured');
    return;
  }
  try {
    const typeMap = { 'Kauf': 'K', 'Leih': 'L', 'Verbrauch': 'V' };
    const row = [
      bill.comment || '',           // A: Notiz
      bill.item || '',              // B: WAS
      bill.motive || '',            // C: Für
      bill.vendor || '',            // D: WOHER
      '',                           // E: Kalkulation (brutto)
      '',                           // F: Angebot (brutto) €
      bill.brutto19 || 0,           // G: brutto 19%
      bill.brutto7 || 0,            // H: brutto 7%
      bill.brutto0 || 0,            // I: brutto 0%
      new Date(bill.date).toLocaleDateString('de-DE'), // J: Datum
      bill.email || '',             // K: Wer
      typeMap[bill.type] || 'K',    // L: K/L/V
      bill.billNumber || '',        // M: Beleg Nr
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

const app = express();
const upload = multer();

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
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const MOTIVES_FILE = path.join(DATA_DIR, 'motives.json');
const BILLS_FILE = path.join(DATA_DIR, 'bills.json');
const LOG_FILE = path.join(DATA_DIR, 'editlog.json');
const VGELD_FILE = path.join(DATA_DIR, 'vgeld.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

// Data helpers
function loadJSON(file, defaultValue = []) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) { console.error('Error loading', file, e.message); }
  return defaultValue;
}

function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Initialize default admin if no users exist
function initUsers() {
  let users = loadJSON(USERS_FILE, []);
  if (users.length === 0) {
    const defaultPassword = 'admin123';
    const hash = bcrypt.hashSync(defaultPassword, 10);
    users = [{ email: 'admin@example.com', hash, admin: true }];
    saveJSON(USERS_FILE, users);
    console.log('Created default admin: admin@example.com / admin123');
    console.log('CHANGE THIS PASSWORD IMMEDIATELY!');
  }
  return users;
}

let users = initUsers();
let motives = loadJSON(MOTIVES_FILE, [
  { name: 'Office Supplies', budget: 500 },
  { name: 'Travel', budget: 2000 },
  { name: 'Software', budget: 1000 },
  { name: 'Hardware', budget: 1500 }
]);
let bills = loadJSON(BILLS_FILE, []);
let editLog = loadJSON(LOG_FILE, []);
let vgeld = loadJSON(VGELD_FILE, []);
let settings = loadJSON(SETTINGS_FILE, {
  googleSheetId: '1-cWxjP16kyAPpkNqn27bU1-k3zfyMwQvh-daBugUSqg',
  googleSheetEnabled: true
});

// Save initial data if files don't exist
if (!fs.existsSync(MOTIVES_FILE)) saveJSON(MOTIVES_FILE, motives);
if (!fs.existsSync(BILLS_FILE)) saveJSON(BILLS_FILE, bills);
if (!fs.existsSync(LOG_FILE)) saveJSON(LOG_FILE, editLog);
if (!fs.existsSync(VGELD_FILE)) saveJSON(VGELD_FILE, vgeld);
if (!fs.existsSync(SETTINGS_FILE)) saveJSON(SETTINGS_FILE, settings);

// Initialize Google Sheets after settings are loaded
console.log('=== Startup ===');
console.log('DATA_DIR:', DATA_DIR);
console.log('Settings loaded:', settings);
initGoogleSheets();

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
  return users.find(u => u.email.toLowerCase() === email.toLowerCase());
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
  req.session.user = { email: user.email, admin: user.admin };
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
  res.json(motives);
});

app.post('/api/admin/motive', ensureAdmin, (req, res) => {
  const { motive, budget } = req.body;
  if (!motive) return res.status(400).json({ error: 'Motive name required' });
  motives.push({ name: motive, budget: parseFloat(budget) || 0 });
  saveJSON(MOTIVES_FILE, motives);
  res.json({ ok: true });
});

app.put('/api/admin/motive/:index', ensureAdmin, (req, res) => {
  const index = parseInt(req.params.index);
  if (index < 0 || index >= motives.length) return res.status(404).json({ error: 'Not found' });
  const { motive, budget } = req.body;
  if (motive !== undefined) motives[index].name = motive;
  if (budget !== undefined) motives[index].budget = parseFloat(budget) || 0;
  saveJSON(MOTIVES_FILE, motives);
  res.json({ ok: true });
});

app.delete('/api/admin/motive/:index', ensureAdmin, (req, res) => {
  const index = parseInt(req.params.index);
  if (index < 0 || index >= motives.length) return res.status(404).json({ error: 'Not found' });
  motives.splice(index, 1);
  saveJSON(MOTIVES_FILE, motives);
  res.json({ ok: true });
});

// API: Bills
app.get('/api/bills', ensureAuth, (req, res) => {
  res.json(bills);
});

// Calculate bill number for a user (1.01-1.20, 2.01-2.20, etc.)
function calculateBillNumber(userEmail) {
  const userBills = bills.filter(b => b.email.toLowerCase() === userEmail.toLowerCase());
  const count = userBills.length;
  const group = Math.floor(count / 20) + 1;
  const position = (count % 20) + 1;
  return `${group}.${position.toString().padStart(2, '0')}`;
}

app.post('/upload', ensureAuth, upload.single('photo'), (req, res) => {
  const { type, vendor, comment, item, motive, brutto19, brutto7, brutto0 } = req.body;
  const b19 = parseFloat(brutto19) || 0;
  const b7 = parseFloat(brutto7) || 0;
  const b0 = parseFloat(brutto0) || 0;
  const billNumber = calculateBillNumber(req.user.email);
  const bill = {
    date: new Date().toISOString(),
    email: req.user.email,
    billNumber: billNumber,
    type: type || 'Kauf',
    vendor: vendor || '',
    item: item || '',
    brutto19: b19,
    brutto7: b7,
    brutto0: b0,
    amount: b19 + b7 + b0,
    comment: comment || '',
    motive: motive || '',
    filename: req.file ? req.file.originalname : ''
  };
  // Save file if uploaded
  if (req.file) {
    const uploadsDir = path.join(DATA_DIR, 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
    const filename = Date.now() + '-' + req.file.originalname;
    fs.writeFileSync(path.join(uploadsDir, filename), req.file.buffer);
    bill.file = filename;
  }
  bills.push(bill);
  saveJSON(BILLS_FILE, bills);
  appendBillToSheet(bill);
  res.json({ ok: true });
});

app.put('/api/bills/:index', ensureAuth, (req, res) => {
  const index = parseInt(req.params.index);
  if (index < 0 || index >= bills.length) return res.status(404).json({ error: 'Not found' });
  const bill = bills[index];
  const { email, type, vendor, item, comment, motive, brutto19, brutto7, brutto0 } = req.body;
  const changes = {};
  if (email !== undefined && email !== bill.email) { changes.email = email; bill.email = email; }
  if (type !== undefined && type !== bill.type) { changes.type = type; bill.type = type; }
  if (vendor !== undefined && vendor !== bill.vendor) { changes.vendor = vendor; bill.vendor = vendor; }
  if (item !== undefined && item !== bill.item) { changes.item = item; bill.item = item; }
  if (comment !== undefined && comment !== bill.comment) { changes.comment = comment; bill.comment = comment; }
  if (motive !== undefined && motive !== bill.motive) { changes.motive = motive; bill.motive = motive; }
  if (brutto19 !== undefined && parseFloat(brutto19) !== bill.brutto19) { changes.brutto19 = parseFloat(brutto19); bill.brutto19 = parseFloat(brutto19); }
  if (brutto7 !== undefined && parseFloat(brutto7) !== bill.brutto7) { changes.brutto7 = parseFloat(brutto7); bill.brutto7 = parseFloat(brutto7); }
  if (brutto0 !== undefined && parseFloat(brutto0) !== bill.brutto0) { changes.brutto0 = parseFloat(brutto0); bill.brutto0 = parseFloat(brutto0); }
  // Recalculate total amount
  bill.amount = (bill.brutto19 || 0) + (bill.brutto7 || 0) + (bill.brutto0 || 0);
  if (Object.keys(changes).length > 0) {
    editLog.push({ timestamp: new Date().toISOString(), user: req.user.email, billIndex: index, changes });
    saveJSON(BILLS_FILE, bills);
    saveJSON(LOG_FILE, editLog);
  }
  res.json({ ok: true });
});

app.delete('/api/bills/:index', ensureAdmin, (req, res) => {
  const index = parseInt(req.params.index);
  if (index < 0 || index >= bills.length) return res.status(404).json({ error: 'Not found' });
  bills.splice(index, 1);
  saveJSON(BILLS_FILE, bills);
  res.json({ ok: true });
});

// Bulk delete bills
app.post('/api/bills/bulk-delete', ensureAdmin, (req, res) => {
  const { indices } = req.body;
  if (!Array.isArray(indices) || indices.length === 0) {
    return res.status(400).json({ error: 'No indices provided' });
  }

  // Sort descending to delete from end first (prevents index shifting issues)
  const sortedIndices = [...indices].sort((a, b) => b - a);
  let deleted = 0;

  for (const index of sortedIndices) {
    if (index >= 0 && index < bills.length) {
      bills.splice(index, 1);
      deleted++;
    }
  }

  saveJSON(BILLS_FILE, bills);
  console.log('Bulk deleted', deleted, 'bills');
  res.json({ ok: true, deleted });
});

app.post('/api/bills/:index/image', ensureAuth, upload.single('photo'), (req, res) => {
  const index = parseInt(req.params.index);
  if (index < 0 || index >= bills.length) return res.status(404).json({ error: 'Not found' });
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const uploadsDir = path.join(DATA_DIR, 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
  const filename = Date.now() + '-' + req.file.originalname;
  fs.writeFileSync(path.join(uploadsDir, filename), req.file.buffer);
  bills[index].file = filename;
  bills[index].filename = req.file.originalname;
  editLog.push({ timestamp: new Date().toISOString(), user: req.user.email, billIndex: index, changes: { image: 'replaced' } });
  saveJSON(BILLS_FILE, bills);
  saveJSON(LOG_FILE, editLog);
  res.json({ ok: true, file: filename });
});

app.get('/api/bills/log', ensureAuth, (req, res) => {
  res.json(editLog);
});

app.get('/api/bills/by-motive', ensureAuth, (req, res) => {
  const spending = {};
  bills.forEach(b => { spending[b.motive || 'Uncategorized'] = (spending[b.motive || 'Uncategorized'] || 0) + (b.amount || 0); });
  const result = motives.map(m => {
    const spent = spending[m.name] || 0;
    return { motive: m.name, budget: m.budget, spent, remaining: m.budget - spent, percent: m.budget > 0 ? (spent / m.budget) * 100 : 0 };
  });
  if (spending['Uncategorized']) result.push({ motive: 'Uncategorized', budget: 0, spent: spending['Uncategorized'], remaining: 0, percent: 0 });
  res.json(result);
});

// Serve uploaded files
app.get('/uploads/:filename', ensureAuth, (req, res) => {
  const file = path.join(DATA_DIR, 'uploads', req.params.filename);
  if (fs.existsSync(file)) return res.sendFile(file);
  res.status(404).send('Not found');
});

// API: Users list (for dropdowns)
app.get('/api/users', ensureAuth, (req, res) => {
  res.json(users.map(u => ({ email: u.email })));
});

// API: Users (admin only)
app.get('/api/admin/users', ensureAdmin, (req, res) => {
  res.json(users.map(u => ({ email: u.email, admin: u.admin })));
});

app.post('/api/admin/users', ensureAdmin, async (req, res) => {
  const { email, password, admin } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const pwError = validatePassword(password);
  if (pwError) return res.status(400).json({ error: pwError });
  if (findUser(email)) return res.status(400).json({ error: 'User already exists' });
  const hash = await bcrypt.hash(password, 12);
  users.push({ email, hash, admin: admin === true });
  saveJSON(USERS_FILE, users);
  res.json({ ok: true });
});

app.put('/api/admin/users/:email', ensureAdmin, async (req, res) => {
  const user = findUser(req.params.email);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { password, admin } = req.body;
  if (password) {
    const pwError = validatePassword(password);
    if (pwError) return res.status(400).json({ error: pwError });
    user.hash = await bcrypt.hash(password, 12);
  }
  if (admin !== undefined) user.admin = admin === true;
  saveJSON(USERS_FILE, users);
  res.json({ ok: true });
});

app.delete('/api/admin/users/:email', ensureAdmin, (req, res) => {
  const index = users.findIndex(u => u.email.toLowerCase() === req.params.email.toLowerCase());
  if (index === -1) return res.status(404).json({ error: 'User not found' });
  if (users[index].email.toLowerCase() === req.session.user.email.toLowerCase()) {
    return res.status(400).json({ error: 'Cannot delete yourself' });
  }
  users.splice(index, 1);
  saveJSON(USERS_FILE, users);
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
  user.hash = await bcrypt.hash(newPassword, 12);
  saveJSON(USERS_FILE, users);
  res.json({ ok: true });
});

// V-Geld endpoints
app.get('/api/vgeld', ensureAuth, (req, res) => {
  res.json(vgeld);
});

app.post('/api/vgeld', ensureAdmin, (req, res) => {
  const { amount, from, to } = req.body;
  if (!amount || !to) return res.status(400).json({ error: 'Amount and recipient required' });
  if (!findUser(to)) return res.status(400).json({ error: 'Recipient must be a registered user' });
  const entry = {
    date: new Date().toISOString(),
    amount: parseFloat(amount) || 0,
    from: from || 'External',
    to: to,
    createdBy: req.user.email
  };
  vgeld.push(entry);
  saveJSON(VGELD_FILE, vgeld);
  res.json({ ok: true });
});

app.delete('/api/vgeld/:index', ensureAdmin, (req, res) => {
  const index = parseInt(req.params.index);
  if (index < 0 || index >= vgeld.length) return res.status(404).json({ error: 'Not found' });
  vgeld.splice(index, 1);
  saveJSON(VGELD_FILE, vgeld);
  res.json({ ok: true });
});

// V-Geld analysis per user
app.get('/api/vgeld/analysis', ensureAuth, (req, res) => {
  const analysis = {};

  // Sum v-geld received per user
  vgeld.forEach(v => {
    if (!analysis[v.to]) analysis[v.to] = { received: 0, spent: 0 };
    analysis[v.to].received += v.amount || 0;
  });

  // Sum spending per user
  bills.forEach(b => {
    if (!analysis[b.email]) analysis[b.email] = { received: 0, spent: 0 };
    analysis[b.email].spent += b.amount || 0;
  });

  // Calculate remaining and percentage
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
  res.json(settings);
});

app.put('/api/admin/settings', ensureAdmin, (req, res) => {
  console.log('=== Settings update ===');
  console.log('Request body:', req.body);
  const { googleSheetId, googleSheetEnabled } = req.body;
  if (googleSheetId !== undefined) settings.googleSheetId = googleSheetId;
  if (googleSheetEnabled !== undefined) settings.googleSheetEnabled = googleSheetEnabled === true;
  console.log('New settings:', settings);
  saveJSON(SETTINGS_FILE, settings);
  console.log('Settings saved to:', SETTINGS_FILE);
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
    saveJSON(credPath, parsed);
    const initResult = await initGoogleSheets();
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
  if (bill.billNumber && bill.email) {
    return `${bill.billNumber.trim()}|${bill.email.trim().toLowerCase()}`;
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
  const b19 = parseFloat(String(row[6] || 0).replace(',', '.')) || 0;
  const b7 = parseFloat(String(row[7] || 0).replace(',', '.')) || 0;
  const b0 = parseFloat(String(row[8] || 0).replace(',', '.')) || 0;
  const total = Math.round((b19 + b7 + b0) * 100);
  return `${date}|${email}|${total}`;
}

// Sync all bills to Google Sheet (append only, no duplicates)
app.post('/api/sync/to-sheet', ensureAdmin, async (req, res) => {
  console.log('=== Sync to Sheet ===');
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

    const typeMap = { 'Kauf': 'K', 'Leih': 'L', 'Verbrauch': 'V' };
    const newRows = [];

    for (const bill of bills) {
      const key = billKey(bill);
      if (existingKeys.has(key)) continue; // Skip duplicates

      newRows.push([
        bill.comment || '',           // A: Notiz
        bill.item || '',              // B: WAS
        bill.motive || '',            // C: Für
        bill.vendor || '',            // D: WOHER
        '',                           // E: Kalkulation (brutto)
        '',                           // F: Angebot (brutto) €
        bill.brutto19 || 0,           // G: brutto 19%
        bill.brutto7 || 0,            // H: brutto 7%
        bill.brutto0 || 0,            // I: brutto 0%
        new Date(bill.date).toLocaleDateString('de-DE'), // J: Datum
        bill.email || '',             // K: Wer
        typeMap[bill.type] || 'K',    // L: K/L/V
        bill.billNumber || '',        // M: Beleg Nr
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
    const existingKeys = new Set(bills.map(b => billKey(b)));
    console.log('Existing local bills:', existingKeys.size);

    const typeMap = { 'K': 'Kauf', 'L': 'Leih', 'V': 'Verbrauch' };
    let added = 0;
    let skipped = 0;

    for (const row of rows) {
      // Skip empty rows (check WAS and brutto columns)
      if (!row[1] && !row[6] && !row[7] && !row[8]) continue;

      const bill = {
        comment: row[0] || '',           // A: Notiz
        item: row[1] || '',              // B: WAS
        motive: row[2] || '',            // C: Für
        vendor: row[3] || '',            // D: WOHER
        brutto19: parseFloat(String(row[6]).replace(',', '.')) || 0,  // G: brutto 19%
        brutto7: parseFloat(String(row[7]).replace(',', '.')) || 0,   // H: brutto 7%
        brutto0: parseFloat(String(row[8]).replace(',', '.')) || 0,   // I: brutto 0%
        date: parseGermanDate(row[9]) || new Date().toISOString(),    // J: Datum
        email: row[10] || 'imported@sheet',                           // K: Wer
        type: typeMap[row[11]] || 'Kauf',                             // L: K/L/V
        billNumber: row[12] || '',                                    // M: Beleg Nr
        amount: 0
      };
      bill.amount = bill.brutto19 + bill.brutto7 + bill.brutto0;

      // Check duplicate using bill key
      const key = billKey(bill);
      if (existingKeys.has(key)) {
        skipped++;
        continue;
      }

      existingKeys.add(key);
      bills.push(bill);
      added++;
    }

    saveJSON(BILLS_FILE, bills);
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

// Admin page
app.get('/admin', ensureAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  if (DEV_MODE) console.log('DEV_MODE is enabled');
});
