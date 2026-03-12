# vBudget — AI Agent Guide

> This document is intended for AI coding agents. It provides the essential context needed to understand, navigate, and modify the codebase effectively.

## Project Overview

**vBudget** is a multi-tenant expense tracking and budget management system designed for film productions and media projects. It enables teams to track expenses, manage budgets across multiple dimensions (motives and categories), handle advance payments (V-Geld), and export data for accounting.

**Core Principles:**
- Strict project isolation (multi-tenant)
- Sidebar and tab-driven, context-aware UI
- Deterministic financial calculations
- Multi-axis budget allocation (Motive × Category)
- Full audit history and edit logging
- Telegram ingestion for mobile bill submission
- Export-ready architecture (PDF, Excel, Google Sheets)

## Technology Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 20+ |
| Backend | Express.js |
| Database | SQLite via `better-sqlite3` (WAL mode) |
| Frontend | Vanilla HTML5 / CSS / JavaScript |
| Styling | Tailwind CSS (CDN) |
| Auth | bcryptjs + express-session (file-based) |
| File Uploads | multer |
| PDF Generation | PDFKit |
| Excel Export | ExcelJS |
| ZIP Creation | archiver |
| Google APIs | googleapis (Sheets) |
| Telegram | node-telegram-bot-api |
| OCR/AI | OpenAI/OpenRouter API integration |

## Project Structure

```
vbudget/
├── server.js              # Express bootstrap, middleware setup, route mounting
├── db.js                  # SQLite schema, migrations, initialization (~800 lines)
├── middleware.js          # Auth middleware, CSRF protection, role guards
├── google.js              # Google Sheets service account initialization
├── package.json           # Dependencies (no devDependencies)
├── Dockerfile             # Multi-stage build with non-root user
├── docker-compose.yml     # Production deployment config
├── .env.example           # Environment variable template
├── specification.md       # Living architecture documentation
├── CLAUDE.md              # Quick reference for Claude Code
│
├── routes/                # Express route modules (18 files, ~5500 lines)
│   ├── auth.js            # Login/logout, session management
│   ├── bills.js           # Bill CRUD, images, allocations
│   ├── budget.js          # Budget matrix endpoints
│   ├── categories.js      # Category management
│   ├── exports.js         # PDF, Excel, ZIP, Google Sheets export
│   ├── helpers.js         # Shared utilities (saveAllocations, getSettings)
│   ├── members.js         # Project member management
│   ├── motives.js         # Motive (budget axis) management
│   ├── notifications.js   # In-app notification system
│   ├── ocr.js             # OCR/AI bill analysis endpoints
│   ├── positions.js       # Project position definitions
│   ├── projects.js        # Project CRUD, switching
│   ├── reporting.js       # PDF report generation
│   ├── security.js        # Security-related endpoints
│   ├── settings.js        # Project and user settings
│   ├── superadmin.js      # Global admin endpoints
│   ├── telegram.js        # Telegram bot integration
│   └── vgeld.js           # Advance money (V-Geld) tracking
│
├── public/                # Static frontend files
│   ├── index.html         # Main SPA (~2150 lines of markup)
│   ├── superadmin.html    # Legacy superadmin page
│   ├── style.css          # Custom styles
│   └── js/                # Frontend modules (~3000 lines)
│       ├── core.js        # init(), navigation, pane switching
│       ├── state.js       # Global state variables
│       ├── utils.js       # escapeHtml, formatCurrency, API helpers
│       ├── bills.js       # Bills pane logic
│       ├── budget.js      # Budget matrix UI
│       ├── spending.js    # Spending overview
│       ├── vgeld.js       # V-Geld management
│       ├── allocation-widget.js  # Motive/category allocation UI
│       ├── gallery.js     # Image gallery and carousel
│       ├── reports.js     # Report generation UI
│       ├── sidebar.js     # Navigation sidebar
│       ├── notifications.js  # Notification bell UI
│       ├── admin.js       # Admin settings UI
│       ├── superadmin.js  # Super-admin modal
│       └── telegram.js    # Telegram linking UI
│
├── data/                  # Runtime data (gitignored)
│   ├── vbudget.db         # SQLite database
│   ├── uploads/           # Uploaded bill images
│   ├── sessions/          # File-based session storage
│   └── google-credentials.json  # Service account key
│
├── features/              # Feature tracking (Claude Code workflow)
│   ├── INDEX.md           # Master feature/bug/CR index
│   ├── PROJ-*-*.md        # Feature specifications
│   ├── BUG-*-*.md         # Bug reports
│   └── CR-*-*.md          # Change requests
│
├── nextjs/                # Next.js migration (WIP)
│   ├── app/               # Next.js app router
│   ├── components/        # React components
│   ├── lib/               # Utilities
│   └── prisma/            # Prisma schema (PostgreSQL)
│
└── .claude/               # Claude Code configuration
    ├── skills/            # Workflow skills
    └── rules/             # Coding rules
```

