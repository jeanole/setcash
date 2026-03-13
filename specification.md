# SetCash Specification

> Living document. Update this file whenever features are added, changed, or planned.

**Version:** 2.0.0 (Next.js)
**Industry Context:** Film Production & Media Projects
**Stack:** Next.js 14 (App Router) · React 18 · TypeScript · Tailwind CSS 4 · Prisma 5 · PostgreSQL · NextAuth.js v5
**Deployment:** Docker + docker-compose; push to `production` branch triggers CI/CD pipeline

---

## 1. System Overview

SetCash is a multi-tenant, web-based expense tracking and budget management system designed for film productions and media projects. The goal is an easy-to-use interface for handling expenses, budgeting, and advance payment (V-Geld) tracking. Transparency and overview are paramount — during running projects, time is tight and keeping an overview is crucial.

**Core Principles:**

- Strict project isolation (all queries scoped by `project_id`)
- App Shell layout with persistent header, collapsible sidebar, and single-pane content area
- Deterministic financial calculations (netto-based budgets, brutto user entry)
- Multi-axis budget allocation (Motive × Category)
- Advance payment tracking (V-Geld)
- Full audit history (edit logs on every bill change)
- AI-powered OCR for receipt data extraction
- Telegram ingestion (per-project bots)
- Export-ready architecture (PDF, Excel, Google Sheets, ZIP)
- Cinematic UI theme inspired by the film industry

---

## 2. Tech Stack

### Frontend

| Technology | Purpose |
|---|---|
| Next.js 14.2 (App Router) | Full-stack React framework (SSR + CSR) |
| React 18.3 | UI library |
| TypeScript 5.6 | Type safety |
| Tailwind CSS 4.0 | Utility-first styling with custom CSS variables |
| Lucide React | Icon library |
| Sonner | Toast notifications |
| Cropperjs | Client-side image cropping |

### Backend

| Technology | Purpose |
|---|---|
| Next.js API Routes | REST API layer |
| Prisma 5.22 | ORM with PostgreSQL |
| NextAuth.js v5 (beta) | Authentication (JWT sessions) |
| bcryptjs | Password hashing |
| Formidable | Multipart file upload parsing |
| Zod | Input validation |
| Upstash Redis | Rate limiting (with mock fallback for dev) |
| Resend | Transactional email (password reset, verification) |
| PDFKit | PDF generation |
| ExcelJS | Excel export |
| Archiver | ZIP creation |
| node-telegram-bot-api | Telegram bot polling |
| OpenAI / Google Gemini / Anthropic APIs | OCR / AI bill analysis |

### Infrastructure

| Technology | Purpose |
|---|---|
| PostgreSQL | Primary database |
| Docker + docker-compose | Containerized deployment |
| Edge Middleware | Auth verification at the edge |

---

## 3. Routing Architecture

### 3.1 Public Routes

| Route | Purpose |
|---|---|
| `/` | Combined landing page + login form (redirects authenticated users to `/dashboard`) |
| `/forgot-password` | Password reset initiation |
| `/reset-password` | Password reset completion (token-based) |
| `/verify-email` | Email verification (token-based) |
| `/accept-invite` | Accept project invitation (creates membership after auth) |

### 3.2 Protected Routes (require authentication)

| Route | Purpose |
|---|---|
| `/dashboard` | Main overview (SSR, server component) |
| `/bills` | Bills list — filtering, sorting, pagination, bulk delete |
| `/bills/new` | Create new bill — image upload, crop, amounts, allocations |
| `/bills/[id]` | Bill detail — full edit, image gallery, allocation editor, history |
| `/budget` | Budget matrix — interactive grid with spending overlay |
| `/spending` | Spending overview — by motive or category tab |
| `/vgeld` | V-Geld transfers and balance management |
| `/reports` | Reports hub — PDF/Excel/Google Sheets/ZIP exports |

### 3.3 Settings Routes (protected, some admin-gated)

| Route | Access | Purpose |
|---|---|---|
| `/settings` | All | Settings navigation hub |
| `/settings/projects` | All | Project list, create, switch, resign, delete |
| `/settings/members` | Admin+ | Member management (add, remove, role, position) |
| `/settings/categories` | Admin+ | Category CRUD with budgets |
| `/settings/motives` | Admin+ | Motive CRUD with budgets |
| `/settings/positions` | Admin+ | Position/job title management |
| `/settings/ai-analysis` | Admin+ | OCR provider config (OpenAI, Gemini, Claude) |
| `/settings/telegram` | All | Link personal Telegram account |
| `/settings/linked-accounts` | All | View linked social/Telegram accounts |

