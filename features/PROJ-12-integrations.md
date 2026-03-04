# PROJ-12: Integrations (Google Sheets + Telegram)

## Status: Planned
**Created:** 2026-03-01
**Last Updated:** 2026-03-04

## Dependencies
- Requires: PROJ-5 (auth — admin-only actions)
- Requires: PROJ-6 (PostgreSQL data)
- Requires: PROJ-10 (project settings store Sheet ID and Telegram config)

## Overview
This feature migrates the existing Express-based integrations (Telegram Bot and Google Sheets) to the Next.js architecture. Both integrations are project-scoped and managed by project admins/owners.

---

## User Stories

### Telegram Integration
- As a project admin, I want to configure a Telegram bot for my project so that team members can submit bills via photos.
- As a user, I want to link my Telegram account to the project bot so I can submit bills from my phone.
- As a user, I want to send photos to the Telegram bot and have them automatically create draft bills in vBudget.
- As a project admin, I want to see which team members have linked their Telegram accounts and be able to unlink them if needed.
- As a user, I want to receive confirmation when my Telegram-submitted bill is successfully created as a draft.

### Google Sheets Integration
- As a project admin, I want to configure Google Sheets credentials so that approved bills can be synced to a spreadsheet.
- As a project admin, I want to trigger a full sync to Google Sheets (overwrite) so that the sheet is always up-to-date after bulk changes.
- As a project admin, I want to see the sync status and any errors in the settings UI.

---

## Acceptance Criteria

### A1. Telegram Settings UI (`/app/(protected)/settings/telegram/page.tsx`)

#### A1.1 Bot Configuration Section (Admin/Owner only)
- [ ] **Bot Token Input:**
  - Masked password-style input field showing `••••••••••••••••••••••••••`
  - "Show/Hide" toggle button to reveal the token
  - "Save" button validates and stores the token in `ProjectSettings` with key `telegramBotToken`
  - Validation: Token must match pattern `\d+:[A-Za-z0-9_-]+` (numeric bot ID followed by colon and alphanumeric string)
  - Error message: "Invalid bot token format. Should be like: 123456789:ABCdefGHIjklMNOpqrSTUvwxyz"

- [ ] **Enable/Disable Toggle:**
  - Switch component labeled "Enable Telegram Bot"
  - Disabled state (grayed out) when no bot token is configured
  - When toggled ON: Bot starts polling automatically; shows "Starting..." then "Online" status
  - When toggled OFF: Bot stops polling; shows "Offline" status
  - Setting stored in `ProjectSettings` with key `telegramEnabled` (boolean)

- [ ] **Bot Status Indicator:**
  - Visual status badge showing one of:
    - 🔴 **Offline** — Bot not configured or disabled
    - 🟡 **Starting...** — Bot is initializing
    - 🟢 **Online** — Bot is polling and responsive
    - 🔴 **Error** — Bot token invalid or connection failed (show error message)
  - "Restart Bot" button visible when status is Error or for troubleshooting
  - Last updated timestamp: "Last checked: 2 minutes ago"

#### A1.2 User Linking Section (All users)
- [ ] **Link Account Flow:**
  - Button "Link Telegram Account" visible for unlinked users
  - Clicking opens a modal/dialog with:
    - Instructions: "1. Open Telegram and find your project's bot. 2. Send the command below:"
    - Generated 6-character code displayed in a copyable code block (e.g., `A1B2C3`)
    - "Copy Command" button copies `/link A1B2C3` to clipboard
    - Countdown timer showing "Expires in 9:59" (10 minute TTL)
    - "Generate New Code" button to refresh the code
  - Code stored in `TelegramLinkCode` table with 10-minute expiration

- [ ] **Linked Account Status:**
  - For linked users, show:
    - Green checkmark with "Account linked"
    - Linked date: "Linked on March 4, 2025"
    - "Unlink Account" button with confirmation dialog
  - Unlinking deletes the `TelegramLink` record for this user/project

