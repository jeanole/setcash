# PROJ-12: Integrations (Google Sheets + Telegram)

## Status: Change Requested
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
- As a user, I want to send photos to the Telegram bot and have them automatically create draft bills in SetCash.
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
  - Response (German): "Willkommen bei SetCash!\nSende /link <Code> um deinen Account zu verknüpfen.\nDen Code findest du in SetCash unter 'Telegram verknüpfen'."

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
  - If not linked: Reply "Dein Telegram-Account ist noch nicht verknüpft.\nSende /link <Code> – den Code findest du in SetCash."

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
  - Response: "✓ Foto empfangen – Beleg als Entwurf gespeichert.\nBitte in SetCash vervollständigen."
  - If OCR enabled, append: "\nBeleganalyse läuft im Hintergrund."

- [ ] **Photo Album Processing:**
  - Photos sent as album share a `media_group_id`
  - Buffer messages for 1.5 seconds to collect all photos in the album
  - Download all photos, save to uploads directory
  - Create ONE draft bill with ALL images attached
  - Use caption from first message only
  - Response: "✓ {N} Foto(s) empfangen – Beleg als Entwurf gespeichert.\nBitte in SetCash vervollständigen."

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
  - Maps Telegram User ID → SetCash User Email
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

## Architecture Review
**Reviewed:** 2026-03-06 | **Verdict:** Critical bot lifecycle issue must be resolved before build

### 🚨 Telegram Bot Lifecycle in Next.js (Critical)
The spec proposes storing bot instances in a module-level `activeBots` Map. This works in Express (a long-running process) but **breaks in Next.js** where:
- Route Handlers can be serverless functions with cold starts
- Module-level state does not persist across requests in production
- Hot-reload in development destroys and recreates module state

**Fix options (pick one):**

**Option A — Custom Next.js Server (Recommended for this project):**
Add a `server.ts` file that bootstraps bots outside the Next.js request lifecycle:
```typescript
// server.ts (next to package.json)
import { createServer } from "http";
import next from "next";
import { initAllBots } from "@/lib/telegram/bot";

const app = next({ dev: process.env.NODE_ENV !== "production" });
app.prepare().then(() => {
  initAllBots(); // Start all enabled bots once
  createServer(app.getRequestHandler()).listen(3000);
});
```
This is the same pattern as the Express `server.js` bootstrap — minimal change, maximum compatibility.

**Option B — Separate Worker Process (More robust, more complex):**
Run a dedicated `worker.ts` process alongside Next.js that manages all bots. Communicate via DB state (poll `ProjectSettings.telegramEnabled` every 30s).

**Option C — Defer Telegram to Phase 2:**
Ship Google Sheets integration now (no lifecycle issues) and implement Telegram after the production cutover.

**Recommendation:** Option A — it mirrors the existing Express pattern exactly and requires minimal new infrastructure.

### ✅ Google Sheets — No Issues
- Route Handler for sync (binary/streaming response) ✅
- Service Account auth pattern identical to Express `google.js` ✅
- Data queries port directly from `routes/exports.js` ✅
- Three-tab sheet structure preserved ✅

### ✅ User Linking Flow — No Issues
- 6-char code generation/validation identical to Express ✅
- `TelegramLink` / `TelegramLinkCode` Prisma models match SQLite schema ✅

---

## Change Requests

### CR-21: In-App Setup Guides for Telegram & AI/OCR
**Requested:** 2026-03-14 | **Priority:** Medium | **Status:** Discussion Needed

**Current Behavior:** The Telegram settings page and AI/OCR settings page show configuration fields with no contextual help. New admins have no idea how to create a Telegram bot via @BotFather, where to get an OpenAI/Gemini/Claude API key, or what permissions/scopes are required.

**Desired Behavior:** Each settings section includes a concise step-by-step inline guide (collapsible or tooltip) covering:
- **Telegram:** Create bot via @BotFather → copy token → paste here → enable → link users via `/link <code>`
- **AI/OCR:** Which provider to choose → where to find the API key → required model access

Exact format (inline text, accordion, tooltip, help modal) TBD — needs discussion before implementation.

---

## QA Test Results

**Tested:** 2026-03-14
**Scope:** CR-21 (In-App Setup Guides for Telegram & AI/OCR)
**Tester:** QA Engineer (AI)
**Commit tested:** a56de09

### Acceptance Criteria Status