### 3.4 Middleware

Edge-compatible middleware (`middleware.ts`) protects all routes except public ones. Unauthenticated requests are redirected to `/` with a callback URL parameter.

---

## 4. UI Architecture

### 4.1 App Shell

The application uses a persistent App Shell layout (`AppShell` component):

```
+----------------------------------------------+
| Header (always visible)                       |
|  [☰ Burger] [Project Name] [User] [Role] [🔔]|
+------+---------------------------------------+
|      |                                       |
| Side | Main Content Area                     |
| bar  |   (single pane at a time)             |
|      |                                       |
+------+---------------------------------------+
| Footer (GitHub link, version)                 |
+----------------------------------------------+
```

### 4.2 Header Bar

Always-visible top bar with:
- Burger menu button (toggles sidebar)
- Current project name + subtitle
- Logged-in user email
- User role in current project (e.g., "Owner", "Admin", "Member")
- Super-admin indicator if applicable (e.g., "/ Super Admin")
- Notification bell with unread badge count
- Telegram bot status indicator

Updates immediately on project switch.

### 4.3 Sidebar

Slide-out overlay navigation (hidden by default, `translateX(-100%)`):

```
+---------------------------+
| Project Title / Subtitle  |
+---------------------------+
| NAVIGATION                |
|   Dashboard               |
|   Bills                   |
|   Spending                |
|   Budget Matrix           |
|   Reports                 |
|   V-Geld                  |
+---------------------------+
| SETTINGS                  |
|   Settings                |
|   Super Admin (if SA)     |
+---------------------------+
| Project Switcher          |
|   + New Project           |
+---------------------------+
| Sign Out          version |
+---------------------------+
```

- Dark backdrop behind sidebar when open
- Active nav link highlighted with indigo accent
- All content reloads on project switch

### 4.4 Project Creation

Any authenticated user can create a project:
- "New Project" button in sidebar / settings
- Form: project name + subtitle
- Creator becomes project **owner**
- Default motive ("Default"), category ("Uncategorized"), and position ("Misc") are seeded
- New project auto-selected after creation

### 4.5 Project Switcher

Dropdown component to quickly switch the active project context. Updates JWT session with new `currentProjectId`, `currentProjectRole`, and `currentProjectName`.

---

## 5. Roles & Access Control

All higher roles inherit abilities of lower roles.

### 5.1 Global Role

Stored in `User.superAdmin` (boolean).

If true:
- Access to Super-Admin modal
- Full system control over all projects and users
- Can access any project without membership
- Bypasses project-level role checks