#### A1.3 Linked Accounts Management Table (Admin/Owner only)
- [ ] Table showing all linked accounts for the project:
  - Columns: User Email, Telegram User ID, Linked Date, Actions
  - "Unlink" action button per row with confirmation
  - Empty state: "No Telegram accounts linked yet"
  - Data fetched from `TelegramLink` table filtered by `projectId`

---

### A2. Telegram Bot Behavior (Server-side)

#### A2.1 Bot Initialization
- [ ] Bot created using `node-telegram-bot-api` with polling configuration:
  - Polling interval: 2000ms
  - Auto-start disabled (manual control)
- [ ] Bot instances managed per-project in a Map/Dictionary (`activeBots`)
- [ ] When settings change (token or enabled state), bot restarts automatically
- [ ] On server startup, all bots for enabled projects start automatically

#### A2.2 Bot Commands
- [ ] **`/start` command:**
  - Response (German): "Willkommen bei vBudget!\nSende /link <Code> um deinen Account zu verknüpfen.\nDen Code findest du in vBudget unter 'Telegram verknüpfen'."

- [ ] **`/link <code>` command:**
  - Validates 6-character code against `TelegramLinkCode` table
  - Checks `expiresAt > now()` and `projectId` matches
  - On success:
    - Creates `TelegramLink` record mapping `telegramUserId` → `userEmail`
    - Deletes the used code from `TelegramLinkCode`
    - Response: "✓ Verknüpft mit [user_email]!\nSende jetzt einfach Fotos deiner Belege – sie werden automatisch als Entwurf gespeichert."
  - On invalid/expired code: "Ungültiger oder abgelaufener Code."
  - On error: "Fehler beim Verknüpfen. Bitte erneut versuchen."

#### A2.3 Photo/Message Handling
- [ ] **Pre-requisite check:**
  - User must be linked (exist in `TelegramLink` table)
  - If not linked: Reply "Dein Telegram-Account ist noch nicht verknüpft.\nSende /link <Code> – den Code findest du in vBudget."

- [ ] **Single Photo Processing:**
  - Download the largest available photo size from Telegram servers
  - Save to `/data/uploads/` with naming pattern: `tg_${timestamp}_${random}.${ext}`
  - Create draft bill with:
    - `billNumber`: `TG-${timestamp}`
    - `status`: `draft`
    - `telegramCaption`: message caption (if any)
    - `submittedByEmail`: from linked user record
    - `projectId`: current project
    - Auto-assign "Default" motive and "Uncategorized" category (100% each)
  - Attach image to bill via `BillImage` record
  - Trigger OCR analysis if `ocrEnabled` setting is true (fire-and-forget)
  - Response: "✓ Foto empfangen – Beleg als Entwurf gespeichert.\nBitte in vBudget vervollständigen."
  - If OCR enabled, append: "\nBeleganalyse läuft im Hintergrund."

- [ ] **Photo Album Processing:**
  - Photos sent as album share a `media_group_id`
  - Buffer messages for 1.5 seconds to collect all photos in the album
  - Download all photos, save to uploads directory
  - Create ONE draft bill with ALL images attached
  - Use caption from first message only
  - Response: "✓ {N} Foto(s) empfangen – Beleg als Entwurf gespeichert.\nBitte in vBudget vervollständigen."

- [ ] **Error Handling:**
  - Photo download failure: Reply "Fehler beim Speichern des Fotos. Bitte erneut versuchen."
  - All errors logged to console with `[TG ${projectId}]` prefix

#### A2.4 Polling Error Handling
- [ ] **409 Conflict (Bot already running elsewhere):**
  - Log: "[TG ${projectId}] Bot already running elsewhere (409). Stopping."
  - Stop the local bot instance to prevent conflicts
- [ ] **Other polling errors:**
  - Log error message without crashing
  - Continue polling (exponential backoff handled by library)

---

### A3. Google Sheets Settings UI (`/app/(protected)/settings/exports/page.tsx`)