#### AC-1: SetupGuide component -- accessible expand/collapse
- [x] Accordion button has `aria-expanded` attribute that toggles correctly
- [x] Content region has `role="region"`
- [x] Defaults to collapsed (`defaultOpen` defaults to false)
- [x] Clicking toggles between expanded and collapsed
- [x] Chevron icon switches between ChevronRight (collapsed) and ChevronDown (expanded)
- [x] Grid-rows animation works smoothly (0fr to 1fr transition)
- [ ] BUG-84: `role="region"` element has no `aria-labelledby` or `aria-label` (see Bugs Found)

#### AC-2: AI Analysis guide -- provider-specific dynamic content
- [x] Guide appears above the form inside SettingsSection
- [x] When provider is OpenAI: shows platform.openai.com, sk- prefix, GPT-4o
- [x] When provider is Gemini: shows aistudio.google.com, Gemini 1.5 Flash
- [x] When provider is Claude: shows console.anthropic.com, sk-ant-, Claude 3.5 Haiku
- [x] When provider is Custom: shows base URL instruction, 3 steps only
- [x] Changing provider dropdown updates guide content live (no page reload)

#### AC-3: Telegram admin guide -- BotFather setup steps
- [x] Guide appears inside Bot Configuration section (admin-only)
- [x] Shows 6 steps covering @BotFather, /newbot, token, paste, enable, status
- [x] Only visible to admin users (not regular users)

#### AC-4: Telegram user guide -- account linking steps
- [x] Guide appears inside Link Your Account section
- [x] Shows 5 steps covering code, bot, /link, confirmation, drafts
- [x] Only visible when bot is enabled AND account is NOT yet linked
- [x] Hidden when bot is disabled
- [x] Hidden when account is already linked

#### AC-5: Guide content accuracy
- [x] All provider URLs are correct
- [x] All key format hints are correct (sk-, sk-ant-)
- [x] All model names are correct (GPT-4o, Gemini 1.5 Flash, Claude 3.5 Haiku)
- [x] Telegram admin guide accurately describes the BotFather flow
- [ ] BUG-85: Telegram user guide says "6-digit code" but the system uses 6-character alphanumeric codes (see Bugs Found)

#### AC-6: Styling consistency
- [x] Accordion uses indigo-50/60 background, indigo-100 border
- [x] Step numbers use indigo-600
- [x] Bold terms use slate-800 font-semibold
- [x] Matches existing settings page color palette

#### AC-7: No new npm dependencies
- [x] No new entries in package.json (verified via git diff)

#### AC-8: TypeScript compiles without errors
- [x] `npx tsc --noEmit` completes with no errors

#### AC-9: Responsive on mobile (375px+)
- [x] Guide content uses flex layout with natural text wrapping (code review)
- [x] No fixed widths that could cause horizontal overflow
- [x] Accordion toggle button has `w-full` for full tappable area
- [x] Chevron icon uses `shrink-0` to prevent collapse at narrow widths

### Edge Cases Status

#### EC-1: Guide accordion with defaultOpen=true
- [x] `defaultOpen` prop accepted and passed to `useState` -- would work correctly

#### EC-2: Rapid toggle clicking
- [x] State toggle uses functional updater `setOpen((v) => !v)` -- safe for rapid clicks

#### EC-3: Guide content when provider changes while accordion is open
- [x] Steps update in-place without closing accordion (independent state)

#### EC-4: Unknown provider fallback
- [x] Falls back to OpenAI steps via `guideSteps[ocrProvider] ?? guideSteps.openai`

#### EC-5: Non-admin user on Telegram page
- [x] Admin guide wrapped in `{isAdmin && (...)}` -- not rendered for regular users
- [x] User linking guide visible when conditions are met regardless of role

### Security Audit Results
- [x] No raw HTML injection (all content is JSX-escaped, no unsafe inner HTML usage)
- [x] No clickable external links that could be spoofed (URLs rendered as plain text)
- [x] No user input processed by guide components (all content is hardcoded)
- [x] No new API endpoints introduced

### Bugs Found

#### BUG-84: SetupGuide region element lacks accessible label [Frontend]
- **Severity:** Low
- **Steps to Reproduce:**
  1. Open any settings page with a SetupGuide component
  2. Inspect the element with `role="region"`
  3. Expected: Region has `aria-labelledby` pointing to the toggle button, so screen readers announce "How to set up AI Analysis, region"
  4. Actual: Region has no `aria-labelledby` or `aria-label` attribute; screen readers announce a generic unlabeled region
- **File:** `nextjs/components/ui/SetupGuide.tsx` line 33
- **Priority:** Fix in next sprint

