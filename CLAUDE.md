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
├── server.js          # Main Express application (~3600 lines, monolithic)
├── package.json       # npm dependencies
├── public/            # Static frontend files
│   ├── index.html     # Main user SPA
│   ├── admin.html     # Admin panel SPA
│   ├── superadmin.html# Super-admin panel SPA
│   └── style.css      # Shared styles
├── data/              # Runtime data (gitignored)
│   ├── vbudget.db     # SQLite database
│   ├── uploads/       # Uploaded bill images
│   └── sessions/      # Session files
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
| `ADMIN_EMAIL` | Email address of the initial admin user |
| `SESSION_SECRET` | Secret key for session signing |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token (optional) |

A `google-credentials.json` service account file is also required in `data/`.

## Key Architecture Notes

- **Monolithic backend:** All API routes and business logic live in `server.js`
- **Multi-tenant:** Projects are isolated; users belong to projects with roles (`user`, `admin`)
- **Super-admin:** A global super-admin role exists above project admins
- **Bill tracking:** Users submit expense bills with images; admins approve/process them
- **Google Sheets sync:** Bills can be exported/synced to Google Sheets
- **Roles:** `user` → submit bills; `admin` → manage project bills; `superadmin` → manage all projects and users

## Linting & Testing

No linter or test framework is currently configured in this project. Functionality is validated manually via the web UI.

## Common Development Tasks

- **Add an API route:** Find the appropriate section in `server.js` and add your Express route
- **Modify the database schema:** Look for `db.prepare(...)` calls in `server.js`; schema initialization is at the top of the file
- **Update the frontend:** Edit the relevant HTML file in `public/` — each page is a self-contained SPA
- **Refer to API docs:** See `specification.md` for the full list of API endpoints and data models
