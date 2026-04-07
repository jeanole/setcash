# External Integrations

**Analysis Date:** 2026-04-01

## APIs & External Services

**Google Sheets API:**
- Purpose: Export/sync project bills to Google Sheets spreadsheets
- SDK: `googleapis` v171.4.0 (`nextjs/lib/google.ts`)
- Auth: Per-project Google service account JSON credentials stored at `data/google-credentials-{projectId}.json`
- Scopes: `https://www.googleapis.com/auth/spreadsheets`
- API route: `nextjs/app/api/admin/export/google-sheet/route.ts`
- Credentials management: Upload, validate, and save via `saveCredentials()` and `validateCredentialsJson()` in `nextjs/lib/google.ts`

**Google OAuth 2.0:**
- Purpose: User authentication (sign-in with Google)
- SDK: `next-auth` Google provider (`nextjs/auth.ts` lines 200-207)
- Auth: `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` env vars
- Auto-creates user on first Google sign-in with email verified
- Required env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (validated at startup in `nextjs/lib/env.ts`)

**Telegram Bot API:**
- Purpose: Per-project Telegram bots for bill submission via chat photos
- SDK: `node-telegram-bot-api` v0.67.0 (`nextjs/lib/telegram/bot.ts`)
- Architecture: Long-polling per project, managed via `activeBots` Map on globalThis
- Auth: Per-project bot tokens stored encrypted in `ProjectSettings` table (AES-256-GCM)
- Encryption key: `TELEGRAM_ENCRYPTION_KEY` env var (required in production, `nextjs/server.ts`)
- Encryption/decryption: `nextjs/lib/telegram/encryption.ts` (via `decrypt()`)
- Message handling: `nextjs/lib/telegram/handlers.ts`
- Link codes for user binding: `nextjs/lib/telegram/codes.ts`
- Bot lifecycle: Started at server boot (`initAllBots()`), can be started/stopped per project
- API routes:
  - `nextjs/app/api/admin/telegram/settings/route.ts` - Bot token config
  - `nextjs/app/api/admin/telegram/links/route.ts` - Manage linked users
  - `nextjs/app/api/admin/telegram/invite/route.ts` - Send invite links
  - `nextjs/app/api/admin/telegram/restart/route.ts` - Restart bot
  - `nextjs/app/api/admin/telegram/bot-status/route.ts` - Check bot status
  - `nextjs/app/api/telegram/status/route.ts` - User-facing bot status
  - `nextjs/app/api/telegram/links/me/route.ts` - User's linked accounts
  - `nextjs/app/api/telegram/link-code/route.ts` - Generate link codes

**Resend (Email):**
- Purpose: Transactional email delivery (password reset, email verification, project invitations, platform invitations)
- SDK: `resend` v6.9.3 (`nextjs/lib/email.ts`)
- Auth: `RESEND_API_KEY` env var
- From address: `EMAIL_FROM` env var (defaults to `onboarding@resend.dev`)
- Graceful fallback: If `RESEND_API_KEY` not set, logs email links to console (dev-friendly)
- Email types:
  - `sendPasswordResetEmail()` - Password reset with 1-hour expiry
  - `sendVerificationEmail()` - Email verification with 24-hour expiry
  - `sendInvitationEmail()` - Project invitation with 7-day expiry
  - `sendPlatformInviteEmail()` - Platform-level invitation (no project)
- All emails use inline HTML with SetCash branding (SVG logo, yellow CTA buttons)

**AI Vision APIs (OCR):**
- Purpose: Automated receipt/invoice data extraction from uploaded bill images
- Implementation: `nextjs/lib/ocr.ts` - Multi-provider OCR system
- Supported providers:
  - **OpenAI** (`gpt-4o`) - `https://api.openai.com/v1`
  - **Google Gemini** (`gemini-1.5-flash`) - `https://generativelanguage.googleapis.com/v1beta`
  - **Anthropic Claude** (`claude-3-5-haiku-20241022`) - `https://api.anthropic.com/v1/messages`
  - **Qwen 2.5 VL** (`qwen-vl-max`) - `https://dashscope.aliyuncs.com/compatible-mode/v1`
  - **Qwen 3 VL** (`qwen-vl-max-latest`) - Same Alibaba endpoint
  - **DeepSeek** (`deepseek-chat`) - `https://api.deepseek.com/v1`
  - **Custom** - Any OpenAI-compatible endpoint (user-provided URL)
- Auth: Per-project API keys stored encrypted in `ProjectSettings` (AES-256-GCM via `OCR_ENCRYPTION_SECRET`)
- API route: `nextjs/app/api/bills/[id]/analyse/route.ts`
- Security: SSRF protection via `isPrivateUrl()` - blocks private IPs, local addresses, DNS rebinding
- Extracted fields: date, vendor, item, type, brutto19, brutto7, brutto0, amount