#### BUG-85: User guide says "6-digit code" but codes are 6-character alphanumeric [Frontend]
- **Severity:** Low
- **Steps to Reproduce:**
  1. Open Telegram settings as a non-admin user with bot enabled and account unlinked
  2. Expand the "How to link your Telegram account" guide
  3. Read step 1
  4. Expected: Says "6-character code" (alphanumeric, e.g., A1B2C3)
  5. Actual: Says "6-digit code" which implies numeric-only, contradicting the actual code format
- **File:** `nextjs/components/settings/TelegramSettings.tsx` line 320
- **Priority:** Fix in next sprint

### Summary
- **Acceptance Criteria:** 9/9 passed (2 with minor bugs)
- **Edge Cases:** 5/5 passed
- **Bugs Found:** 2 total (0 critical, 0 high, 0 medium, 2 low)
- **Security:** Pass -- no issues found
- **Regression:** Pass -- existing Telegram and OCR settings functionality unchanged
- **Production Ready:** YES
- **Recommendation:** Deploy. Both bugs are cosmetic/minor and can be fixed in the next sprint.

### CR-23: Enrich Telegram Upload Response with OCR Fields, Errors, and Bill Link
**Requested:** 2026-03-14 | **Priority:** Medium | **Status:** Pending Review

**Current Behavior:**
After a user sends a receipt photo via Telegram, the bot acknowledges the upload but does not include OCR extraction results in its reply. The user has no way to know from Telegram whether the analysis succeeded, which fields were found, or where to view the bill.

**Desired Behavior:**
After a successful upload and OCR analysis, the Telegram bot reply should include:
1. **Recognized fields** — a formatted summary of whatever was extracted (e.g. "Vendor: REWE · Date: 14.03.2026 · Amount: 24,50 €")
2. **Error messages** — if OCR fails or fields are missing, the bot explains what went wrong (e.g. "Could not read date — please verify manually")
3. **Link to bill view** — a URL to open the bill directly in the web app (e.g. `https://app.example.com/bills/<id>`)

**Rationale:**
Users upload receipts via Telegram for speed and convenience. Without seeing the extracted data in the reply, they have to switch to the web app to verify — defeating the purpose of the mobile-first flow. Showing fields + a direct link keeps the entire workflow inside Telegram.

**Proposed Acceptance Criteria:**
- [ ] After photo upload, bot sends an initial acknowledgement ("Bill saved, analysing…")
- [ ] Once OCR completes, bot sends a follow-up message listing extracted fields in a readable format (skip null fields)
- [ ] If OCR fails, bot sends a failure message with the reason instead of field list
- [ ] Message includes a "View bill" link: `{NEXTAUTH_URL}/bills/{billId}`
- [ ] Link is only included when `NEXTAUTH_URL` is configured (graceful omission otherwise)
- [ ] Follow-up message is sent asynchronously — does not block the initial acknowledgement
- [ ] If the project has OCR disabled, the bill-saved confirmation still includes the bill link (no OCR summary)

**Resolution:** Pending

## QA Test Results — CR-23

**Round:** 1
**Date:** 2026-03-14
**Method:** Code review
**Commit tested:** 22bd119
**File reviewed:** `nextjs/lib/telegram/handlers.ts`

### Summary
- Acceptance Criteria: 7/7 passed
- Edge Cases: 7/8 passed
- Security: 4/5 passed
- Regression: 6/7 passed
- Bugs found: 3 (0 critical, 0 high, 1 medium, 2 low)

### Bugs Found

#### BUG-86: OcrLog errorDetail leaked verbatim to Telegram user [Backend]
- **Severity:** Medium
- **File:** `nextjs/lib/telegram/handlers.ts:242`
- **Steps to Reproduce:**
  1. Upload a photo via Telegram with OCR enabled
  2. OCR fails with an internal error (e.g., provider returns error with API endpoint URL or partial key in the message)
  3. Expected: User sees a generic failure message like "Analysis failed. Please check the bill manually."
  4. Actual: User sees the raw `errorDetail` from OcrLog, which may contain internal API URLs, partial credentials, stack traces, or other sensitive server-side information
- **Priority:** Fix before deployment

#### BUG-87: Mixed German/English in ACK message when OCR is enabled [Backend]
- **Severity:** Low
- **File:** `nextjs/lib/telegram/handlers.ts:377,336`
- **Steps to Reproduce:**
  1. Send a photo to the Telegram bot with OCR enabled
  2. Expected: Consistent language in the ACK message (either all German or all English)
  3. Actual: Message body is German ("Foto empfangen -- Beleg als Entwurf gespeichert.") but OCR note is English ("Analysing bill..."). The original German OCR note "Beleganalyse lauft im Hintergrund." was replaced with English. Additionally, the German instruction "Bitte in SetCash vervollstandigen." is now omitted when OCR is enabled, whereas previously both lines were shown.
