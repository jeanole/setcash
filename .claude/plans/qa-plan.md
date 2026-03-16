# QA Test Plan — Telegram Invite (Admin Deep Link)

## Feature
Admin Telegram invite deep link bypass — PROJ-12 (Integrations)
Commits: c70da11 (frontend), 1c50317 (backend)

## Context Summary
- 6 files changed: settings/route.ts, invite/route.ts, links/route.ts, handlers.ts, TelegramInviteModal.tsx, LinkedAccountsTable.tsx
- Backend: stores botUsername on token save, invite endpoint, /start payload handling, unlinked members in GET links
- Frontend: TelegramInviteModal, updated LinkedAccountsTable with unlinked section
- Notification: creates telegram_invite notification for target user on invite

## User Guidance
- Full QA scope
- Live Telegram bot not accessible — test bot handler via code review only
- App at http://localhost:3000, default admin account

## Acceptance Criteria to Test

### AC-1: Bot username stored on token save
- Expected: After saving a valid bot token, ProjectSettings has telegramBotUsername row
- How: Verify invite endpoint returns a deep link (proves username was stored); or check DB

### AC-2: GET /api/admin/telegram/links returns { linked, unlinked }
- Expected: Response shape is { linked: TelegramLink[], unlinked: string[] }
- How: Fetch endpoint as admin, inspect JSON shape

### AC-3: Unlinked members appear in admin table
- Expected: Settings Telegram shows Not Linked section with unlinked project members
- How: Visit settings page as admin, verify section appears with correct emails

### AC-4: Invite button opens modal with deep link
- Expected: Clicking Invite generates a https://t.me/...?start=CODE link in modal
- How: Click Invite on an unlinked user, verify modal appears with valid deep link

### AC-5: Target user receives in-app notification
- Expected: After admin invites a user, that user has a telegram_invite notification
- How: Check DB for Notification row with correct userEmail, type, projectId

### AC-6: Already-linked user returns 400
- Expected: POST /api/admin/telegram/invite for already-linked user returns 400
- How: Call invite API for a linked user, verify 400 with error message

### AC-7: Missing botUsername returns 400 with clear message
- Expected: If telegramBotUsername not in ProjectSettings, invite returns 400 with helpful message
- How: Code review check on the guard in invite/route.ts

### AC-8: Copy link button works
- Expected: Copy Link copies deepLink to clipboard, shows Copied! for 2s
- How: Code review of clipboard logic in TelegramInviteModal.tsx

## Edge Cases to Test

### EC-1: Non-member email in invite request
- POST /api/admin/telegram/invite with userEmail not in project -> expect 400

### EC-2: Invalid email in invite body
- POST with userEmail not an email -> expect 422 (Zod validation)

### EC-3: Non-admin calling invite endpoint
- POST as regular user -> expect 403

### EC-4: Unauthenticated call to invite endpoint
- POST without session -> expect 401

### EC-5: /start with no payload (plain /start)
- Code review: handlers.ts falls through to welcome message when no payload

### EC-6: /start with invalid/expired code
- Code review: validateAndConsumeLinkCode returns null -> bot replies with error message

### EC-7: Invite for user with existing pending code
- generateLinkCode deletes previous codes first (codes.ts) -> verify preserved

### EC-8: GET links as non-admin
- GET /api/admin/telegram/links as regular user -> expect 403

## Security Audit Scope

### S-1: Admin-only on invite endpoint
- Non-admin (role=user) gets 403, not just a frontend guard

### S-2: Project isolation on invite
- Admin of Project A cannot invite a member of Project B (membership check uses admin's projectId)

### S-3: Project isolation on links GET
- Unlinked list only contains members of requesting admin's project

### S-4: Notification isolation
- Notification created for target userEmail only

### S-5: Deep link code entropy
- Code is 6-char uppercase alphanumeric (36^6 approx 2.1B combinations, 10min TTL)

### S-6: botUsername not leaked via settings GET
- GET /api/admin/telegram/settings should not expose botUsername

### S-7: XSS via userEmail in notification message
- Email stored in notification message string - verify not rendered as raw HTML

## Regression Test Scope
- Settings Telegram: existing bot token save/clear still works (settings/route.ts changes)
- Previously linked users still appear in linked array (links/route.ts changes)
- Unlink button still works (DELETE /api/admin/telegram/links/[id] unchanged)
- /link CODE command still works (performLink helper reused by both paths)
- Notification bell still loads (no schema changes)

## Bot Handler — Code Review Only
- /start payload branch: msg.text.trim().split(/\s+/)[1] extracts code correctly
- toUpperCase() applied defensively
- performLink() called from both /start CODE and /link CODE paths
- Plain /start (no payload) still sends welcome message
