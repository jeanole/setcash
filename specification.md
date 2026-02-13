# vBudget Specification

> Living document. Update this file whenever features are added, changed, or planned.

---

## Project Overview

vBudget is a multi-tenant, web-based expense tracking and budget management system.

**Stack:** Node.js + Express + SQLite (better-sqlite3) + vanilla HTML/JS + PDFKit + Google Sheets API
**Version:** 1.0.0

---

## Architecture

```
vbudget/
├── server.js              # Express backend (~3600 lines)
├── package.json
├── public/
│   ├── index.html         # Main user app
│   ├── admin.html         # Project admin panel
│   ├── superadmin.html    # Global super-admin panel
│   └── style.css          # Shared styles
├── data/
│   ├── vbudget.db         # SQLite (WAL mode)
│   ├── uploads/           # User-uploaded images
│   ├── sessions/          # Session files
│   └── google-credentials.json
└── .env                   # PORT, SESSION_SECRET, DEV_MODE
```

---

## Database Schema

| Table | Purpose |
|-------|---------|
| `users` | System users (email, hash, super_admin flag) |
| `projects` | Multi-tenant project containers |
| `project_members` | User ↔ project membership with role (user/admin) |
| `project_positions` | Project-specific positions for member filtering |
| `project_settings` | Per-project config (key/value JSON) |
| `motives` | Expense purposes / "Verwendungszweck" (with budget) |
| `categories` | Second categorization axis (with budget) |
| `bills` | Individual expense records |
| `bill_motives` | Multi-allocation: bill → motive % (junction) |
| `bill_categories` | Multi-allocation: bill → category % (junction) |
| `bill_images` | Normalized image storage (replaces bills.file) |
| `budget_matrix` | Budget per motive × category intersection |
| `vgeld` | Virtual currency / advance payment transfers |
| `editlog` | Audit trail for bill changes |
| `settings` | Global fallback settings |
| `roles` | Legacy global roles (kept for compat) |

### Key columns — bills
`id, date, email, bill_number, type (Kauf/Leih/Verbrauch), vendor, item, comment, motive (legacy TEXT), brutto19, brutto7, brutto0, amount (legacy), netto_amount, project_id`

### Protected defaults
- Motive **"Default"** — cannot be renamed or deleted; auto-fills allocation remainder
- Category **"Uncategorized"** — same rules
- Position **"Misc"** — same rules

---

## Roles & Access Control

| Role | Description |
|------|-------------|
| Super-Admin | Full system access, all projects, global user management |
| Project Admin | Manage project members, settings, motives, categories, budget, all bills |
| Project User | Upload bills, view spending, cannot delete |

---

## API Endpoints

### Auth
| Method | Path | Notes |
|--------|------|-------|
| GET | `/login` | Login page |
| POST | `/login` | Rate-limited (5/15 min) |
| GET | `/logout` | Destroy session |
| GET | `/api/user` | Current session info |
| POST | `/user/password` | Change own password |

