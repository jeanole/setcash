# vBudget Specification

> Living document. Update this file whenever features are added, changed, or planned.

**Version:** 1.6.1
**Industry Context:** Film Production & Media Projects
**Stack:** Node.js + Express + SQLite (better-sqlite3) + Vanilla HTML/JS + PDFKit + ExcelJS + Google Sheets API

---

## 1. System Overview

vBudget is a multi-tenant, web-based expense tracking and budget management system designed for film productions and media projects.

**Core principles:**

- Strict project isolation
- Sidebar-driven, context-aware UI
- Deterministic financial calculations
- Multi-axis budget allocation (Motive x Category)
- Advance payment tracking (V-Geld)
- Full audit history
- Telegram ingestion (per project)
- Export-ready architecture

---

## 2. Routing Architecture

vBudget has exactly two application entry points:

| Route | Purpose |
|-------|---------|
| `/` | Main project application (single integrated interface) |
| `/superadmin` | Global system administration |

There is no separate `/admin` page.
Project administration is integrated into the main app sidebar as role-gated sections.

---

## 3. UI Architecture

### 3.1 Sidebar (Primary Navigation Hub)

The sidebar is the command center for all non-super-admin tasks. It is **persistent on desktop** (always visible, fixed left) and a **slide-out overlay on mobile** (triggered by burger menu).

#### Sidebar Structure

```
+---------------------------+
| Project Title / Subtitle  |
|   Project Switcher        |
|   + New Project           |
+---------------------------+
| User Info                 |
|   email                   |
|   role label              |
|   V-Geld balance (own)   |
+---------------------------+
| NAVIGATION                |
|   Upload                  |
|   Bills                   |
|   Spending                |
|   Budget Matrix           |
|   Reports                 |
+---------------------------+
| PROJECT MANAGEMENT        |
| (owner/admin only)        |
|   Settings                |
|   Members                 |
|   Export                  |
|   Telegram                |
+---------------------------+
| USER SETTINGS             |
|   Profile / Password      |
|   Link Telegram           |
+---------------------------+
| Logout             v1.6.1 |
+---------------------------+
```

**Behavior:**
- Desktop (md+ / 768px): Sidebar always visible (`position: fixed`), main content offset by sidebar width (288px).
- Mobile: Hidden by default (`translateX(-100%)`), slides in on burger menu tap, dark backdrop overlay.
- Active nav link highlighted with indigo background/text.
- Switching projects updates: visible title/subtitle, all queries scoped to `project_id`, sidebar context, V-Geld balance.

### 3.2 Main Content Area

The main content area displays one **content pane** at a time, driven by sidebar navigation clicks.

**Content panes (all users):**
- Upload (default landing)
- Bills
- Spending
- Budget Matrix
- Reports

**Content panes (owner/admin only):**
- Settings
- Members
- Export
- Telegram

All panes operate within the active `project_id`.

### 3.3 Project Creation

Any authenticated user can create a new project:
- "New Project" button in the sidebar project switcher section
- Simple form: project name + subtitle
- Creator automatically becomes the project **owner**
- New project auto-selected after creation

---

## 4. Roles & Access Control

All "higher" roles inherit the abilities of the roles below them.

### 4.1 Global Role

Stored in `users.super_admin` (boolean).

If true:
- Access to `/superadmin`
- Full system control
- Bypasses all project-level role checks

### 4.2 Project Roles

Stored in `project_members.project_role`.

Allowed values: `'user'`, `'admin'`, `'owner'`

| Role | Access Level | Primary Responsibilities |
|------|-------------|-------------------------|
| Super-Admin | Platform page | Global system health, user/project deletion, security |
| Owner | Main platform | Full control over their specific projects; can delete the project |
| Admin | Main platform | Manage members, positions, budget matrix, and approve bills |
| User | Main platform | Upload bills (Web/Telegram) and view personal V-Geld balance |

#### Project User
- Upload bills
- View spending
- View own V-Geld balance
- Edit own draft bills

