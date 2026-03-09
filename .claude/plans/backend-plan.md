# Backend Implementation Plan — PROJ-12 (Telegram Integration)

## Feature
PROJ-12: Integrations (Google Sheets + Telegram)
Spec: `features/PROJ-12-integrations.md`
Scope: **Telegram only** (Google Sheets routes already exist)

## Context Summary
- Prisma models `TelegramLink` and `TelegramLinkCode` already exist in schema
- No Telegram API routes or lib files exist yet in Next.js
- Express `routes/telegram.js` has full working implementation to port
- `lib/upload.ts` has UPLOADS_DIR and file utilities
- Auth pattern: `auth()` → `session.user.currentProjectId`, `session.user.currentProjectRole`
- Admin check: `role === 'superadmin' || currentProjectRole in ['admin', 'owner']`
- Rate limiting via `@upstash/ratelimit` with mock fallback

## User Decisions
- **Scope:** Telegram only — skip Google Sheets test/status endpoints
- **Code generation:** Use `crypto.randomBytes` for secure 6-char codes
- **Token storage:** AES-256 encryption for bot tokens in ProjectSettings
- **Dependencies:** Install `node-telegram-bot-api` + `@types/node-telegram-bot-api`

## Open Bug Reports to Address
None

## Dependencies to Install
```bash
cd nextjs && npm install node-telegram-bot-api && npm install -D @types/node-telegram-bot-api
```

## Files to Create

### 1. `lib/telegram/encryption.ts` — Token encryption/decryption
- AES-256-GCM encryption using `TELEGRAM_ENCRYPTION_KEY` env var
- `encrypt(plaintext: string): string` → returns `iv:authTag:ciphertext` (hex)
- `decrypt(encrypted: string): string` → reverses
- Fail gracefully if env var not set (warn + store plaintext for dev)

### 2. `lib/telegram/codes.ts` — Link code generation/validation
- `generateLinkCode(userEmail: string, projectId: string): Promise<{ code: string; expires: Date }>`
  - Delete existing codes for user+project first
  - Generate 6-char alphanumeric code using `crypto.randomBytes`
  - Insert into `TelegramLinkCode` with 10-min TTL
- `validateLinkCode(code: string, projectId: string): Promise<{ userEmail: string } | null>`
  - Check code exists, matches project, not expired
  - Delete code on success (single-use)

### 3. `lib/telegram/handlers.ts` — Bot message handlers
Port from Express `routes/telegram.js`:
- `handleStartCommand(bot, msg)` — Welcome message (German)
- `handleLinkCommand(bot, msg, projectId)` — Validate code, create TelegramLink (upsert)
- `handlePhoto(bot, msg, projectId)` — Check linked, download photo, create draft bill
- `handleMediaGroup(bot, msg, projectId)` — Buffer album photos (1.5s), create one bill
- `downloadTelegramFile(bot, fileId)` — Download to UPLOADS_DIR with `tg_` prefix
- `createDraftBill(projectId, userEmail, photos, caption)` — Prisma version of Express createDraftBill
  - Create bill with status `draft`, billNumber `TG-${timestamp}`
  - Auto-assign Default motive + Uncategorized category (100% each)
  - Attach images via BillImage records
  - Fire-and-forget OCR if `ocrEnabled` setting is true

### 4. `lib/telegram/bot.ts` — Bot instance management
Port from Express, adapted for Next.js:
- `activeBots: Map<string, TelegramBot>` — global singleton (use `globalThis` for dev HMR)
- `startProjectBot(projectId: string): Promise<void>` — Decrypt token, create bot, register handlers, start polling
- `stopProjectBot(projectId: string): void` — Stop polling, remove from map
- `initAllBots(): Promise<void>` — Query all projects, start enabled bots
- `isBotRunning(projectId: string): boolean`
- Polling error handling: 409 → stop, others → log

### 5. `nextjs/server.ts` — Custom Next.js server for bot lifecycle
```typescript
import { createServer } from 'http';
import next from 'next';
import { initAllBots } from './lib/telegram/bot';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
app.prepare().then(() => {
  initAllBots();
  createServer(app.getRequestHandler()).listen(3000);
});
```
- Update `package.json` scripts: `"start": "node server.js"` (compiled), `"dev": "tsx server.ts"` or `npx ts-node server.ts`
- Update `Dockerfile` to use custom server

### 6. API Routes

#### `app/api/telegram/link-code/route.ts` — GET
- Auth: any authenticated user
- Requires: currentProjectId, telegram enabled for project
- Calls `generateLinkCode()`
- Returns `{ code, expires }`
- Rate limit: 5/min (reuse mock pattern from ratelimit.ts)

#### `app/api/telegram/status/route.ts` — GET
- Auth: any authenticated user
- Returns `{ enabled, linked, linkedAt }` for current user+project

#### `app/api/telegram/links/me/route.ts` — DELETE
- Auth: any authenticated user
- Deletes TelegramLink for current user+project
- Returns `{ ok: true }`

#### `app/api/admin/telegram/links/route.ts` — GET
- Auth: admin/owner/superadmin
- Returns all TelegramLink records for project (with user email, telegram ID, date)

#### `app/api/admin/telegram/links/[id]/route.ts` — DELETE
- Auth: admin/owner/superadmin
- Deletes specific TelegramLink by ID
- Returns `{ ok: true }`

#### `app/api/admin/telegram/bot-status/route.ts` — GET
- Auth: admin/owner/superadmin
- Returns `{ running: boolean }` from activeBots map

#### `app/api/admin/telegram/restart/route.ts` — POST
- Auth: admin/owner/superadmin
- Calls `startProjectBot(projectId)`
- Returns `{ running: boolean }`

## Auth Pattern (copy from existing routes)
```typescript
const session = await auth();
if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
const projectId = session.user.currentProjectId;
if (!projectId) return NextResponse.json({ error: 'No project selected' }, { status: 400 });

// For admin routes:
const isAdmin = session.user.role === 'superadmin'
  || session.user.currentProjectRole === 'admin'
  || session.user.currentProjectRole === 'owner';
if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
```

## Environment Variables
```
TELEGRAM_ENCRYPTION_KEY=  # 32-byte hex key for AES-256-GCM (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
```
Add to `.env.example` and document.

## Checklist
- [ ] Install `node-telegram-bot-api` + types
- [ ] Create `lib/telegram/encryption.ts`
- [ ] Create `lib/telegram/codes.ts`
- [ ] Create `lib/telegram/handlers.ts`
- [ ] Create `lib/telegram/bot.ts`
- [ ] Create `server.ts` custom server
- [ ] Update `package.json` start scripts
- [ ] Update `Dockerfile` for custom server
- [ ] Create all 7 API routes
- [ ] Add `TELEGRAM_ENCRYPTION_KEY` to `.env.example`
- [ ] Validate with `npx tsc --noEmit`
- [ ] Commit: `feat(PROJ-12): Implement Telegram integration backend`