**Default admin:** Created on first run from `ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars.

### 5.2 Project Roles

Stored in `ProjectMember.projectRole`.

| Role | Platform Access | Responsibilities |
|---|---|---|
| **Super-Admin** | Full platform | Global user/project management, security |
| **Owner** | Full project | All admin + delete project, promote/demote owners |
| **Admin** | Project management | Manage members, positions, budget, approve bills, OCR, Telegram |
| **User** | Project participation | Upload bills, view spending, view own V-Geld balance, edit own drafts |

### 5.3 Role Matrix

| Capability | User | Admin | Owner | Super-Admin |
|---|---|---|---|---|
| Upload bills | ✓ | ✓ | ✓ | ✓ |
| View spending | ✓ | ✓ | ✓ | ✓ |
| View own V-Geld | ✓ | ✓ | ✓ | ✓ |
| Edit own draft bills | ✓ | ✓ | ✓ | ✓ |
| Link Telegram account | ✓ | ✓ | ✓ | ✓ |
| Manage members | | ✓ | ✓ | ✓ |
| Manage positions | | ✓ | ✓ | ✓ |
| Manage motives/categories | | ✓ | ✓ | ✓ |
| Manage budget matrix | | ✓ | ✓ | ✓ |
| Manage V-Geld transfers | | ✓ | ✓ | ✓ |
| Approve/reject bills | | ✓ | ✓ | ✓ |
| Trigger OCR analysis | | ✓ | ✓ | ✓ |
| Configure Telegram bot | | ✓ | ✓ | ✓ |
| Bulk delete bills | | ✓ | ✓ | ✓ |
| Delete project | | | ✓ | ✓ |
| Promote to owner | | | ✓ | ✓ |
| Manage all users globally | | | | ✓ |
| Access any project | | | | ✓ |

**Note:** A user's Position (e.g., "Gaffer") is metadata tied to their membership in a specific project, not their global account.

---

## 6. Database Schema (Prisma / PostgreSQL)

### 6.1 Core Models

| Model | Purpose |
|---|---|
| `User` | Global accounts — email, hashed password, `superAdmin` flag, `emailVerified`, `defaultProjectId` |
| `Project` | Tenant containers — `name`, `subtitle`, timestamps |
| `ProjectMember` | User ↔ Project junction — `projectRole` (user/admin/owner), position reference |
| `ProjectPosition` | Project-specific job titles (e.g., Gaffer, Props) |
| `ProjectSettings` | Per-project key-value config (OCR keys, Telegram settings) |

### 6.2 Financial Models

| Model | Purpose |
|---|---|
| `Bill` | Expense records — status, date, vendor, item, comment, brutto amounts (19%/7%/0%), netto, `telegramCaption` |
| `BillImage` | Receipt images — file path, sort order, OCR status |
| `BillMotive` | Bill → Motive allocation (percentage) |
| `BillCategory` | Bill → Category allocation (percentage) |
| `Motive` | First budget axis — name + budget amount per project |
| `Category` | Second budget axis — name + budget amount per project |
| `BudgetMatrix` | Budget per Motive × Category intersection |
| `Vgeld` | Advance money transfers between project members |

### 6.3 Audit & Integration Models

| Model | Purpose |
|---|---|
| `EditLog` | Audit trail — tracks all bill changes (user, field, old/new values) |
| `OcrLog` | OCR job history — provider, status, AI response, extracted fields |
| `Notification` | In-app notifications (type, message, project, read status) |
| `TelegramLink` | Maps Telegram user IDs to app users per project |
| `TelegramLinkCode` | Short-lived 6-digit linking codes (expiring) |

### 6.4 Auth Token Models

| Model | Purpose |
|---|---|
| `PasswordResetToken` | Email-based password reset (token + expiry) |
| `EmailVerificationToken` | Email verification (token + expiry) |
| `InvitationToken` | Project invitation acceptance (email + project + role + expiry) |

### 6.5 Bill Status Enum

```
draft → confirmed → pending → approved → paid
                            → rejected