#### A3.1 Service Account Configuration
- [ ] **Credentials Upload:**
  - File upload area accepting `.json` files
  - Drag-and-drop support
  - File size limit: 1MB
  - Validation: Must contain `client_email`, `private_key`, `project_id`
  - File stored securely (consider encryption at rest)
  - Path stored in environment or secure storage
  - "Remove Credentials" button to delete stored credentials

- [ ] **Sheet ID Configuration:**
  - Input field for Google Sheet ID
  - Helper text: "Open your Google Sheet and copy the ID from the URL: https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit"
  - "Test Connection" button that:
    - Validates credentials can access the sheet
    - Shows success: "✓ Connected to sheet 'Project Budget 2025'"
    - Shows error: "✗ Cannot access sheet. Ensure you've shared it with: [service-account-email]"
  - Setting stored in `ProjectSettings` with key `exportSheetId`

#### A3.2 Sync Controls
- [ ] **Manual Sync Button:**
  - Button: "Sync Now to Google Sheets"
  - Shows spinner during sync
  - On success: Show toast "✓ Synced 42 bills to Google Sheets" with link to open sheet
  - On error: Show toast "✗ Sync failed: [error message]"

- [ ] **Sync Status Display:**
  - Last sync timestamp: "Last synced: March 4, 2025 at 14:30"
  - Row count: "42 bills in sheet"
  - Error log showing last 5 sync errors (if any)

---

### A4. Google Sheets Data Sync (Server-side)

#### A4.1 Sheet Structure
- [ ] Three tabs created automatically if they don't exist:
  1. **Bills** — All bill data with allocations
  2. **V-Geld** — Advance payment records  
  3. **Budget Matrix** — Budget vs. spending matrix
- [ ] Extra tabs (e.g., default "Sheet1") are automatically deleted
- [ ] Header row styling:
  - Background: #2C3E50 (dark blue-gray)
  - Text: White, bold
  - First row frozen

#### A4.2 Bills Sheet Columns
| Column | Content | Format |
|--------|---------|--------|
| A | ID | Number |
| B | Nr. | Text (bill_number) |
| C | Date | DD.MM.YYYY HH:MM |
| D | Email | Text (submitter) |
| E | Type | Text (Kauf/Leih/Verbrauch) |
| F | Vendor | Text |
| G | Item | Text |
| H | Comment | Text |
| I | Brutto 19% | Currency (€) |
| J | Brutto 7% | Currency (€) |
| K | Brutto 0% | Currency (€) |
| L | Brutto Total | Currency (€) |
| M | Netto | Currency (€) |
| N | Motives | Text (with % if split) |
| O | Categories | Text (with % if split) |

- [ ] Motives column format: "MotiveName" or "MotiveA (60%), MotiveB (40%)"
- [ ] Categories column format: "CategoryName" or "CatA (50%), CatB (50%)"

#### A4.3 V-Geld Sheet Columns
| Column | Content | Format |
|--------|---------|--------|
| A | ID | Number |
| B | Date | DD.MM.YYYY HH:MM |
| C | Amount | Currency (€) |
| D | From | Text |
| E | To | Text |
| F | Created By | Text |

#### A4.4 Budget Matrix Sheet
- [ ] Columns: Category \ Motive, [Motive1], [Motive2], ..., Total Budget, Spent
- [ ] Rows per category showing budget amounts
- [ ] Total row showing column sums
- [ ] Spent row showing actual spending per motive
- [ ] Currency format for all numeric cells

#### A4.5 Sync Behavior
- [ ] Full overwrite sync (clears and rewrites all data)
- [ ] Bills included: All bills (draft, confirmed, pending, approved, rejected, paid)
- [ ] `valueInputOption: USER_ENTERED` for proper formatting
- [ ] Batch update API used for efficiency

---

### A5. API Endpoints