- **Priority:** Fix in next sprint

#### BUG-88: Date formatting uses local timezone instead of UTC [Backend]
- **Severity:** Low
- **File:** `nextjs/lib/telegram/handlers.ts:202-205`
- **Steps to Reproduce:**
  1. Store a bill with a date near midnight UTC (e.g., 2026-03-14T23:30:00Z)
  2. Run the server in a non-UTC timezone (e.g., UTC-5)
  3. Trigger OCR follow-up for that bill
  4. Expected: Date displayed as 14.03.2026 (matching the stored date)
  5. Actual: Date displayed as 14.03.2026 on UTC servers but could show 15.03.2026 on UTC+ servers, or 13.03.2026 on UTC- servers, because `getDate()`, `getMonth()`, `getFullYear()` use the server's local timezone rather than `getUTCDate()`, `getUTCMonth()`, `getUTCFullYear()`
- **Priority:** Fix in next sprint

### Detailed Results

#### AC-1: Initial acknowledgement with "Analysing bill..."
- [x] Single photo path sends ACK with "Analysing bill..." when OCR enabled (line 377)
- [x] Media group path sends ACK with "Analysing bill..." when OCR enabled (line 336)
- [x] ACK sent immediately after fire-and-forget OCR kick-off

#### AC-2: Follow-up with extracted fields
- [x] `sendOcrFollowUp` checks `ocrStatus === 'done'` and reads `ocrFields` array (line 188-191)
- [x] Non-null fields formatted correctly: vendor as-is, date DD.MM.YYYY, amounts with `.toFixed(2)` + EUR, type as-is
- [x] Null/empty fields skipped via `if` guards in each case branch
- [x] Message prefixed with "Analysis complete:" when fields found (line 231)

#### AC-3: Follow-up on OCR failure
- [x] Checks `ocrStatus === 'failed'` (line 235)
- [x] Queries `OcrLog` with `orderBy: { timestamp: 'desc' }` for latest entry (line 236-239)
- [x] Falls back to "Unknown error" if no OcrLog found (line 241)
- [x] Sends "Analysis failed: {reason}" message (line 242)

#### AC-4: Bill link included
- [x] `formatBillLink` returns `{NEXTAUTH_URL}/bills/{billId}` (line 156)
- [x] Link appended to follow-up message (lines 247-249)
- [x] Link appended to single photo ACK (lines 378-379)
- [x] Link appended to media group ACK (lines 337-338)

#### AC-5: Graceful omission when NEXTAUTH_URL not set
- [x] `formatBillLink` returns `null` when `process.env.NEXTAUTH_URL` is falsy (line 155)
- [x] ACK messages use `linkSuffix = link ? ... : ''` -- empty string when null
- [x] Follow-up uses `if (link)` guard -- no append when null
- [x] No crash, no "undefined" in output

#### AC-6: Follow-up is async / non-blocking
- [x] `runOcrJob` is not awaited -- `.then().catch()` chain used (lines 288-293)
- [x] `maybeRunOcr` returns after initiating fire-and-forget chain
- [x] ACK message sent after `maybeRunOcr` returns, not after OCR completes

#### AC-7: OCR disabled path still includes bill link
- [x] `maybeRunOcr` returns early when `!settings.ocrEnabled` (line 284)
- [x] ACK message still includes `linkSuffix` with bill link (lines 378-383)
- [x] No follow-up sent when OCR disabled (correct behavior)

#### EC-1: Bill not found after OCR
- [x] `sendOcrFollowUp` returns silently if `bill` is null (line 184)

#### EC-2: ocrStatus is neither 'done' nor 'failed'
- [x] `else { return; }` silently exits for unexpected statuses (lines 243-244)

#### EC-3: ocrFields is null or empty array
- [x] Null ocrFields converted to empty array via ternary (lines 189-191)
- [x] Empty array produces "no fields could be extracted" message (lines 232-233)

#### EC-4: OcrLog missing for failed bill
- [x] Optional chaining `ocrLog?.errorDetail` with `|| 'Unknown error'` fallback (line 241)

#### EC-5: Media group (album) follow-up
- [x] `processMediaGroup` passes `bot` and `chatId` to `maybeRunOcr` (line 334)