```

| Status | Description |
|---|---|
| `draft` | Created via Telegram or incomplete submission; excluded from all calculations |
| `confirmed` | Complete bill (auto-promoted when any brutto > 0) |
| `pending` | Submitted for approval |
| `approved` | Admin-approved |
| `rejected` | Admin-rejected; excluded from spending calculations |
| `paid` | Payment completed |

### 6.6 Protected Defaults

Cannot be renamed or deleted:
- Motive: **"Default"** — auto-receives remainder allocation to reach 100%
- Category: **"Uncategorized"** — auto-receives remainder allocation
- Position: **"Misc"**

---

## 7. Authentication

### 7.1 Providers

| Provider | Details |
|---|---|
| **Credentials** | Email + bcrypt password; validates against `User` table |
| **Google OAuth** | Auto-creates user on first login; marks email as verified |

### 7.2 Session Strategy

JWT-based (stateless). Session payload:

```typescript
{
  user: {
    id: string
    email: string
    role: 'user' | 'admin' | 'owner' | 'superadmin'
    currentProjectId: string | null
    currentProjectRole: 'user' | 'admin' | 'owner' | null
    currentProjectName: string | null
  }
}
```

### 7.3 Email-Based Auth Flows

| Flow | Endpoint | Details |
|---|---|---|
| **Sign Up** | `POST /api/auth/signup` | Only if `EXTERNAL_REGISTRATION=true`; sends verification email |
| **Email Verification** | `POST /api/auth/verify-email` | Token-based; marks `emailVerified = true` |
| **Resend Verification** | `POST /api/auth/resend-verification` | Rate limited: 1 per 2 min |
| **Forgot Password** | `POST /api/auth/forgot-password` | Sends reset link via Resend; rate limited: 1 per 5 min |
| **Reset Password** | `POST /api/auth/reset-password` | Token-based password change |
| **Accept Invite** | `POST /api/auth/accept-invite` | Creates ProjectMember after signup/login |

### 7.4 Password Rules

- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one digit

---

## 8. Financial Engine

### 8.1 Tax System

Three VAT tiers: **19%**, **7%**, **0%**

User enters gross (brutto) values only:

```
Netto = Brutto / (1 + rate)
```

System computes:
- Netto per tier
- Total Netto
- Total Brutto

Draft and rejected bills are excluded from all calculations.

### 8.2 Multi-Allocation Logic

Bills can be split across:
- Multiple motives (percentage-based)
- Multiple categories (percentage-based)

Stored in junction tables (`BillMotive`, `BillCategory`).

```
allocated_netto = bill_netto × percentage / 100
```

Rules:
- Motive total must equal 100%
- Category total must equal 100%
- Default / Uncategorized auto-fill remainder if needed

### 8.3 V-Geld (Advance Money)

Straightforward subtraction model for per-user cash flow tracking:

```
Current Balance = Total Advances Received − Total Expenses Submitted
```

- Every confirmed bill is subtracted from the submitter's advance pool
- Users see their own balance
- Admins/Owners see all user balances and can create transfers
- Draft and rejected bills excluded from balance calculations

### 8.4 Brutto/Netto Toggle

Spending overview and budget matrix support toggling between netto-based and brutto-based views. Official budget tracking uses netto by default.

---

## 9. Content Panes

### 9.1 Dashboard

Server-rendered overview page. Entry point after login.

### 9.2 Bills List (`/bills`)

| Feature | Details |
|---|---|
| Pagination | 25 bills per page |
| Sorting | Clickable column headers |
| Filters | Person, Motive, Category, Position, Type, Date range, Full-text search |
| Status badges | Color-coded: draft (warm-tinted row), confirmed, pending, approved, rejected, paid |
| Bulk actions | Bulk delete with confirmation dialog (admin/owner only) |
| Row actions | Edit, delete, view detail |
| Draft display | Red "Entwurf" badge, warm-tinted row background |

### 9.3 New Bill (`/bills/new`)

| Feature | Details |
|---|---|
| Image upload | Multi-image (max 10), drag-drop, camera capture |
| Image crop | Client-side cropping (Cropperjs) before upload |
| Form fields | Date, Vendor, Item, Comment, Bill Number (auto or custom) |
| Amounts | Three brutto inputs (19%, 7%, 0%); netto auto-calculated |
| Bill type | Kauf / Leih / Verbrauch |
| Allocations | Motive allocation widget + Category allocation widget |
| Telegram drafts | Appear here for completion |

### 9.4 Bill Detail (`/bills/[id]`)

| Feature | Details |
|---|---|
| Header | Status badge, bill number, dates, amount summary |
| Edit form | All fields + allocations editable |
| Image gallery | Carousel with fullscreen viewer, reorder, add/delete images |
| OCR analysis | Trigger AI analysis (admin), verify extracted fields |
| History timeline | Edit log sidebar (timestamp, user, field changes) |
| Status management | Admin can change status (confirm, approve, reject, mark paid) |

### 9.5 Spending (`/spending`)

Netto-based budget monitoring with brutto/netto toggle.

**Tabs:**
- **By Motive:** Budget, Spent, Remaining, % used per motive
- **By Category:** Same metrics per category

**Color coding:**
- Red: Over budget
- Orange: >80% utilized
- Green: Within budget

Grand totals displayed.

### 9.6 Budget Matrix (`/budget`)

Interactive 2D grid:
- **Rows:** Motives
- **Columns:** Categories
- **Cells:** Editable budget amount (admin/owner) with spending overlay
- Brutto/netto toggle for spending view
- Row and column totals
- Variance tracking (budget vs. spent)
- PDF export (landscape)

### 9.7 V-Geld (`/vgeld`)

| Feature | Details |
|---|---|
| Transfer list | All V-Geld transfers for current project |
| Balance view | Per-user balance (advances − expenses) |
| Analysis | Who owes whom |
| Create transfer | Admin only — select user, amount, description |

### 9.8 Reports (`/reports`)

| Export | Format | Contents |
|---|---|---|
| User Bill Report | PDF | V-Geld summary, bills table, individual bill pages with images (each on new page), final balance |
| Budget Matrix | PDF | Landscape, color-coded grid, row/column totals |
| Bills Export | Excel | All fields + allocations + V-Geld + Budget Matrix worksheets |
| Images Export | ZIP | All bill images organized by project/uploader/date |
| Google Sheets | Sync | Push/pull bills to configured sheet |

---

## 10. Settings

### 10.1 Project Identity

- Project name + subtitle fields
- Save updates header and sidebar immediately

### 10.2 Members (Admin+)

- Add members by email (with role selection)
- Invite flow: generates `InvitationToken`, sends email via Resend
- Role assignment: User / Admin / Owner
- Position assignment from project positions
- Owner promotion restricted to current owners and super-admins
- Remove member

### 10.3 Positions (Admin+)

- CRUD for project job titles
- Protected default: "Misc" cannot be deleted or renamed
- Positions are assigned to members

### 10.4 Motives (Admin+)

- CRUD with budget amount per motive
- Protected default: "Default" cannot be deleted
- Auto-receives remainder allocation

### 10.5 Categories (Admin+)

- CRUD with budget amount per category
- Protected default: "Uncategorized" cannot be deleted
- Auto-receives remainder allocation

### 10.6 AI Analysis / OCR (Admin+)

Configurable OCR provider with encrypted API key storage (AES-256-GCM):

| Provider | Model |
|---|---|
| OpenAI | GPT-4 Vision |
| Google Gemini | Gemini Pro Vision |
| Anthropic Claude | Claude Opus 3 |

**OCR Flow:**
1. Admin triggers analysis on a bill (`POST /api/bills/[id]/analyse`)
2. Server returns `202 Accepted` (fire-and-forget)
3. Background job sends receipt images to AI provider
4. Extracts: date, vendor, amounts, tax rates
5. Client polls status (`GET /api/bills/[id]/ocr-status`)
6. Admin verifies/corrects extracted fields
7. All OCR jobs logged in `OcrLog` table

**Security:**
- API keys encrypted at rest with AES-256-GCM
- SSRF protection prevents private IP access in AI calls

### 10.7 Telegram

- Personal: Link/unlink Telegram account via 6-digit code
- Admin: Enable/disable bot, configure bot token, view linked accounts, restart bot

### 10.8 Linked Accounts

View all linked accounts (Telegram, Google OAuth).

### 10.9 Projects Overview

- List all projects the user is a member of
- Star/switch to make a project active
- Resign from projects (non-owners)
- Delete project (owners only, when no other members remain)
- Create new project

---

## 11. Super-Admin

Accessible only if `User.superAdmin = true`. Launched as a fullscreen modal from the sidebar.

### 11.1 Users Tab

| Feature | Details |
|---|---|
| User list | All global users (email, super-admin badge, project count) |
| Create user | Email + password with validation rules |
| Grant/revoke super-admin | Toggle super-admin flag |
| Reset password | Force password reset for any user |
| Delete user | Remove user and all memberships |

### 11.2 Projects Tab

| Feature | Details |
|---|---|
| Project list | All projects (name, subtitle, created, member count) |
| Members sub-modal | Per-project member management (add/remove, role, position) |
| Position management | Per-project position CRUD within sub-modal |

Operates outside project context (global scope).

---

## 12. Telegram Integration

Each project may configure one bot.

### 12.1 Setup Flow

1. Owner/Admin creates a bot via @BotFather, copies the token
2. Owner/Admin pastes token in Settings → Telegram, enables it, saves
3. Bot starts polling; restarts on settings change
4. Per-project bot instances stored in `globalThis` map (survives HMR)

### 12.2 User Linking Flow

1. User navigates to Settings → Telegram
2. Generates a 6-digit code (valid for 10 minutes)
3. User sends `/link <code>` to the project bot
4. Bot stores `telegramUserId` → `userEmail` mapping in `TelegramLink`

### 12.3 Bill Submission Flow

1. User sends photo(s) to bot
2. Album (`media_group_id`): buffered for 1.5s, then processed as one bill
3. Bot downloads photos, creates `draft` bill with all images
4. Caption stored in `telegramCaption` for LLM extraction
5. Bot sends confirmation reply
6. Draft appears in Bills list with warm-tinted background

### 12.4 Draft Lifecycle

- Status = `draft`
- Excluded from spending/budget calculations
- Auto-promoted to `confirmed` when any brutto amount > 0 is saved

---

## 13. Image Management

| Feature | Details |
|---|---|
| Upload | Up to 10 images per bill; drag-drop + camera capture |
| Cropping | Client-side crop via Cropperjs before upload |
| Storage | Filesystem (`data/uploads/`), served via `GET /api/uploads/[[...path]]` with project access check |
| Gallery | Lightbox/carousel with fullscreen viewer |
| Reorder | Drag-based sort order management |
| Add/Remove | Add or delete images on existing bills |
| Export | ZIP download organized by project/uploader/date |

---

## 14. Notifications

### 14.1 Trigger Events

| Event | Recipient |
|---|---|
| Invited to a project | Invited user |

### 14.2 UI

- Bell icon in header with unread badge count
- Dropdown panel (newest first)
- Each notification: event description, project name, timestamp
- Click navigates to / switches to the relevant project
- Mark as read individually or "mark all as read"

### 14.3 Storage

`Notification` model: `id`, `userEmail`, `type`, `message`, `projectId`, `isRead`, `createdAt`

---

## 15. API Reference

### 15.1 Authentication

| Method | Endpoint | Purpose |
|---|---|---|
| `*` | `/api/auth/[...nextauth]` | NextAuth handler (login, logout, callback, session) |
| `POST` | `/api/auth/signup` | Register new user (if `EXTERNAL_REGISTRATION` enabled) |
| `POST` | `/api/auth/verify-email` | Verify email with token |
| `POST` | `/api/auth/resend-verification` | Resend verification email |
| `POST` | `/api/auth/forgot-password` | Initiate password reset |
| `POST` | `/api/auth/reset-password` | Complete password reset |
| `POST` | `/api/auth/accept-invite` | Accept project invitation |

### 15.2 Bills

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/bills` | List project bills (with motives, categories, images) |
| `POST` | `/api/bills` | Create bill (multipart form with images) |
| `GET` | `/api/bills/[id]` | Get bill detail |
| `PUT` | `/api/bills/[id]` | Update bill (auto-promotes draft→confirmed if brutto > 0) |
| `DELETE` | `/api/bills/[id]` | Delete bill (cascade: images, allocations) |
| `PATCH` | `/api/bills/[id]/status` | Update bill status (admin only) |
| `POST` | `/api/bills/[id]/analyse` | Trigger OCR analysis (admin, fire-and-forget) |
| `GET` | `/api/bills/[id]/ocr-status` | Poll OCR job status |
| `POST` | `/api/bills/[id]/verify-field` | Verify OCR-extracted field |
| `GET` | `/api/bills/[id]/images` | List bill images |
| `POST` | `/api/bills/[id]/images` | Add images to existing bill |
| `DELETE` | `/api/bills/[id]/images/[imageId]` | Delete image |
| `POST` | `/api/bills/[id]/images/reorder` | Reorder images |
| `POST` | `/api/bills/bulk-delete` | Bulk delete bills |
| `GET` | `/api/bills/log` | Fetch edit logs (audit trail) |