#### Telegram Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/telegram/link-code` | User | Generate 6-char linking code (10min TTL) |
| GET | `/api/telegram/status` | User | Get user's link status for current project |
| DELETE | `/api/telegram/links/me` | User | Unlink own Telegram account |
| GET | `/api/admin/telegram/links` | Admin | List all linked accounts for project |
| DELETE | `/api/admin/telegram/links/:id` | Admin | Unlink any user by link ID |
| GET | `/api/admin/telegram/bot-status` | Admin | Get bot running status |
| POST | `/api/admin/telegram/restart` | Admin | Restart the bot manually |

#### Google Sheets Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/admin/integrations/sheets/sync` | Admin | Full overwrite sync to Google Sheets |
| GET | `/api/admin/integrations/sheets/status` | Admin | Get last sync status and timestamp |
| POST | `/api/admin/integrations/sheets/test` | Admin | Test connection to configured sheet |

---

## Edge Cases

### E1. Telegram Bot Errors
| Scenario | Expected Behavior |
|----------|-------------------|
| Invalid bot token | Status shows "Error: Invalid token", bot doesn't start, admin sees error message |
| Bot token revoked via @BotFather | Polling error with 401/404, status changes to "Error", logs show authentication failure |
| Bot blocked by user | Message send fails silently (logged), no crash, bill still created |
| Chat not found | Error logged, no user-facing failure |
| User sends non-photo message | Silently ignored (no response) |
| User sends photo without linking first | Reply with instructions to link account first |
| Code expired (after 10 min) | Reply "Ungültiger oder abgelaufener Code." |
| Code already used | Reply "Ungültiger oder abgelaufener Code." (same message for security) |
| Duplicate linking attempt (same Telegram ID) | Silently update existing link (upsert behavior) |
| Album photo download fails mid-batch | Log error, create bill with successfully downloaded photos only |
| OCR service fails after photo upload | Bill still created as draft, OCR failure logged separately |
| Project deleted while bot active | Bot stops, all links and codes cleaned up via cascade delete |
| Server restart | All enabled bots auto-restart on startup |
| Two instances running (409 error) | Local instance stops, logs warning |

### E2. Google Sheets Errors
| Scenario | Expected Behavior |
|----------|-------------------|
| Credentials file missing | API returns 503 "Google credentials not configured" |
| Invalid credentials (bad format) | API returns 400 with validation error details |
| Sheet ID not configured | API returns 400 "No Export Sheet ID configured" |
| Sheet not shared with service account | API returns 403 with message about sharing permissions |
| Sheet ID doesn't exist | API returns 404 "Sheet not found" |
| Google API rate limit (429) | Log error, show admin toast "Sheet sync failed — retry later", suggest waiting 60 seconds |
| Network timeout during sync | Log error, partial sync may occur (atomicity not guaranteed by Sheets API) |
| Empty project (no bills) | Sync succeeds with empty sheets (headers only) |
| Very large dataset (>10,000 rows) | Sync may take 10-30 seconds, show progress indicator |
| Currency formatting overflow | Large numbers display as "#####" in sheet (user must widen columns) |

### E3. General Integration Issues
| Scenario | Expected Behavior |
|----------|-------------------|
| Integration triggered while offline | Action queued or fails gracefully (integrations are fire-and-forget) |
| Database connection lost during operation | Error logged, partial data may be committed depending on transaction scope |
| User changes project while sync in progress | Sync continues for original project (scoped to projectId at start) |
| Concurrent sync requests | Second request waits or returns "Sync already in progress" |

---

## Data Models

### TelegramLink
```prisma
model TelegramLink {
  id             String   @id @default(uuid())
  projectId      String
  telegramUserId String
  userEmail      String
  linkedAt       DateTime @default(now())

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userEmail], references: [email], onDelete: Cascade)

  @@unique([projectId, telegramUserId])
  @@index([projectId])
  @@index([userEmail])
}
```

### TelegramLinkCode
```prisma
model TelegramLinkCode {
  code      String   @id
  userEmail String
  projectId String
  expiresAt DateTime
  createdAt DateTime @default(now())

  user    User    @relation(fields: [userEmail], references: [email], onDelete: Cascade)
  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([userEmail])
  @@index([projectId])
}
```