### Projects
| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/projects` | List accessible projects |
| POST | `/api/projects/select/:id` | Switch active project |
| POST | `/api/projects/clear` | Clear project selection |

### Super-Admin
| Method | Path |
|--------|------|
| GET | `/api/superadmin/projects` |
| POST | `/api/superadmin/projects` |
| PUT | `/api/superadmin/projects/:id` |
| DELETE | `/api/superadmin/projects/:id` |
| GET/POST | `/api/superadmin/users` |
| PUT/DELETE | `/api/superadmin/users/:email` |
| GET/POST | `/api/superadmin/projects/:id/members` |
| PUT/DELETE | `/api/superadmin/projects/:id/members/:memberId` |
| GET/POST/PUT/DELETE | `/api/superadmin/projects/:id/positions` |

### Project Admin
| Method | Path |
|--------|------|
| GET/PUT | `/api/admin/settings` |
| POST | `/api/admin/google-credentials` |
| GET | `/api/admin/google-credentials/status` |
| GET/POST | `/api/admin/project/members` |
| PUT/DELETE | `/api/admin/project/members/:id` |
| POST/PUT/DELETE | `/api/admin/motive` / `/:id` |
| POST/PUT/DELETE | `/api/admin/category` / `/:id` |
| POST/PUT/DELETE | `/api/admin/position` / `/:id` |
| PUT | `/api/admin/budget-matrix` |
| GET | `/api/admin/export/excel` |
| GET | `/api/admin/export/images` |
| POST | `/api/admin/export/google-sheet` |

### Bills
| Method | Path |
|--------|------|
| GET | `/api/bills` — paginated, filterable |
| POST | `/upload` — multipart, up to 10 images |
| PUT | `/api/bills/:id` |
| DELETE | `/api/bills/:id` (admin) |
| POST | `/api/bills/bulk-delete` (admin) |
| POST | `/api/bills/:id/images` |
| DELETE | `/api/bills/:id/images/:imageId` |
| GET | `/api/bills/log` |
| GET | `/api/bills/by-motive` |
| GET | `/api/bills/by-category` |

### Budget & Reports
| Method | Path |
|--------|------|
| GET | `/api/budget-matrix` — matrix + spending |
| GET | `/api/budget-report` — PDF (landscape) |
| GET | `/api/report/:email` — PDF per user |
| GET | `/api/report-users` — user list for dropdown |
| GET | `/api/project-info` |

### V-Geld
| Method | Path |
|--------|------|
| GET | `/api/vgeld` |
| POST | `/api/vgeld` (admin) |
| DELETE | `/api/vgeld/:id` (admin) |
| GET | `/api/vgeld/analysis` |

### Google Sheets
| Method | Path |
|--------|------|
| POST | `/api/sync/to-sheet` |
| POST | `/api/sync/from-sheet` |

---

## Features

### Main App (`/`)

#### Upload Tab
- Multi-photo upload (up to 10) + camera capture on mobile
- Tax rate fields: Brutto 19%, 7%, 0% with auto netto calculation
- Bill type: Kauf / Leih / Verbrauch
- Vendor, item, comment, bill number fields
- Multi-allocation widget for motives (with %)
- Multi-allocation widget for categories (with %)
- Remaining % auto-fills to Default/Uncategorized

#### Bills Tab
- Paginated table (20/page), sortable columns
- Filters: person, motive, category, role/position, type, date range, text search
- Inline image gallery with carousel and full-screen viewer
- Edit bill modal (all fields + allocations + images)
- Add/delete images to existing bills
- Edit history sidebar (timestamp, user, field changes)
- Admin: bulk-delete with checkboxes
- Bill number auto-generation or custom entry

#### Spending Tab
- Spending by Motive: budget vs. spent (netto), remaining, % used
- Spending by Category: same
- Color coding: red (over budget), orange (>80%), green
- Grand totals

#### V-Geld Tab
- Transfer history table
- Per-user analysis: received, spent, remaining, %
- Admin: record new transfer, delete entries

#### Budget Tab
- Interactive matrix: motives (columns) × categories (rows)
- Editable cells with spending overlay
- Save all + PDF export button

#### Reports Tab
- Select user → generate PDF
- Includes: V-Geld summary, bills table, individual bill pages with images, balance

### Admin Panel (`/admin`)

| Tab | Features |
|-----|---------|
| Members | Add/edit/remove members, role assignment, manage positions |
| Settings | Project title, subtitle |
| Google | Sheets toggle, Sheet IDs, service account credentials upload, status |
| Export | Excel export, ZIP image download, Google Sheet push |
| Telegram | Bot token input, enable toggle, bot status indicator, linked accounts table with unlink |

### Super-Admin Panel (`/superadmin`)
- Full project CRUD
- Global user CRUD
- Per-project: member management, position management

---

## Multi-Allocation System
- Bills split across multiple motives/categories with percentages
- Stored in `bill_motives` / `bill_categories` junction tables
- Netto contribution = `bill_netto × percentage / 100`
- Budget matrix tracks cell spending per motive × category pair

---

## Tax & Currency
- Three tiers: 19%, 7%, 0%
- Netto per tier = `brutto / (1 + rate)`
- German locale: `1.234,56 €`
- Inputs accept comma or dot as decimal separator

---

## PDF Reports
1. **User Bill Report** — summary, bills table, individual pages with images, V-Geld balance
2. **Budget Matrix Report** — landscape, color-coded grid, row/col totals

---

## Excel Export
Three worksheets: **Bills** (all fields + allocations), **V-Geld**, **Budget Matrix**

---

## Google Sheets Integration
- Service account credentials stored per project
- Push all bills to sheet (append)
- Pull bills from sheet (import)
- Configurable Sheet ID + Export Sheet ID

---

## Image Management
- Up to 10 images per bill, stored in `data/uploads/`
- `bill_images` table with `sort_order`
- Legacy fallback: `bills.file` single-image column
- ZIP export organized by uploader/date

---

## Security
- bcrypt password hashing, ≥8 chars + uppercase + lowercase + digit
- Session-based auth, 24h TTL, HTTPOnly cookies
- Rate limiting: 5 login attempts / 15 min
- `ensureAuth`, `ensureAdmin`, `ensureSuperAdmin`, `ensureProjectAdmin` middleware
- XSS: all user content escaped with `escapeHtml()`
- Security headers: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection
- `/data` path blocked from direct access

---

## Dependencies

| Package | Purpose |
|---------|---------|
| express | Web framework |
| better-sqlite3 | SQLite driver |
| bcryptjs | Password hashing |
| express-session + session-file-store | Sessions |
| express-rate-limit | Login rate limiting |
| multer | File uploads |
| pdfkit | PDF generation |
| exceljs | Excel export |
| archiver | ZIP creation |
| googleapis | Google Sheets API |
| dotenv | Environment config |

---

---

## Telegram Integration

### Concept
Each project can have its own Telegram bot. Users send photos (single or album) to the bot; the bot creates a **draft bill** with the image(s) attached. The user completes the bill (amounts, vendor, etc.) in vBudget.

### Schema
| Table | Purpose |
|-------|---------|
| `telegram_links` | Maps `telegram_user_id` → `user_email` per project |
| `telegram_link_codes` | Short-lived codes for the linking flow (10 min TTL) |
| `bills.status` | `'complete'` (default) or `'draft'` (from Telegram) |
| `bills.telegram_caption` | Raw message caption — preserved for future LLM processing |

### Bot setup (per project)
1. Admin creates a bot via @BotFather, copies the token
2. Admin pastes token in Admin → Telegram tab, enables it, saves
3. Bot starts polling automatically; restarts on settings change

### User linking flow
1. User clicks "Telegram verknüpfen" in sidebar → sees a 6-char code
2. User sends `/link <code>` to the project bot
3. Bot stores `telegram_user_id` → `user_email` mapping

### Bill submission flow
1. User sends photo(s) to bot
2. If album (media_group_id): buffered for 1.5s, then processed as one bill
3. Bot downloads photo(s), creates a `draft` bill with all images attached
4. Caption stored raw in `telegram_caption` (no parsing — reserved for LLM)
5. Bot sends confirmation reply
6. Draft badge appears on Bills tab; draft rows shown in warm-tinted background

### Draft lifecycle
- Draft bills are **excluded** from all spending/budget calculations
- Auto-promoted to `complete` when any brutto amount > 0 is saved via the edit modal
- Displayed with red "Entwurf" badge in bill number cell

### Future: LLM processing
- `telegram_caption` column holds raw user text for LLM extraction
- Receipt image(s) available via `bill_images` for vision model OCR
- LLM could pre-fill: amount, vendor, item, suggested motive allocation

---

## Planned / In Progress

> Add items here as they are discussed or started. Remove when shipped.

- [ ] _(nothing planned yet — add items here)_

---

## Changelog

| Version | Date | Summary |
|---------|------|---------|
| 1.0.1 | 2026-02-12 | Telegram bot integration: per-project bot, album grouping, draft bills, link flow |
| 1.0.0 | 2026-02-12 | Initial spec: multi-project, roles, budget matrix, PDF/Excel/Sheets export, image gallery, V-Geld, edit log |