### 15.3 Projects

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/projects` | List user's project memberships |
| `POST` | `/api/projects` | Create project (creator = owner, seeds defaults) |
| `POST` | `/api/projects/switch` | Switch active project (updates JWT session) |
| `GET` | `/api/projects/[id]` | Get project detail |
| `PUT` | `/api/projects/[id]` | Update project name/subtitle |
| `DELETE` | `/api/projects/[id]` | Delete project (owner only) |
| `POST` | `/api/projects/[id]/resign` | Leave project |
| `POST` | `/api/projects/[id]/invite` | Invite member by email |

### 15.4 Project Members & Positions

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/projects/[id]/members` | List project members |
| `POST` | `/api/projects/[id]/members` | Add member |
| `PATCH` | `/api/projects/[id]/members/[memberId]` | Update role/position |
| `DELETE` | `/api/projects/[id]/members/[memberId]` | Remove member |
| `GET` | `/api/projects/[id]/positions` | List positions |
| `POST` | `/api/projects/[id]/positions` | Create position |
| `PATCH` | `/api/projects/[id]/positions/[posId]` | Update position |
| `DELETE` | `/api/projects/[id]/positions/[posId]` | Delete position |

### 15.5 Project Settings & Taxonomy

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/project-settings` | Get project settings |
| `PUT` | `/api/project-settings` | Update project settings |
| `GET` | `/api/projects/[id]/categories` | List categories |
| `POST` | `/api/projects/[id]/categories` | Create category |
| `PATCH` | `/api/projects/[id]/categories/[catId]` | Update category |
| `DELETE` | `/api/projects/[id]/categories/[catId]` | Delete category |
| `GET` | `/api/projects/[id]/motives` | List motives |
| `POST` | `/api/projects/[id]/motives` | Create motive |
| `PATCH` | `/api/projects/[id]/motives/[motId]` | Update motive |
| `DELETE` | `/api/projects/[id]/motives/[motId]` | Delete motive |
| `GET` | `/api/categories` | Quick list (shortcut) |
| `GET` | `/api/motives` | Quick list (shortcut) |

### 15.6 Budget & Financial

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/budget-matrix` | Fetch matrix with spending (raw SQL for performance) |
| `POST` | `/api/budget-matrix/bulk-update` | Update multiple budget cells |
| `GET` | `/api/spending` | Spending by motive or category |
| `GET` | `/api/vgeld` | List V-Geld transfers |
| `POST` | `/api/vgeld` | Create transfer (admin only) |
| `GET` | `/api/vgeld/[id]` | Get transfer detail |
| `GET` | `/api/vgeld/analysis` | Calculate who owes whom |
| `GET` | `/api/vgeld/balance` | Get balance sheet |