---

## Technical Requirements

### NPM Dependencies
- `googleapis` — Google Sheets API client
- `node-telegram-bot-api` — Telegram Bot API client

### Environment Variables
```
# Google Sheets (global)
GOOGLE_CREDENTIALS_PATH=/data/google-credentials.json  # Optional, defaults to data/ dir

# Telegram (per-project via settings)
# TELEGRAM_BOT_TOKEN stored in ProjectSettings
```

### Security Requirements
- [ ] Bot tokens encrypted at rest (AES-256 or similar)
- [ ] Google credentials file readable only by server process
- [ ] All admin endpoints protected with `ensureProjectAdmin` middleware
- [ ] User can only unlink their own account (unless admin)
- [ ] Link codes are cryptographically random (not predictable)
- [ ] File upload for credentials validates JSON structure before saving

### Performance Requirements
- [ ] Bot polling interval: 2000ms (configurable)
- [ ] Album buffer timeout: 1500ms
- [ ] Google Sheets sync: <30 seconds for 10,000 rows
- [ ] Link code generation: <100ms
- [ ] Status endpoint: <200ms

### Error Handling Principles
- All integration calls wrapped in try/catch
- Errors logged to console with project context (`[TG ${projectId}]`, `[Sheets ${projectId}]`)
- Failures never crash the application
- User-facing actions show toast notifications
- Background operations (OCR trigger) fail silently with logging

---

## Migration Notes from Express

### What Changes in Next.js
1. **Bot Management:** Express keeps bots in memory (`activeBots` Map); Next.js may need external process or careful instance management
2. **API Routes:** Express routes → Next.js App Router API routes
3. **File Uploads:** Express uses multer; Next.js may use different upload handling
4. **Settings Storage:** SQLite `project_settings` → PostgreSQL `ProjectSettings` model
5. **File Paths:** Express uses `DATA_DIR/uploads`; Next.js uses consistent upload directory

### What Stays the Same
1. Telegram bot library (`node-telegram-bot-api`) remains the same
2. Google Sheets API usage pattern remains the same
3. User linking flow with 6-char codes remains identical
4. Photo download and bill creation logic is ported directly
5. Sheet column layout and formatting stays identical

---

## QA Test Checklist

### Telegram Tests
- [ ] Configure valid bot token → status shows Online
- [ ] Configure invalid token → status shows Error with message
- [ ] Generate link code → code appears with 10:00 countdown
- [ ] Send `/link CODE` to bot → account linked, confirmation received
- [ ] Send `/link EXPIRED` → error message received
- [ ] Send photo without linking → link instructions received
- [ ] Send single photo → draft bill created with 1 image
- [ ] Send photo album (3 photos) → draft bill created with 3 images
- [ ] Send photo with caption → caption saved to `telegramCaption`
- [ ] Admin views Linked Accounts table → shows all linked users
- [ ] Admin unlinks user → user can no longer submit via Telegram
- [ ] User unlinks self → confirmation dialog, then unlinked
- [ ] Disable bot toggle → bot stops, status shows Offline
- [ ] Re-enable bot toggle → bot starts, status shows Online

### Google Sheets Tests
- [ ] Upload valid credentials → success message
- [ ] Upload invalid JSON → validation error
- [ ] Test connection with valid Sheet ID → success with sheet name
- [ ] Test connection with unshared sheet → permission error
- [ ] Sync with no bills → headers only, no errors
- [ ] Sync with bills → all data appears correctly formatted
- [ ] Sync with V-Geld records → V-Geld tab populated
- [ ] Sync with budget matrix → matrix tab with formulas
- [ ] Change bill data → re-sync shows updated data
- [ ] Remove credentials → sync button disabled/error

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Overview
This feature migrates two existing Express integrations (Telegram Bot and Google Sheets) to the Next.js App Router architecture. The design leverages existing code patterns from PROJ-7 (bill creation, image uploads) and reuses the working Express bot logic with minimal changes.