#### Project Admin (inherits User)
- Manage members
- Manage positions
- Manage motives
- Manage categories
- Manage budget matrix
- Manage V-Geld transfers
- Delete bills
- Access Project Management sections in sidebar
- Configure exports and Telegram

#### Project Owner (inherits Admin)
- All admin permissions
- Delete the project
- Promote/demote members to/from owner role

**Note on Positions:** A user's Position (e.g., "Gaffer") is metadata tied to their membership in a specific project, not their global account.

---

## 5. Database Schema

### Core Tables

| Table | Purpose |
|-------|---------|
| `users` | Global accounts + `super_admin` flag |
| `projects` | Project containers (title, subtitle, telegram_bot_token) |
| `project_members` | User <> project with role (`user`/`admin`/`owner`) + position |
| `project_positions` | Project-specific positions |
| `project_settings` | Per-project configuration (key/value JSON) |
| `motives` | First allocation axis (with budget) |
| `categories` | Second allocation axis (with budget) |
| `budget_matrix` | Budget per motive x category intersection |
| `bills` | Expense records |
| `bill_motives` | Bill -> motive percentage (junction) |
| `bill_categories` | Bill -> category percentage (junction) |
| `bill_images` | Multiple images per bill |
| `vgeld` | Advance transfers |
| `editlog` | Audit trail |
| `telegram_links` | Telegram user mapping |
| `telegram_link_codes` | Short-lived link codes (10 min TTL) |
| `settings` | Global fallback settings |

There is no global `roles` table.

### Bills -- Key Columns

- `id`
- `date`
- `email`
- `bill_number`
- `status` (`'complete'` | `'draft'`)
- `type` (`'Kauf'` | `'Leih'` | `'Verbrauch'`)
- `vendor`
- `item`
- `comment`
- `telegram_caption`
- `brutto19`
- `brutto7`
- `brutto0`
- `netto_amount`
- `project_id`

### Protected Defaults

The following cannot be renamed or deleted:

- Motive: **"Default"**
- Category: **"Uncategorized"**
- Position: **"Misc"**

Default motive automatically receives remainder allocation to reach 100%.

---

## 6. Financial Engine

### 6.1 Tax System

Three VAT tiers: **19%**, **7%**, **0%**

User enters only gross values:

```
Netto = Brutto / (1 + rate)
```

System computes:
- Netto per tier
- Total Netto
- Total Brutto

Draft bills are excluded from all calculations.

### 6.2 Multi-Allocation Logic

Bills can be split across:
- Multiple motives
- Multiple categories

Stored in junction tables (`bill_motives`, `bill_categories`).

Allocation formula:

```
allocated_netto = bill_netto x percentage / 100
```

Rules:
- Motive total must equal 100%
- Category total must equal 100%
- Default / Uncategorized auto-fill remainder if needed

### 6.3 V-Geld (Advance Money)

A straightforward subtraction model for individual cash flow tracking within a project.

```
Current Balance = Total Advance - Total Expenses
```

- Every bill uploaded by a user is automatically subtracted from their personal advance pool for that project.
- Users see their own balance in the sidebar.
- Admins/Owners see a summary of all user balances.
- Draft bills excluded from balance calculations.

---

## 7. Content Panes

### 7.1 Upload (Default Landing)

Features:
- Multi-image upload (max 10)
- Mobile camera capture
- Bill type: Kauf / Leih / Verbrauch
- Vendor, Item, Comment fields
- Bill number (auto or custom)
- Motive allocation widget
- Category allocation widget
- Telegram drafts appear here for completion

### 7.2 Bills

Features:
- Pagination (20 per page)
- Sortable columns
- Filters: Person, Motive, Category, Position, Type, Date range, Text search
- Inline image gallery with carousel + fullscreen viewer
- Edit modal (all fields + allocations + images)
- Add/delete images to existing bills
- Bulk delete (admin/owner only)
- Edit history sidebar (timestamp, user, field changes)
- Draft badge (red "Entwurf")
- Warm-tinted draft rows

Draft bills:
- Excluded from spending & budget
- Promoted to `complete` when any brutto > 0

### 7.3 Spending

Netto-based budget monitoring.

