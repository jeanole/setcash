require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

const app = express();
const upload = multer();

const PORT = process.env.PORT || 3000;
const DEV_MODE = process.env.DEV_MODE === 'true';
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const MOTIVES_FILE = path.join(DATA_DIR, 'motives.json');
const BILLS_FILE = path.join(DATA_DIR, 'bills.json');
const LOG_FILE = path.join(DATA_DIR, 'editlog.json');

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

// Save initial data if files don't exist
if (!fs.existsSync(MOTIVES_FILE)) saveJSON(MOTIVES_FILE, motives);
if (!fs.existsSync(BILLS_FILE)) saveJSON(BILLS_FILE, bills);
if (!fs.existsSync(LOG_FILE)) saveJSON(LOG_FILE, editLog);

// Middleware
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
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

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = findUser(email);
  if (!user || !bcrypt.compareSync(password, user.hash)) {
    return res.redirect('/login?error=1');
  }
  req.session.user = { email: user.email, admin: user.admin };
  res.redirect('/');
});

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

app.post('/upload', ensureAuth, upload.single('photo'), (req, res) => {
  const { gst, vendor, comment, item, motive, amount } = req.body;
  const bill = {
    date: new Date().toISOString(),
    email: req.user.email,
    vendor: vendor || '',
    item: item || '',
    amount: parseFloat(amount) || 0,
    gst: gst || '19%',
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
  res.json({ ok: true });
});

app.put('/api/bills/:index', ensureAuth, (req, res) => {
  const index = parseInt(req.params.index);
  if (index < 0 || index >= bills.length) return res.status(404).json({ error: 'Not found' });
  const bill = bills[index];
  const { vendor, item, gst, comment, motive, amount } = req.body;
  const changes = {};
  if (vendor !== undefined && vendor !== bill.vendor) { changes.vendor = vendor; bill.vendor = vendor; }
  if (item !== undefined && item !== bill.item) { changes.item = item; bill.item = item; }
  if (gst !== undefined && gst !== bill.gst) { changes.gst = gst; bill.gst = gst; }
  if (comment !== undefined && comment !== bill.comment) { changes.comment = comment; bill.comment = comment; }
  if (motive !== undefined && motive !== bill.motive) { changes.motive = motive; bill.motive = motive; }
  if (amount !== undefined && parseFloat(amount) !== bill.amount) { changes.amount = parseFloat(amount); bill.amount = parseFloat(amount); }
  if (Object.keys(changes).length > 0) {
    editLog.push({ timestamp: new Date().toISOString(), user: req.user.email, billIndex: index, changes });
    saveJSON(BILLS_FILE, bills);
    saveJSON(LOG_FILE, editLog);
  }
  res.json({ ok: true });
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

// API: Users (admin only)
app.get('/api/admin/users', ensureAdmin, (req, res) => {
  res.json(users.map(u => ({ email: u.email, admin: u.admin })));
});

app.post('/api/admin/users', ensureAdmin, async (req, res) => {
  const { email, password, admin } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (findUser(email)) return res.status(400).json({ error: 'User already exists' });
  const hash = await bcrypt.hash(password, 10);
  users.push({ email, hash, admin: admin === true });
  saveJSON(USERS_FILE, users);
  res.json({ ok: true });
});

app.put('/api/admin/users/:email', ensureAdmin, async (req, res) => {
  const user = findUser(req.params.email);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { password, admin } = req.body;
  if (password) user.hash = await bcrypt.hash(password, 10);
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
  const user = findUser(req.user.email);
  if (!bcrypt.compareSync(currentPassword, user.hash)) return res.status(400).json({ error: 'Current password incorrect' });
  user.hash = await bcrypt.hash(newPassword, 10);
  saveJSON(USERS_FILE, users);
  res.json({ ok: true });
});

// Admin page
app.get('/admin', ensureAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  if (DEV_MODE) console.log('DEV_MODE is enabled');
});