---

### A) Component Structure (Visual Tree)

```
Settings Layout
├── Telegram Settings Page (/settings/telegram)
│   ├── Bot Configuration Card (Admin/Owner only)
│   │   ├── Bot Token Input (masked, show/hide toggle)
│   │   ├── Enable/Disable Toggle Switch
│   │   ├── Status Indicator Badge (🔴 Offline / 🟡 Starting / 🟢 Online / 🔴 Error)
│   │   ├── Last Updated Timestamp
│   │   └── Restart Bot Button
│   │
│   ├── User Linking Card (All users)
│   │   ├── Unlinked State
│   │   │   ├── "Link Telegram Account" Button
│   │   │   └── Link Modal/Dialog
│   │   │       ├── Instructions Text
│   │   │       ├── 6-Character Code Display (copyable)
│   │   │       ├── "Copy Command" Button (/link CODE)
│   │   │       ├── Countdown Timer (Expires in MM:SS)
│   │   │       └── "Generate New Code" Button
│   │   │
│   │   └── Linked State
│   │       ├── Green Checkmark + "Account linked"
│   │       ├── Linked Date Display
│   │       └── "Unlink Account" Button (with confirmation)
│   │
│   └── Linked Accounts Table Card (Admin/Owner only)
│       ├── Data Table
│       │   ├── Columns: User Email, Telegram User ID, Linked Date
│       │   └── Actions: Unlink button per row
│       └── Empty State: "No Telegram accounts linked yet"
│
└── Exports Settings Page (/settings/exports) - Google Sheets Section
    ├── Service Account Card
    │   ├── Credentials File Upload (drag-and-drop, .json, max 1MB)
    │   ├── Validation: client_email, private_key, project_id
    │   ├── "Remove Credentials" Button
    │   └── Security Note (file permissions)
    │
    ├── Sheet Configuration Card
    │   ├── Sheet ID Input Field
    │   ├── Helper Text (URL format explanation)
    │   ├── "Test Connection" Button
    │   └── Connection Result (success/error message)
    │
    └── Sync Controls Card
        ├── "Sync Now to Google Sheets" Button
        ├── Spinner/Progress during sync
        ├── Last Sync Timestamp
        ├── Row Count Display
        └── Error Log (last 5 errors)
```

---

### B) Data Model (Plain Language)

#### Telegram Bot Configuration
- **Per-project settings** stored in `ProjectSettings` table:
  - `telegramBotToken` — The bot token from @BotFather (encrypted at rest)
  - `telegramEnabled` — Boolean flag to enable/disable the bot

#### User Linking System
- **Link Codes** (`TelegramLinkCode` table):
  - 6-character alphanumeric code (e.g., `A1B2C3`)
  - Generated when user clicks "Link Account"
  - 10-minute expiration (TTL)
  - One code per user+project at a time
  - Deleted after use or expiration

- **Active Links** (`TelegramLink` table):
  - Maps Telegram User ID → vBudget User Email
  - Per-project scope (user can link different Telegram accounts to different projects)
  - Timestamp when linked
  - Cascade delete when user or project is removed

#### Google Sheets Configuration
- **Service Account Credentials**:
  - Stored as JSON file on server filesystem
  - File path configured via environment variable
  - Contains: `client_email`, `private_key`, `project_id`

- **Per-project settings** in `ProjectSettings` table:
  - `exportSheetId` — The Google Sheet ID from URL

---

### C) Tech Decisions

#### 1. Bot Polling vs Webhook Approach
**Decision:** Use polling (same as Express implementation)

**Rationale:**
- Polling is simpler to implement and debug
- No need for public webhook URL configuration
- Works behind firewalls and NAT
- Existing Express code uses polling successfully
- 2-second polling interval is acceptable for this use case

**Trade-offs:**
- Slightly higher latency (max 2 seconds)
- More API calls to Telegram (but well within free limits)