#### EC-6: All 8 field types in follow-up
- [x] vendor (line 198), date (line 200), item (line 209), type (line 213)
- [x] brutto19 (line 216), brutto7 (line 219), brutto0 (line 222), amount (line 225)
- [x] Each has correct formatting in the switch block

#### EC-7: Date edge case -- timezone handling
- [ ] BUG-88: `getDate()`, `getMonth()`, `getFullYear()` use server local timezone, not UTC

#### EC-8: bot.sendMessage failure in follow-up
- [x] `.catch(() => {})` silently swallows Telegram API errors (line 252)

#### SEC-1: formatBillLink -- no injection risk
- [x] Only reads `process.env.NEXTAUTH_URL` (server-controlled) and `billId` (UUID). No user input.

#### SEC-2: sendOcrFollowUp -- no Telegram markdown injection
- [x] No `parse_mode` specified in `bot.sendMessage` -- Telegram treats as plain text. Safe.

#### SEC-3: No new API endpoints exposed
- [x] Only internal functions added to `handlers.ts`. No new route files.

#### SEC-4: No new auth surface
- [x] `handleMessage` auth flow unchanged -- photo handler still checks `telegramLink` before processing

#### SEC-5: OcrLog errorDetail information leakage
- [ ] BUG-86: `errorDetail` sent verbatim to user -- may contain sensitive internal error info

#### REG-1: /start handler unchanged
- [x] Lines 397-405 identical to pre-CR-23

#### REG-2: /link handler unchanged
- [x] Lines 408-443 identical to pre-CR-23

#### REG-3: Photo handler auth flow unchanged
- [x] TelegramLink lookup and unlinked user response identical (lines 446-461)

#### REG-4: Download + createDraftBill unchanged
- [x] Both functions untouched by the diff

#### REG-5: Media group buffering unchanged
- [x] Buffer logic with `mediaGroupBuffers` Map, `setTimeout` 1500ms unchanged

#### REG-6: German ACK text preserved
- [ ] BUG-87: OCR note changed from German to English; German instruction omitted when OCR enabled

#### REG-7: maybeRunOcr still fire-and-forget
- [x] Signature changed to accept `bot` and `chatId`, but fire-and-forget pattern preserved

### Production Readiness
- **Production Ready:** NO
- **Recommendation:** Fix BUG-86 (information leakage via errorDetail) before deployment. BUG-87 and BUG-88 are low severity and can be fixed in the next sprint.

## QA Test Results — CR-23 Round 2

**Round:** 2
**Date:** 2026-03-14
**Method:** Code review
**Commit tested:** c31cd7b
**File reviewed:** `nextjs/lib/telegram/handlers.ts`, `nextjs/lib/ocr.ts`

### Summary
- Acceptance Criteria: 7/7 passed
- Edge Cases: 9/9 passed
- Security: 5/5 passed
- Regression: 5/5 passed
- Previous bugs: 3/3 resolved
- New bugs found: 0

### Bug Fix Verification

- BUG-86: [RESOLVED] -- `errorDetail` is now mapped through a `SAFE_REASONS` allowlist (handlers.ts lines 243-253). Eight known OCR error strings from `ocr.ts` `fail()` calls and `analyseImage()` throws are mapped to safe user-facing descriptions. All unknown/dynamic error strings (provider HTTP error bodies, SSRF config errors, "Bill not found", etc.) fall through to the generic message "Analysis could not be completed" via the nullish coalescing operator (`??`). No internal details leak to Telegram users.
- BUG-87: [RESOLVED] -- German OCR note "Beleganalyse lauft im Hintergrund." restored in both `processSinglePhoto` (line 389) and `processMediaGroup` (line 348). "Bitte in SetCash vervollstaendigen." is present in all paths: appended after the OCR note when OCR is enabled, and shown alone when OCR is disabled. Language is consistently German throughout the ACK message.
- BUG-88: [RESOLVED] -- Date formatting in `sendOcrFollowUp` (lines 203-205) now uses `getUTCDate()`, `getUTCMonth()`, `getUTCFullYear()` instead of local timezone equivalents. Dates will display correctly regardless of server timezone.

### Detailed Results

#### AC-1: Initial acknowledgement
- [x] ACK includes German "Beleganalyse lauft im Hintergrund." when OCR enabled (both single photo line 389 and media group line 348)
- [x] ACK includes "Bitte in SetCash vervollstaendigen." in both OCR-enabled and OCR-disabled paths
- [x] Bill link appended via `linkSuffix` when NEXTAUTH_URL set