### 15.7 Super-Admin

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/admin/projects` | List all projects with member counts |
| `GET` | `/api/admin/projects/[id]` | Get project with all members |
| `PUT` | `/api/admin/projects/[id]` | Update project |
| `POST` | `/api/admin/projects/[id]/members` | Add member to any project |
| `PATCH` | `/api/admin/projects/[id]/members/[mId]` | Update member |
| `DELETE` | `/api/admin/projects/[id]/members/[mId]` | Remove member |
| `GET/POST/PATCH/DELETE` | `/api/admin/projects/[id]/positions/*` | Position CRUD |
| `GET` | `/api/admin/users` | List all users |
| `POST` | `/api/admin/users` | Create user |
| `GET` | `/api/admin/users/[email]` | Get user |
| `PATCH` | `/api/admin/users/[email]` | Update user |
| `DELETE` | `/api/admin/users/[email]` | Delete user |

### 15.8 Exports & Reports

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/admin/export/excel` | Export bills to Excel |
| `GET` | `/api/admin/export/google-sheet` | Sync to Google Sheets |
| `GET` | `/api/admin/export/google-config` | Get Google integration settings |
| `GET` | `/api/admin/export/images` | Export images as ZIP |
| `GET` | `/api/reports/users` | Get user list for reports |
| `GET` | `/api/reports/user/[email]/pdf` | Generate user PDF report |
| `GET` | `/api/reports/budget-matrix/pdf` | Generate budget matrix PDF |

### 15.9 Telegram

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/telegram/link-code` | Generate 6-digit linking code |
| `GET` | `/api/telegram/links/me` | Get user's Telegram links |
| `GET` | `/api/telegram/status` | Get Telegram user status |
| `GET` | `/api/admin/telegram/links` | List all links (admin) |
| `DELETE` | `/api/admin/telegram/links/[id]` | Remove link (admin) |
| `GET` | `/api/admin/telegram/bot-status` | Get bot polling status |
| `POST` | `/api/admin/telegram/restart` | Restart bot |
| `GET` | `/api/admin/telegram/settings` | Get Telegram settings |
| `PUT` | `/api/admin/telegram/settings` | Update Telegram settings |

### 15.10 Utility

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/bug-reports` | Submit bug report with screenshot |
| `GET` | `/api/bug-reports/screenshots/[filename]` | Fetch bug report screenshot |
| `GET` | `/api/uploads/[[...path]]` | Serve uploaded images (with access check) |

---

## 16. Rate Limiting

Powered by Upstash Redis (with mock fallback for local dev).

| Scope | Limit |
|---|---|
| Bill creation | 10 per minute per user |
| OCR re-analysis | 5 per minute per user |
| Forgot password | 1 per 5 minutes per email |
| Sign up | 3 per 10 minutes per IP |
| Resend verification | 1 per 2 minutes per email |
| Bug reports | 3 per 10 minutes per user |

---

## 17. Security

### 17.1 Authentication & Sessions

- bcrypt password hashing (8+ chars, uppercase + lowercase + digit)
- JWT-based sessions (stateless, edge-verifiable)
- Rate limiting on all auth endpoints
- Email verification for new signups
- Token-based password reset (expiring)

### 17.2 Authorization

- Edge middleware blocks unauthenticated access to protected routes
- Every API route verifies session + project membership
- Super-admin bypass only at global level
- Role-based middleware: `getCurrentUser()` checks project role from JWT

### 17.3 Data Protection

- API keys encrypted at rest (AES-256-GCM) for OCR and Telegram
- Telegram bot tokens encrypted in project settings
- SSRF protection in OCR calls (blocks private IP ranges)
- File uploads served through API with project access check (no direct filesystem access)
- Parameterized queries via Prisma (SQL injection prevention)

### 17.4 Security Headers

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: origin-when-cross-origin`
- `Strict-Transport-Security` with `includeSubDomains`

---

## 18. Multi-Tenant Principles

- All queries scoped by `project_id` (Prisma `where` clauses)
- Strict project isolation — no cross-project data leakage
- Super-admin bypass only at global level (explicit)
- Any user can create projects (becomes owner)
- Owner controls project lifecycle (including deletion when no other members)
- JWT session carries `currentProjectId` for server-side scoping

---

## 19. Design System

### 19.1 Theme

| Variable | Value | Usage |
|---|---|---|
| `--vb-accent` | `#6366f1` (Indigo) | Primary accent color |
| `--vb-accent-hover` | `#4f46e5` | Hover state |
| `--vb-content-bg` | White | Content area background |
| `--vb-shadow-xl` | Custom | Elevated component shadow |

### 19.2 Cinematic Effects

Film-industry inspired UI polish:

| Effect | Component | Animation |
|---|---|---|
| Film Roll Navigation | `FilmRollNav` | Scrolling film strip background (`vb-film-roll`) |
| Cinematic Button | `CinematicButton` | Film-roll border with clapperboard trigger |
| Clapperboard Toast | `ClapperboardToast` | Clapperboard flip animation (`vb-clapper`) |
| Rise Animation | Various | Fade-in + translate up (`vb-rise`, 400ms ease-out) |

### 19.3 Responsive Breakpoints

| Breakpoint | Width | Target |
|---|---|---|
| Mobile | 375px | Smartphones |
| Tablet | 768px | Tablets |
| Desktop | 1440px | Desktop browsers |

---

## 20. Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Yes | JWT signing key |
| `NEXTAUTH_URL` | Yes | Application callback URL |
| `ADMIN_EMAIL` | Yes | Initial super-admin email |
| `ADMIN_PASSWORD` | Yes | Initial super-admin password |
| `GOOGLE_CLIENT_ID` | No | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth client secret |
| `RESEND_API_KEY` | No | Resend API key for transactional emails |
| `SESSION_SECRET` | No | OCR key encryption base (falls back to `NEXTAUTH_SECRET`) |
| `OCR_ENCRYPTION_SECRET` | No | Alternative encryption key for API keys at rest |
| `UPSTASH_REDIS_REST_URL` | No | Upstash Redis URL for rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | No | Upstash Redis token |
| `EXTERNAL_REGISTRATION` | No | Enable self-service signup (`true`/`false`) |
| `NEXT_PUBLIC_APP_URL` | No | Public-facing app URL |
| `GITHUB_TOKEN` | No | GitHub API token (bug reports) |

---

## 21. Custom Hooks

Client-side data fetching and state management:

| Hook | Purpose |
|---|---|
| `useBills` | Fetch, filter, sort, paginate, delete, bulk-delete bills |
| `useProjects` | Fetch projects, create, switch, resign, delete |
| `useCategories` | CRUD for project categories |
| `useMotives` | CRUD for project motives |
| `usePositions` | CRUD for project positions |
| `useMembers` | CRUD for project members |

---

## 22. Component Inventory

### Layout (4)
`AppShell` · `Header` · `Sidebar` (via `FilmRollNav`) · `ProjectSwitcher`

### Bills (11)
`BillList` · `BillFilters` · `BillForm` · `BillImageUpload` · `ImageGallery` · `CropModal` · `BillDetailHeader` · `BillStatusBadge` · `OcrFieldVerification` · `BillHistoryTimeline` · `AllocationWidget`

### Budget & Spending (5)
`BudgetMatrixClient` · `BudgetMatrixTable` · `BudgetMatrixCell` · `SpendingPageClient` · `SpendingTable`

### Settings (13)
`SettingsTabs` · `ProjectsList` · `NewProjectModal` · `CategoriesList` · `MotivesList` · `PositionsList` · `PositionRow` · `AddPositionForm` · `MembersTable` · `MembersPageClient` · `InviteMemberModal` · `ProjectIdentityForm` · `OcrSettingsForm`

### Telegram & Accounts (3)
`TelegramSettings` · `LinkedAccountsTable` · `LinkAccountModal`

### Super-Admin (7)
`SuperAdminModal` · `UsersTab` · `ProjectsTab` · `CreateUserModal` · `AddMemberForm` · `PasswordResetModal` · `MembersSubModal`

### Reports (2)
`ReportsPageClient` · `GoogleSheetsConfig`

### UI Primitives (5)
`DataTable` · `Pagination` · `PositionSelect` · `RoleSelect` · `ConfirmationDialog`

### Cinematic (3)
`CinematicButton` · `ClapperboardToast` · `FilmRollNav`

### Auth (2)
`LoginForm` · `SignOutButton`

### Other (1)
`BugReportModal`