#### 2. Code Generation Strategy
**Decision:** 6-character alphanumeric, cryptographically random

**Rationale:**
- 36^6 = 2.1 billion possible combinations — sufficient entropy
- Easy for users to type on mobile keyboards
- Short enough to display prominently in UI
- Existing Express implementation uses this format successfully

**TTL Strategy:**
- 10-minute expiration balances security and UX
- Long enough for user to switch apps and find the bot
- Short enough to prevent code reuse attacks
- Automatic cleanup of expired codes on new generation

#### 3. Photo Handling and Bill Creation Flow
**Decision:** Reuse PROJ-7 bill creation logic with Telegram-specific wrapper

**Flow:**
1. Photo arrives from Telegram → Download to `/data/uploads/`
2. Create draft bill via existing bill service
3. Attach images via `BillImage` records
4. Trigger OCR if `ocrEnabled` setting is true (fire-and-forget)
5. Send confirmation message to user

**Album Handling:**
- Buffer messages for 1.5 seconds when `media_group_id` detected
- Collect all photos in the album
- Create ONE bill with ALL images attached

**Rationale:**
- Reuses tested bill creation logic
- Consistent with web upload behavior
- OCR integration works automatically

#### 4. Google Auth: Service Account vs OAuth
**Decision:** Service Account (same as Express implementation)

**Rationale:**
- No user interaction required for syncing
- Works for automated/background sync scenarios
- Single credentials file per server instance
- Existing Express code uses this pattern successfully

**Trade-offs:**
- Sheet must be explicitly shared with service account email
- Less flexible for end-user self-service

#### 5. Real-Time Status Updates
**Decision:** Use SWR/React Query polling for status indicators

**Approach:**
- Bot status: Poll every 5 seconds when on settings page
- Link status: Check on page load and after link/unlink actions
- Sync status: Display timestamp from last operation

**Rationale:**
- Simple to implement, no WebSocket complexity
- Server-side bot state is stored in memory (Map)
- Acceptable freshness for admin UI

#### 6. Bot Instance Management in Next.js
**Decision:** Global singleton pattern with per-project Map

**Approach:**
- `activeBots` Map stored in module-level scope
- Key: `projectId`, Value: `TelegramBot` instance
- Start/stop controlled via API routes
- Auto-start all enabled bots on server startup

**Rationale:**
- Works with Next.js hot-reload in development
- Survives individual API route reloads
- Simple to reason about

**Consideration:** In production with multiple server instances, only one instance should run bots (requires external coordination or single-instance deployment).

---

### D) Code Reuse Opportunities

#### From Express Implementation (`routes/telegram.js`)
| Component | Reuse Strategy |
|-----------|----------------|
| Bot initialization | Port polling config directly |
| Message handlers | Adapt to TypeScript, keep logic |
| Photo download | Reuse download function |
| `/link` command | Port as-is, update DB calls |
| `/start` command | Port as-is |
| Polling error handling | Keep 409 conflict logic |
| Album buffering | Port 1.5s timer logic |

#### From Express Implementation (`google.js`, `routes/exports.js`)
| Component | Reuse Strategy |
|-----------|----------------|
| GoogleAuth setup | Port credentials loading |
| Sheet data building | Port data aggregation queries |
| Batch update API | Keep batchUpdate pattern |
| Header formatting | Port color/styling |
| Three-tab structure | Keep Bills/V-Geld/Budget Matrix |

#### From PROJ-7 (Bills Feature)
| Component | Reuse Strategy |
|-----------|----------------|
| Draft bill creation | Use existing service function |
| Image upload/attachment | Reuse `BillImage` creation |
| OCR triggering | Call existing OCR service |
| File naming | Adapt for `tg_` prefix |
| Upload directory | Use same `UPLOADS_DIR` |

---

### E) Dependencies

#### Already Installed (verify versions)
- `node-telegram-bot-api` — Telegram Bot API client
- `googleapis` — Google Sheets API client