## Build and Run Commands

```bash
# Install dependencies
npm install

# Start development server (port 3000)
npm start

# Start with environment file
NODE_ENV=production npm start

# Docker (production)
docker-compose up -d
# Exposed on host port 5000, mapped to container port 3000
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Required | Description |
|----------|----------|-------------|
| `ADMIN_EMAIL` | Yes | Initial admin user email (auto-created on first run) |
| `ADMIN_PASSWORD` | Yes | Initial admin password (must change after login) |
| `SESSION_SECRET` | Yes | Strong random string for session signing (16+ chars in production) |
| `OCR_ENCRYPTION_SECRET` | Prod | Encryption key for stored API keys (falls back to SESSION_SECRET) |
| `GOOGLE_OAUTH_CLIENT_ID` | No | Google OAuth client ID |
| `GOOGLE_OAUTH_CLIENT_SECRET` | No | Google OAuth client secret |
| `GOOGLE_OAUTH_CALLBACK` | No | OAuth callback URL |
| `TARGET_SHEET_ID` | No | Default Google Sheet ID for exports |
| `DRIVE_FOLDER_ID` | No | Google Drive folder ID for uploads |
| `UPSTASH_REDIS_REST_URL` | No | Redis URL for rate limiting (optional) |
| `UPSTASH_REDIS_REST_TOKEN` | No | Redis token for rate limiting (optional) |

## Database Schema

**Core Tables:**
- `users` — Global accounts with `super_admin` flag
- `projects` — Project containers (`name`, `subtitle`)
- `project_members` — User-project membership with role (`user`/`admin`/`owner`)
- `project_positions` — Project-specific job positions
- `motives` — First budget allocation axis
- `categories` — Second budget allocation axis
- `budget_matrix` — Budget per motive×category intersection
- `bills` — Expense records (see key columns below)
- `bill_motives` — Bill-motive allocations (junction)
- `bill_categories` — Bill-category allocations (junction)
- `bill_images` — Multiple images per bill
- `vgeld` — Advance money transfers
- `editlog` — Audit trail with JSON changes
- `notifications` — In-app notifications
- `telegram_links` — Telegram user ID mappings
- `ocr_log` — OCR/AI processing history

**Bill Key Columns:**
- `id`, `date`, `email` (submitter), `bill_number`
- `status` — `'confirmed'` | `'draft'`
- `type` — `'Kauf'` | `'Leih'` | `'Verbrauch'`
- `vendor`, `item`, `comment`, `telegram_caption`
- `brutto19`, `brutto7`, `brutto0` — Gross amounts by VAT rate
- `netto_amount` — Calculated net amount
- `project_id` — Multi-tenant isolation
- `ocr_status`, `ocr_fields` — AI analysis state

**Protected Defaults:**
- Motive: **"Default"** (cannot delete, auto-receives remainder allocation)
- Category: **"Uncategorized"** (cannot delete)
- Position: **"Misc"** (cannot delete)

## Routing Architecture

| Route | Purpose |
|-------|---------|
| `/` | Main application (SPA) |
| `/login` | Styled login page (inline HTML template in `routes/auth.js`) |
| `/superadmin` | Legacy superadmin page (kept for backward compatibility) |
| `/api/*` | REST API endpoints |

**API Route Groups:**
- `/api/bills` — Bill CRUD, filtering, pagination
- `/api/budget` — Budget matrix read/write
- `/api/projects` — Project management
- `/api/members` — Member management
- `/api/exports` — File generation
- `/api/ocr` — AI bill analysis
- `/api/telegram` — Bot management

## Roles & Access Control

| Role | Level | Permissions |
|------|-------|-------------|
| Super-Admin | Global | Full system control, all projects, user management |
| Owner | Project | Full project control, can delete project, manage owners |
| Admin | Project | Manage members, budget, motives, categories, exports |
| User | Project | Upload bills, view own V-Geld, edit own drafts |

**Middleware Functions (from `middleware.js`):**
- `ensureAuth` — Basic login check
- `ensureProjectAccess` — User has access to current project
- `ensureProjectAdmin` — User is admin or owner of current project
- `ensureProjectOwner` — User is owner of current project
- `ensureSuperAdmin` — User has global super-admin flag
- `ensureCsrf` — CSRF token validation for state-changing requests

## Key Development Patterns

### Adding a Database Migration

Migrations are in `db.js` using try/catch column existence checks:

```javascript
// Add new column migration pattern
try {
  db.prepare("SELECT new_column FROM table_name LIMIT 1").get();
} catch (e) {
  db.exec("ALTER TABLE table_name ADD COLUMN new_column TYPE DEFAULT value");
  console.log("Migrated: added new_column to table_name");
}
```

Run migrations automatically on startup by calling them in the initialization section at the bottom of `db.js`.

### Adding an API Endpoint

1. Choose appropriate route file in `routes/` (or create new)
2. Use middleware for auth/role checks:
   ```javascript
   router.post("/api/endpoint", ensureProjectAdmin, (req, res) => {
     // Implementation
   });
   ```
3. Return JSON responses:
   - Success: `res.json({ success: true, data: ... })`
   - Error: `res.status(400).json({ error: "message" })`

### Frontend Patterns

**State Management:**
- Global state in `public/js/state.js`
- Current project stored in `state.currentProject`
- User info in `state.user`

**UI Updates:**
- `switchPane(paneName)` — Switch main content area
- `loadProjectData()` — Reload project-specific data
- `showToast(message, type)` — Display notifications

**API Calls:**
```javascript
// GET
coreApi.get("/api/endpoint").then(data => { ... });

// POST with CSRF token
coreApi.post("/api/endpoint", { data }).then(data => { ... });
```

### Financial Calculations

**Tax System:**
- Three VAT tiers: 19%, 7%, 0%
- User enters gross values
- Netto = Brutto / (1 + rate)

**Multi-Allocation:**
- Bills can split across multiple motives AND categories
- Formula: `allocated_netto = bill_netto × percentage / 100`
- Totals must equal 100% (Default/Uncategorized auto-fill remainder)

## Testing Strategy

No automated test suite is currently configured. Testing is manual via the web UI:

1. Start the server: `npm start`
2. Navigate to `http://localhost:3000`
3. Login with admin credentials
4. Test features through the web interface

For database testing, you can use the SQLite CLI:
```bash
sqlite3 data/vbudget.db
```

## Deployment Process

**CI/CD Pipeline (GitHub Actions):**

1. Push to `production` branch triggers `docker-publish.yml`
2. Docker image built and pushed to Docker Hub (`jeanlosch/vbudget`)
3. Image tagged with `:latest` and commit SHA
4. Watchtower on production server auto-pulls new image

**Manual Deployment:**
```bash
# Build and run with Docker
docker-compose up -d

# Or traditional
npm install
NODE_ENV=production npm start
```

## Security Considerations

- **Passwords:** bcrypt hashed (10 rounds), 8+ chars, require upper/lower/number
- **Sessions:** 24h TTL, HTTPOnly cookies, secure in production
- **Rate Limiting:** 5 login attempts per 15 minutes
- **CSRF:** Token validation on all state-changing requests
- **File Uploads:** Restricted to images only (JPEG, PNG, WebP, GIF), max 10MB
- **Data Access:** `/data` path blocked from direct HTTP access
- **Security Headers:** X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, HSTS
- **Production Check:** Server refuses to start with weak SESSION_SECRET in production
- **Encryption:** OCR API keys encrypted at rest with AES-256-GCM

## Claude Code Workflow

This project uses Claude Code with skill-based workflows:

**Skills Location:** `.claude/skills/`

**Key Skills:**
- `report` — Create bug reports and change requests
- `qa` — Test features against acceptance criteria
- `pipeline` — Automated QA → fix → deploy pipeline
- `deploy` — Production deployment

**Feature Tracking:**
- All features tracked in `features/INDEX.md`
- Feature specs in `features/PROJ-N-*.md`
- Bug reports in `features/BUG-N-*.md`
- Change requests in `features/CR-N-*.md`

**Commit Format:**
```
type(ID): description

Examples:
feat(PROJ-7): add bill editing modal
bug(BUG-5): fix CSRF token on project delete
cr(CR-3): add field verification badges
```

## Next.js Migration (In Progress)

A Next.js version is being developed in the `nextjs/` directory:
- **Stack:** Next.js 14 + React + TypeScript + Prisma + PostgreSQL
- **Auth:** NextAuth.js
- **Status:** Work in progress (see `features/PROJ-4-nextjs-scaffold.md`)
- **Goal:** Modern React architecture with proper SSR/SSG

The current Express/SQLite app remains the production version until the Next.js migration is complete.

## Useful Resources

- `specification.md` — Full API documentation and architecture details
- `CLAUDE.md` — Quick reference guide
- `features/INDEX.md` — Current development status
- `.env.example` — Environment configuration template

## Getting Help

If you're unsure about something:
1. Check `specification.md` for detailed architecture info
2. Look at existing route files for code patterns
3. Review similar features in `features/`
4. Use the `help` skill: `.claude/skills/help/SKILL.md`
