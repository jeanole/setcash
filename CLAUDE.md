# vBudget — Claude Code Guide

## Project Overview

**vBudget** is a multi-tenant expense tracking and budget management web application. It uses a Node.js + Express backend with vanilla HTML/CSS/JS frontend and a SQLite database.

## Tech Stack

- **Runtime:** Node.js (20+ recommended)
- **Framework:** Express.js
- **Database:** SQLite via `better-sqlite3`
- **Frontend:** Vanilla HTML5 / CSS / JavaScript (no framework)
- **Auth:** Local email/password (bcryptjs) + Google OAuth 2.0 (passport-google-oauth20)
- **Integrations:** Google Sheets API, Google Drive API, Telegram Bot API
- **File generation:** PDFKit (PDF), ExcelJS (Excel)
- **Sessions:** express-session + session-file-store

## Project Structure

```
vbudget/
├── server.js          # Express bootstrap (~115 lines)
├── db.js              # SQLite schema, migrations, initUsers()
├── middleware.js      # Auth/session middleware (ensureAuth, ensureAdmin, etc.)
├── google.js          # Google Sheets/Drive init
├── routes/            # Express route modules (one file per domain)
│   ├── auth.js        # Login, logout, Google OAuth
│   ├── bills.js       # Bill CRUD + images
│   ├── budget.js      # Budget matrix
│   ├── categories.js
│   ├── exports.js     # PDF, Excel, ZIP, Google Sheets
│   ├── helpers.js     # Shared utilities (saveAllocations, getSettings)
│   ├── members.js
│   ├── motives.js
│   ├── notifications.js
│   ├── positions.js
│   ├── projects.js
│   ├── reporting.js
│   ├── settings.js
│   ├── superadmin.js
│   ├── telegram.js
│   └── vgeld.js
├── public/            # Static frontend files
│   ├── index.html     # Main user SPA (markup only, ~2150 lines)
│   ├── style.css      # Shared styles
│   └── js/            # Frontend JS modules
│       ├── state.js          # Global state variables
│       ├── utils.js          # escapeHtml, formatCurrency, etc.
│       ├── allocation-widget.js
│       ├── core.js           # init(), switchPane(), loadProjectData()
│       ├── bills.js
│       ├── budget.js
│       ├── sidebar.js
│       ├── notifications.js
│       ├── admin.js
│       ├── superadmin.js
│       ├── gallery.js
│       ├── spending.js
│       ├── vgeld.js
│       ├── reports.js
│       └── telegram.js
├── data/              # Runtime data (gitignored)
│   ├── vbudget.db     # SQLite database
│   ├── uploads/       # Uploaded bill images
│   └── sessions/      # Session files
├── package.json
├── Dockerfile
├── docker-compose.yml
├── .env.example       # Environment variable template
└── specification.md   # Living architecture/API documentation
```

## Running the Application

```bash
npm install
npm start              # Starts server on port 3000
```

**With Docker:**
```bash
docker-compose up      # Exposed on port 5000 → internal 3000
```

## Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable | Description |
|---|---|
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 client secret |
| `GOOGLE_CALLBACK_URL` | OAuth callback URL |
| `TARGET_SHEET_ID` | Google Sheets spreadsheet ID |
| `GOOGLE_DRIVE_FOLDER_ID` | Google Drive folder ID for uploads |
| `ADMIN_EMAIL` | Email address of the initial admin user (created on first run) |
| `ADMIN_PASSWORD` | Password for the initial admin user (created on first run) |
| `SESSION_SECRET` | Secret key for session signing |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token (optional) |

A `google-credentials.json` service account file is also required in `data/`.

## Key Architecture Notes

- **Modular backend:** `server.js` is a thin bootstrap; routes in `routes/`; DB schema/migrations in `db.js`; auth middleware in `middleware.js`
- **Multi-tenant:** Projects are isolated; users belong to projects with roles (`user`, `admin`)
- **Super-admin:** A global super-admin role exists above project admins
- **Bill tracking:** Users submit expense bills with images; admins approve/process them
- **Google Sheets sync:** Bills can be exported/synced to Google Sheets
- **Roles:** `user` → submit bills; `admin` → manage project bills; `superadmin` → manage all projects and users

## Linting & Testing

No linter or test framework is currently configured in this project. Functionality is validated manually via the web UI.

## Common Development Tasks

- **Add an API route:** Add your Express route to the appropriate file in `routes/` (e.g. `routes/bills.js` for bill-related endpoints)
- **Modify the database schema:** Edit `db.js` — schema creation and all migrations are at the top of the file
- **Update the frontend:** Edit `public/index.html` for markup; JS logic lives in `public/js/` modules (e.g. `bills.js`, `budget.js`, `core.js`)
- **Refer to API docs:** See `specification.md` for the full list of API endpoints and data models