#### Additional Required
None — all dependencies should already be available from Express migration.

#### Optional Enhancements
- `crypto` (built-in) — For secure code generation (if not using Math.random)

---

### F) File Structure (New Files)

```
nextjs/
├── app/
│   ├── (protected)/
│   │   └── settings/
│   │       ├── telegram/
│   │       │   └── page.tsx          # Telegram settings UI
│   │       └── exports/
│   │           └── page.tsx          # Google Sheets settings UI
│   │
│   └── api/
│       ├── telegram/
│       │   ├── link-code/route.ts    # GET - Generate linking code
│       │   ├── status/route.ts       # GET - User's link status
│       │   └── links/
│       │       └── me/route.ts       # DELETE - Unlink self
│       │
│       └── admin/
│           ├── telegram/
│           │   ├── links/route.ts          # GET - List all links
│           │   ├── links/[id]/route.ts     # DELETE - Unlink user
│           │   ├── bot-status/route.ts     # GET - Bot running status
│           │   └── restart/route.ts        # POST - Restart bot
│           │
│           └── integrations/
│               └── sheets/
│                   ├── sync/route.ts       # POST - Full sync
│                   ├── status/route.ts     # GET - Last sync status
│                   └── test/route.ts       # POST - Test connection
│
├── lib/
│   ├── telegram/
│   │   ├── bot.ts                    # Bot instance management
│   │   ├── handlers.ts               # Message/command handlers
│   │   └── codes.ts                  # Code generation/validation
│   │
│   └── google/
│       ├── auth.ts                   # Service account auth
│       └── sheets.ts                 # Sheet sync operations
│
└── components/
    └── settings/
        ├── TelegramSettings.tsx      # Main settings component
        ├── LinkAccountModal.tsx      # Link code display modal
        ├── LinkedAccountsTable.tsx   # Admin links table
        └── GoogleSheetsSettings.tsx  # Google Sheets configuration
```

---

### G) Security Considerations

1. **Bot Token Encryption:** Store encrypted in database, decrypt only in memory when starting bot
2. **Admin Authorization:** All admin endpoints use `ensureProjectAdmin` middleware
3. **Self-Service Limits:** Users can only unlink their own accounts
4. **Code Entropy:** Use crypto-secure random generation for 6-char codes
5. **File Upload Validation:** Validate JSON structure before saving credentials
6. **Rate Limiting:** Apply to code generation endpoint (prevent abuse)

---

### H) Performance Notes

1. **Bot Polling:** 2000ms interval = 30 requests/minute per active bot
2. **Album Buffering:** 1500ms timeout — adjust if users report missing photos
3. **Google Sync:** Batch API calls, expect 10-30 seconds for 10,000 rows
4. **Photo Downloads:** Stream directly to disk, don't buffer in memory
5. **Status Polling:** 5-second interval for UI freshness

---

### I) Error Handling Strategy

| Scenario | User Impact | Admin Impact |
|----------|-------------|--------------|
| Invalid bot token | N/A | Status shows "Error: Invalid token" with details |
| Bot 409 conflict | Temporary unavailability | Logs warning, auto-restarts |
| Photo download fails | "Please retry" message | Logged with project context |
| Google auth fails | N/A | Toast with sharing instructions |
| Sheet sync fails | N/A | Toast with error, log entry |
| Code expired | "Invalid code" message | N/A |

---

### J) Migration Notes

**From Express to Next.js:**
- SQLite queries → Prisma ORM calls
- Express middleware → Next.js auth session checks
- `req.user.currentProjectId` → `session.user.currentProjectId`
- File paths remain consistent (`/data/uploads/`)
- Bot library (`node-telegram-bot-api`) unchanged
- Google library (`googleapis`) unchanged

**Data Migration:**
- Existing `telegram_links` table → `TelegramLink` model (via PROJ-6 migration)
- Existing `telegram_link_codes` table → `TelegramLinkCode` model
- Project settings keys remain compatible

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