**By Motive:** Budget, Spent, Remaining, % used
**By Category:** Same metrics

Color coding:
- Red: Over budget
- Orange: >80%
- Green: OK

Grand totals displayed.

### 7.4 Budget Matrix

Interactive matrix:
- Columns: Motives
- Rows: Categories
- Editable cells (admin/owner only)
- Spending overlay
- Save all
- PDF export (landscape)

### 7.5 Reports

User-based PDF generation. Includes:
- V-Geld summary
- Bills table
- Individual bill pages with images
- Final balance

### 7.6 Settings (Owner/Admin)

- Project title
- Project subtitle

### 7.7 Members (Owner/Admin)

- Add/edit/remove project members (invite by email)
- Role assignment (User / Admin / Owner)
- Position management (add/rename/delete)
- Owner promotion restricted to current owners and super-admins

### 7.8 Export (Owner/Admin)

- Excel export (Bills with allocations / V-Geld / Budget Matrix)
- ZIP image download
- Google Sheets: service account credentials upload, Sheet ID config, status indicator, push to sheet

### 7.9 Telegram (Owner/Admin)

- Bot token input
- Enable/disable toggle
- Bot status indicator
- Linked accounts table with unlink function

---

## 8. Super-Admin (`/superadmin`)

Only accessible if `users.super_admin = true`.

Capabilities:
- Global project CRUD
- Global user CRUD
- Per-project member management
- Per-project position management
- System oversight

Operates outside project context. Separate standalone page.

---

## 9. Telegram Integration

Each project may configure one bot.

**Setup flow:**
1. Owner/Admin creates a bot via @BotFather, copies the token
2. Owner/Admin pastes token in Settings > Telegram, enables it, saves
3. Bot starts polling automatically; restarts on settings change

**User linking flow:**
1. User clicks "Link Telegram" in sidebar user settings
2. User sees a 6-char code
3. User sends `/link <code>` to the project bot
4. Bot stores `telegram_user_id` -> `user_email` mapping

**Bill submission flow:**
1. User sends photo(s) to bot
2. If album (`media_group_id`): buffered for 1.5s, then processed as one bill
3. Bot downloads photo(s), creates a `draft` bill with all images attached
4. Caption stored raw in `telegram_caption`
5. Bot sends confirmation reply
6. Draft badge appears in Bills pane; draft rows shown with warm-tinted background

**Draft lifecycle:**
- Status = `'draft'`
- Excluded from all spending/budget calculations
- Auto-promoted to `complete` when any brutto amount > 0 is saved via edit modal

**Future:** `telegram_caption` column holds raw user text for LLM extraction. Receipt images available via `bill_images` for vision model OCR.

---

## 10. Exports

### PDF
- User Bill Report (summary, bills table, individual bill pages with images, V-Geld balance)
- Budget Matrix Report (landscape, color-coded grid, row/col totals)

### Excel
Three worksheets:
- Bills (all fields + allocations)
- V-Geld
- Budget Matrix

### Google Sheets
- Service account credentials stored per project
- Push all bills to sheet (append)
- Pull bills from sheet (import)
- Configurable Sheet ID + Export Sheet ID

---

## 11. Security

- bcrypt password hashing (8+ chars, uppercase + lowercase + digit)
- Session-based auth (24h TTL, HTTPOnly cookies)
- Rate limiting: 5 login attempts / 15 min
- Role-based middleware: `ensureAuth`, `ensureProjectAdmin`, `ensureProjectOwner`, `ensureSuperAdmin`
- XSS: all user content escaped with `escapeHtml()`
- Security headers: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection
- `/data` path blocked from direct access

---

## 12. Multi-Tenant Principles

- All queries scoped by `project_id`
- Strict project isolation
- No cross-project data leakage
- Super-admin bypass only at global level
- Any user can create projects (becomes owner)
- Owner controls project lifecycle (including deletion)

---

## 13. Image Management

- Up to 10 images per bill, stored in `data/uploads/`
- `bill_images` table with `sort_order`
- Legacy fallback: `bills.file` single-image column
- ZIP export organized by uploader/date

---

## 14. Dependencies

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