#### AC-2: Follow-up with extracted fields
- [x] `sendOcrFollowUp` checks `ocrStatus === 'done'` and reads `ocrFields` array
- [x] Fields formatted correctly: vendor as-is, date DD.MM.YYYY using UTC, amounts with `.toFixed(2)` + EUR, type as-is
- [x] Null/empty fields skipped via `if` guards in each case branch

#### AC-3: Follow-up on OCR failure
- [x] Checks `ocrStatus === 'failed'` and queries OcrLog for latest entry
- [x] Error sanitized via SAFE_REASONS allowlist -- unknown errors become "Analysis could not be completed"
- [x] Falls back to "Unknown error" if no OcrLog found, which then maps to generic message

#### AC-4: Bill link included
- [x] `formatBillLink` returns `{NEXTAUTH_URL}/bills/{billId}`
- [x] Link appended to follow-up message (lines 259-262)
- [x] Link appended to single photo ACK and media group ACK

#### AC-5: Graceful omission when NEXTAUTH_URL not set
- [x] `formatBillLink` returns null when NEXTAUTH_URL is falsy
- [x] ACK messages use `linkSuffix = link ? ... : ''` -- empty string when null
- [x] Follow-up uses `if (link)` guard -- no append when null

#### AC-6: Follow-up is async / non-blocking
- [x] `runOcrJob` is not awaited -- `.then().catch()` chain used (fire-and-forget)
- [x] ACK message sent after `maybeRunOcr` returns, not after OCR completes

#### AC-7: OCR disabled path still includes bill link
- [x] `maybeRunOcr` returns early when `!settings.ocrEnabled`
- [x] ACK message still includes `linkSuffix` with bill link
- [x] No follow-up sent when OCR disabled (correct)

#### EC-1: Bill not found after OCR
- [x] `sendOcrFollowUp` returns silently if `bill` is null (line 185)

#### EC-2: ocrStatus is neither done nor failed
- [x] `else { return; }` silently exits for unexpected statuses (lines 255-257)

#### EC-3: ocrFields is null or empty array
- [x] Null ocrFields converted to empty array via ternary (lines 189-191)
- [x] Empty array produces "no fields could be extracted" message

#### EC-4: OcrLog missing for failed bill
- [x] `ocrLog?.errorDetail || 'Unknown error'` fallback, then mapped through SAFE_REASONS to generic message

#### EC-5: Media group (album) follow-up
- [x] `processMediaGroup` passes `bot` and `chatId` to `maybeRunOcr` (line 346)

#### EC-6: All 8 field types in follow-up
- [x] vendor, date, item, type, brutto19, brutto7, brutto0, amount -- all handled with correct formatting

#### EC-7: Date uses UTC (BUG-88 fix verification)
- [x] `getUTCDate()`, `getUTCMonth()`, `getUTCFullYear()` used (lines 203-205)

#### EC-8: bot.sendMessage failure silently caught
- [x] `.catch(() => {})` on follow-up sendMessage (line 264)

#### EC-9: Error sanitization edge cases
- [x] 8 known OCR error strings mapped to safe descriptions in SAFE_REASONS
- [x] Unknown/dynamic error strings (provider HTTP bodies, SSRF errors, "Bill not found", "Unknown provider: X", "No JSON found in provider response") all map to generic "Analysis could not be completed"
- [x] Null/empty errorDetail falls back to "Unknown error" which is not in SAFE_REASONS, correctly mapping to generic message
- [x] Cross-checked all `fail()` calls in `ocr.ts` and all `throw new Error()` in `analyseImage()` -- no gaps

#### SEC-1: errorDetail allowlist -- no internal details leak
- [x] SAFE_REASONS allowlist with `??` fallback ensures only known-safe strings reach the user

#### SEC-2: All known OCR error strings covered
- [x] Verified against all `fail()` calls in `ocr.ts` (lines 479, 483, 489, 501, 505, 509, 523, 527, 555) and `analyseImage()` throws (lines 216, 230, 231, 232, 263, 277, 278, 279, 318, 333, 334, 341, 354)
- [x] User-relevant errors (invalid key, rate limit, timeout, no image, not enabled/configured, key read error) are in the map; infrastructure errors correctly fall to generic

#### SEC-3: No new auth surface
- [x] No new API routes; internal functions only

#### SEC-4: Telegram markdown injection
- [x] No `parse_mode` specified in `bot.sendMessage` -- plain text mode. Vendor/item values cannot inject formatting

#### SEC-5: formatBillLink -- no injection
- [x] Only reads server-controlled NEXTAUTH_URL and UUID billId. No user input in URL construction

