# Technology Stack

**Analysis Date:** 2026-04-01

## Languages

**Primary:**
- TypeScript 5.6+ - All application code (`nextjs/**/*.ts`, `nextjs/**/*.tsx`)

**Secondary:**
- SQL - Prisma migrations in `nextjs/prisma/migrations/`
- CSS - Tailwind CSS v4 utility classes

## Runtime

**Environment:**
- Node.js 20+ (Alpine-based in Docker, see `nextjs/Dockerfile` line 1: `node:20-alpine`)
- Target: ES2017 (`nextjs/tsconfig.json` compilerOptions.target)

**Package Manager:**
- npm (lockfile: `nextjs/package-lock.json`)

## Frameworks

**Core:**
- Next.js 14.2.35 - App Router, standalone output mode (`nextjs/next.config.mjs`)
- React 18.3.1 - UI library
- React DOM 18.3.1

**Authentication:**
- NextAuth.js v5 (beta 30) - JWT strategy, Credentials + Google OAuth providers (`nextjs/auth.ts`)
- Edge-compatible auth config for middleware (`nextjs/auth.config.ts`)

**ORM:**
- Prisma 5.22+ - PostgreSQL client with `@prisma/client` (`nextjs/prisma/schema.prisma`)

**Testing:**
- Jest 29.7 - Test runner (`nextjs/jest.config.js`)
- ts-jest 29.4.6 - TypeScript transform for Jest

**Build/Dev:**
- tsx 4.19.2 - TypeScript execution for dev server and scripts
- TypeScript 5.6.3 - Compiler
- Tailwind CSS v4 with `@tailwindcss/postcss` - PostCSS plugin (`nextjs/postcss.config.mjs`)

## Key Dependencies

**Critical (core functionality):**
- `next` 14.2.35 - Web framework, App Router
- `@prisma/client` 5.22+ - Database ORM
- `next-auth` 5.0.0-beta.30 - Authentication (JWT, Credentials, Google OAuth)
- `zod` 4.3.6 - Input validation (all API routes)
- `bcryptjs` 3.0.3 - Password hashing (`nextjs/auth.ts`)

**External Service SDKs:**
- `googleapis` 171.4.0 - Google Sheets API for bill export (`nextjs/lib/google.ts`)
- `node-telegram-bot-api` 0.67.0 - Telegram bot polling per project (`nextjs/lib/telegram/bot.ts`)
- `resend` 6.9.3 - Transactional email delivery (`nextjs/lib/email.ts`)
- `@upstash/ratelimit` 2.0.8 + `@upstash/redis` 1.36.3 - Rate limiting with Redis backend (`nextjs/lib/ratelimit.ts`)

**File Generation:**
- `pdfkit` 0.17.2 - PDF report generation (externalized in webpack, `nextjs/next.config.mjs`)
- `exceljs` 4.4.0 - Excel spreadsheet export
- `archiver` 7.0.1 - ZIP archive creation for image exports

**UI:**
- `lucide-react` 0.477.0 - Icon library
- `recharts` 3.8.0 - Charts and data visualization
- `sonner` 2.0.7 - Toast notifications
- `cropperjs` 2.1.0 - Image cropping for bill photos

**File Upload:**
- `formidable` 3.5.4 - Multipart form-data parsing (`nextjs/lib/upload.ts`)

**Utility:**
- `date-fns` 4.1.0 - Date formatting and manipulation

**Dev-only:**
- `better-sqlite3` 11.8.1 - SQLite driver (legacy migration script `nextjs/scripts/migrate-sqlite-to-pg.ts`)
- `uuid` 11.0.5 - UUID generation in scripts/tests

## Database

**Engine:** PostgreSQL
- Connection: `DATABASE_URL` env var
- ORM: Prisma with `prisma-client-js` generator
- Binary targets: `native` + `linux-musl-openssl-3.0.x` (for Alpine Docker)
- Schema: `nextjs/prisma/schema.prisma` (25 models)
- Migrations: `nextjs/prisma/migrations/` (managed via `prisma migrate dev` / `prisma migrate deploy`)
- Seed script: `nextjs/prisma/seed.ts` (compiled to JS for production)

**Key models:** User, Project, ProjectMember, Bill, BillImage, BillMotive, BillCategory, Motive, Category, BudgetMatrix, Vgeld, EditLog, OcrLog, Notification, TelegramLink, SystemConfig, VisitLog, PageEvent

## Configuration

**TypeScript:**
- Config: `nextjs/tsconfig.json`
- Strict mode enabled
- Path alias: `@/*` maps to `nextjs/*`
- Module resolution: bundler

**Next.js:**
- Config: `nextjs/next.config.mjs`
- Output: `standalone` (optimized for Docker)
- Server external packages: `pdfkit`, `fontkit`
- Security headers: X-Frame-Options DENY, HSTS, nosniff, Referrer-Policy
- Git commit hash exposed as `NEXT_PUBLIC_GIT_COMMIT`

**PostCSS:**
- Config: `nextjs/postcss.config.mjs`
- Plugin: `@tailwindcss/postcss` (Tailwind v4)

**Environment:**
- Required vars validated at startup in `nextjs/lib/env.ts`: `DATABASE_URL`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- Local dev: `nextjs/.env.local` (gitignored)
- Test: `nextjs/.env.test`
- Example files: `nextjs/.env.local.example`, `nextjs/.env.test.example`

## Build & Deployment

**Development:**
```bash
cd nextjs
npm install
npm run dev        # Runs tsx server.ts (custom server with Telegram bot init)
```

**Production Build:**
```bash
npm run build      # next build (standalone output)
npm start          # node server.js (compiled custom server)
```

**Docker:**
- Multi-stage Dockerfile: `nextjs/Dockerfile`
- Stage 1 (deps): `npm ci`
- Stage 2 (builder): Prisma generate, Next.js build, compile server + seed via tsc
- Stage 3 (runner): Alpine, non-root user `nextjs:nodejs`, port 3001
- Startup: `prisma migrate deploy && node prisma/seed.js && node server.js`
- Health check: `GET /api/health` every 30s

**Custom Server:**
- `nextjs/server.ts` wraps Next.js with `http.createServer`
- Initializes all Telegram bots at startup via `initAllBots()`
- Validates `TELEGRAM_ENCRYPTION_KEY` at startup (hard fail in production)

## Platform Requirements

**Development:**
- Node.js 20+
- PostgreSQL database
- npm

**Production:**
- Docker (node:20-alpine based)
- PostgreSQL
- Upstash Redis (optional, falls back to in-memory rate limiting)
- Port 3001 (configurable via PORT env var)

---

*Stack analysis: 2026-04-01*