**Cloudflare Turnstile (CAPTCHA):**
- Purpose: Bot protection on demo login
- Build-time config: `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (baked into Docker image via build arg)
- Files: `nextjs/components/auth/DemoLoginButton.tsx`, `nextjs/app/api/auth/demo-login/route.ts`

## Rate Limiting

**Upstash Redis:**
- SDK: `@upstash/ratelimit` + `@upstash/redis` (`nextjs/lib/ratelimit.ts`)
- Auth: `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` env vars
- Fallback: In-memory sliding window rate limiter when Redis not configured
- Rate limits defined:
  - Bill creation: 10/min per user
  - Bill analysis: 5/min per user
  - Forgot password: 1 per 5min per email
  - Sign up: 3 per 10min per IP
  - Resend verification: 1 per 2min per email
  - Bug report: 3 per 10min
  - Telegram link code: 5 per 10min per user
  - Password change: 5 per 15min per user
  - Export report: 10/min per user
  - Project invite: 20/hour per project
  - Comment creation: 20/min per user
  - Visit log: 30/min per IP

## Data Storage

**Database:**
- PostgreSQL via Prisma ORM
- Connection: `DATABASE_URL` env var
- Client: `nextjs/lib/db.ts` (singleton with hot-reload protection)
- Schema: `nextjs/prisma/schema.prisma` (25 models)

**File Storage:**
- Local filesystem (primary)
- Upload directory: `UPLOADS_DIR` env var or `{cwd}/../data/uploads` (default)
- Upload handling: `nextjs/lib/upload.ts` using `formidable`
- Allowed types: `.jpg`, `.jpeg`, `.png`, `.webp`, `.pdf`
- Max file size: 10MB
- Magic byte validation for file type verification
- S3-compatible storage: Env vars exist in `.env.local.example` (`STORAGE_ENDPOINT`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_REGION`, `STORAGE_PUBLIC_URL`) but no `@aws-sdk` dependency detected in `package.json` -- likely planned but not yet implemented

**Caching:**
- Upstash Redis (when configured) - used only for rate limiting, not general caching

## Authentication & Identity

**Auth Provider:** NextAuth.js v5 (custom implementation)
- Strategy: JWT (no database sessions)
- Providers: Email/password (Credentials) + Google OAuth 2.0
- Password hashing: bcryptjs
- Session: JWT with custom claims (role, currentProjectId, currentProjectRole, isExampleProject, isDemoAccount)
- Edge middleware: `nextjs/middleware.ts` uses lightweight `auth.config.ts` (no Prisma in Edge)
- Full auth with DB lookups: `nextjs/auth.ts`
- Role hierarchy: `user` < `admin` < `owner` < `superadmin`
- Superadmin bypasses project membership checks

**Token-based Flows:**
- Password reset tokens: `PasswordResetToken` model, hashed, 1-hour expiry
- Email verification tokens: `EmailVerificationToken` model, hashed, 24-hour expiry
- Project invitation tokens: `InvitationToken` model, hashed, 7-day expiry

## Monitoring & Observability

**Error Tracking:**
- Console logging only (no Sentry/Datadog detected)

**Logs:**
- `console.log` / `console.error` / `console.warn` throughout
- Prisma query logging in development mode (`nextjs/lib/db.ts`)
- Structured prefixes: `[OCR]`, `[TG {projectId}]`, `[Email]`, `[Startup]`, `[RateLimit]`

**Analytics:**
- Custom analytics via `VisitLog` and `PageEvent` Prisma models
- API routes: `nextjs/app/api/analytics/visit/route.ts`, `nextjs/app/api/analytics/event/route.ts`
- Superadmin analytics dashboard: `nextjs/components/superadmin/AnalyticsTab.tsx`
- Demo login tracking: `DemoLoginAttempt` model

**Health Check:**
- Endpoint: `GET /api/health` (public, no auth required)
- Docker HEALTHCHECK: every 30s, 10s timeout, 3 retries

## CI/CD & Deployment

**Hosting:**
- Docker container (node:20-alpine, standalone Next.js output)
- Port 3001 (configurable)

**CI Pipeline:**
- Not detected in repository (no `.github/workflows/`, no `Jenkinsfile`, etc.)

## Environment Configuration

**Required env vars (validated at startup):**
- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_SECRET` - JWT signing secret
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret

**Required in production (validated in `server.ts` / `ocr.ts`):**
- `TELEGRAM_ENCRYPTION_KEY` - 64-hex-char key for encrypting bot tokens at rest
- `OCR_ENCRYPTION_SECRET` - AES key for encrypting OCR API keys at rest (falls back to `SESSION_SECRET`)

**Optional service env vars:**
- `RESEND_API_KEY` - Resend email API key (emails logged to console if unset)
- `EMAIL_FROM` - Email sender address (defaults to `onboarding@resend.dev`)
- `UPSTASH_REDIS_REST_URL` - Upstash Redis URL for rate limiting
- `UPSTASH_REDIS_REST_TOKEN` - Upstash Redis auth token
- `NEXT_PUBLIC_APP_URL` - Public app URL for email links
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` - Cloudflare Turnstile site key (build-time)
- `UPLOADS_DIR` - Custom upload directory path
- `ADMIN_EMAIL` - Default admin email for seeding
- `ADMIN_PASSWORD` - Default admin password for seeding

**S3 storage env vars (optional, possibly not yet implemented):**
- `STORAGE_ENDPOINT` - S3-compatible endpoint URL
- `STORAGE_BUCKET` - Bucket name
- `STORAGE_ACCESS_KEY` - Access key
- `STORAGE_SECRET_KEY` - Secret key
- `STORAGE_REGION` - Region
- `STORAGE_PUBLIC_URL` - Public URL for presigned URL rewriting

**Secrets location:**
- `nextjs/.env.local` (gitignored) for local development
- `nextjs/.env.test` for test environment
- Docker: Runtime environment variables injected at container start
- Google service account credentials: `data/google-credentials-{projectId}.json` files on disk

## Webhooks & Callbacks

**Incoming:**
- Telegram bot messages via long-polling (not webhooks) - `nextjs/lib/telegram/bot.ts`
- NextAuth OAuth callback: `/api/auth/callback/google`

**Outgoing:**
- None detected (no outgoing webhook registrations)

---

*Integration audit: 2026-04-01*