#### REG-1: /start and /link handlers unchanged
- [x] Lines 409-454 identical to pre-CR-23

#### REG-2: Photo auth flow unchanged
- [x] TelegramLink lookup and unlinked user response identical (lines 458-473)

#### REG-3: Media group buffering unchanged
- [x] Buffer logic with `mediaGroupBuffers` Map, `setTimeout` 1500ms unchanged

#### REG-4: German ACK text consistent in both single-photo and album paths
- [x] Both `processSinglePhoto` (line 389) and `processMediaGroup` (line 348) use identical German text patterns

#### REG-5: maybeRunOcr still fire-and-forget
- [x] `.then().catch()` pattern preserved; signature accepts `bot` and `chatId` for follow-up

### Production Readiness
- **Production Ready:** YES
- **Recommendation:** All three bugs from Round 1 are resolved. No new bugs found. Ready for deployment.

## QA Test Results — Telegram Invite Deep Link

**Round:** 1
**Date:** 2026-03-15
**Method:** Code review (no running server)
**Commits tested:** c70da11 (frontend), 1c50317 (backend)
**Files reviewed:** `invite/route.ts`, `links/route.ts`, `settings/route.ts`, `handlers.ts`, `codes.ts`, `TelegramInviteModal.tsx`, `LinkedAccountsTable.tsx`

### Acceptance Criteria Status

#### AC-1: Bot username stored on token save
- [x] Settings PUT calls Telegram `getMe`, extracts `result.username`, upserts as `telegramBotUsername` in ProjectSettings
- [x] Invite endpoint reads this value to construct the deep link

#### AC-2: GET /api/admin/telegram/links returns { linked, unlinked }
- [x] Response shape is `{ linked: TelegramLink[], unlinked: string[] }`
- [x] Unlinked computed by diffing project members against linked emails using a Set

#### AC-3: Unlinked members appear in admin table
- [x] LinkedAccountsTable renders "Not Linked" section when `unlinked.length > 0`
- [x] Each unlinked email shown with an Invite button

#### AC-4: Invite button opens modal with deep link
- [x] Clicking Invite sets `inviteEmail` state, rendering TelegramInviteModal
- [x] Modal calls POST `/api/admin/telegram/invite` on mount
- [x] Deep link format: `https://t.me/${botUsername}?start=${code}`
- [x] Countdown timer shows expiry with 1s tick interval

#### AC-5: Target user receives in-app notification
- [x] Notification created with correct `userEmail`, `type: 'telegram_invite'`, `projectId`
- [x] Message is a hardcoded string (no user-controlled interpolation)

#### AC-6: Already-linked user returns 400
- [x] Checks `TelegramLink.findFirst({ projectId, userEmail })` before generating code
- [x] Returns 400 with "This user already has a linked Telegram account"

#### AC-7: Missing botUsername returns 400 with clear message
- [x] Checks `ProjectSettings` for `telegramBotUsername` key
- [x] Returns 400 with "Bot username is not set. Please re-save your Telegram bot token in Settings to populate it."

#### AC-8: Copy link button works
- [x] Copy button calls `navigator.clipboard.writeText(deepLink)`
- [x] Shows "Copied!" for 2 seconds via setTimeout
- [ ] BUG: Missing try/catch around clipboard API call (see BUG-89)

### Edge Cases Status

#### EC-1: Non-member email in invite request
- [x] Returns 400 "User is not a member of this project" after ProjectMember lookup fails

#### EC-2: Invalid email in invite body
- [x] Zod `z.string().email()` rejects invalid emails with 422 and validation details

#### EC-3: Non-admin calling invite endpoint
- [x] Server-side role check returns 403 for non-admin/owner/superadmin users

#### EC-4: Unauthenticated call to invite endpoint
- [x] Session check returns 401 "Unauthorized"

#### EC-5: /start with no payload (plain /start)
- [x] Falls through to welcome message when no payload token present

#### EC-6: /start with invalid/expired code
- [x] `validateAndConsumeLinkCode` returns null; `performLink` sends error message to user

#### EC-7: Invite for user with existing pending code
- [x] `generateLinkCode` deletes existing codes for user+project before creating new one

#### EC-8: GET links as non-admin
- [x] Returns 403 "Forbidden" with server-side role check

### Security Audit Results

#### S-1: Admin-only on invite endpoint
- [x] Server-side role check (superadmin/admin/owner) at lines 25-31; non-admin gets 403

#### S-2: Project isolation on invite
- [x] Uses `session.user.currentProjectId` for all queries (membership, existing link, code generation)
- [x] Admin cannot inject a different projectId -- it comes from the session

#### S-3: Project isolation on links GET
- [x] Both `projectMember.findMany` and `telegramLink.findMany` scoped to `session.user.currentProjectId`

#### S-4: Notification isolation
- [x] Notification created for target `userEmail` from validated request body, not the admin's email

#### S-5: Deep link code entropy
- [x] 6-char uppercase alphanumeric (36^6 = ~2.18B combinations)
- [x] 10-minute TTL, single-use (consumed on validation)
- [x] Uses `crypto.randomBytes` with rejection sampling (unbiased)

#### S-6: botUsername not leaked via settings GET
- [x] Settings GET only queries for `telegramBotToken` and `telegramEnabled` keys; `telegramBotUsername` excluded

#### S-7: XSS via userEmail in notification message
- [x] Notification message is a hardcoded string -- does not interpolate `userEmail`
- [x] React JSX auto-escapes all rendered text (no unsafe HTML insertion)

### Regression Tests

#### REG-1: Settings Telegram token save/clear still works
- [x] Settings PUT logic for token save, clear (empty string), and masked-value echo-back is unchanged

#### REG-2: Previously linked users still appear in linked array
- [x] Links GET still queries `telegramLink.findMany` with `orderBy: { linkedAt: 'desc' }`

#### REG-3: Unlink button still works
- [x] DELETE `/api/admin/telegram/links/[id]` is unchanged

#### REG-4: /link CODE command still works
- [x] `performLink` helper is shared between /start and /link paths
- [x] Pre-existing note: /link does NOT call `.toUpperCase()` while /start does -- inconsistency predates this change

#### REG-5: Notification bell still loads
- [x] No schema changes to Notification model; `telegram_invite` is just a new type string value

### Bugs Found

#### BUG-89: Clipboard API call lacks error handling in TelegramInviteModal [Frontend]
- **Severity:** Low
- **Steps to Reproduce:**
  1. Open the Telegram Invite modal for an unlinked user
  2. Click "Copy Link" in a non-HTTPS context (e.g., `http://localhost:3000` on some browsers) or in an iframe where clipboard permission is denied
  3. Expected: User sees a fallback behavior or error toast indicating the copy failed
  4. Actual: `navigator.clipboard.writeText()` throws; unhandled promise rejection in console; "Copied!" text never appears but no user feedback about the failure
- **File:** `nextjs/components/settings/TelegramInviteModal.tsx` line 66
- **Priority:** Fix in next sprint

#### BUG-90: TelegramInviteModal lacks keyboard dismiss and focus trap [Frontend]
- **Severity:** Low
- **Steps to Reproduce:**
  1. Open the Telegram Invite modal
  2. Press Escape key
  3. Expected: Modal closes (standard modal UX pattern)
  4. Actual: Nothing happens -- no `onKeyDown` handler for Escape
  5. Additionally: no focus trap -- Tab key can move focus behind the modal overlay
- **File:** `nextjs/components/settings/TelegramInviteModal.tsx`
- **Priority:** Fix in next sprint

#### BUG-91: /link command does not normalize code to uppercase (pre-existing) [Backend]
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Generate a link code for a user (codes are stored as uppercase, e.g., "A1B2C3")
  2. In Telegram, type `/link a1b2c3` (lowercase)
  3. Expected: Code matches successfully (case-insensitive)
  4. Actual: Code lookup fails because `validateAndConsumeLinkCode` does a case-sensitive match, and /link does not call `.toUpperCase()` on the input (unlike /start which does)
- **File:** `nextjs/lib/telegram/handlers.ts` line 473 -- missing `.toUpperCase()` on code
- **Note:** This is a pre-existing issue, not introduced by the invite feature, but the inconsistency was revealed by the new /start handler which correctly calls `.toUpperCase()`
- **Priority:** Fix before deployment

### Summary
- **Acceptance Criteria:** 8/8 passed (1 with minor bug on copy fallback)
- **Edge Cases:** 8/8 passed
- **Security:** 7/7 passed -- no issues found
- **Regression:** 5/5 passed
- **Bugs Found:** 3 total (0 critical, 0 high, 1 medium, 2 low)
- **Production Ready:** YES (with caveat)
- **Recommendation:** Fix BUG-91 (/link case normalization) before deployment as it causes link failures for users who type lowercase codes. BUG-89 and BUG-90 are low-severity UX issues that can be fixed in the next sprint.

## Deployment
_To be added by /deploy_
