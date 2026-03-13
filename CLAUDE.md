# SetCash — Claude Code Guide

## Project Overview

**SetCash** is a multi-tenant expense tracking and budget management web application built with Next.js, PostgreSQL, and Prisma.

> **All application code lives in the `nextjs/` subdirectory.** Do not look for or modify code at the repo root — the Express/vanilla JS legacy app has been removed.

## Tech Stack

- **Runtime:** Node.js (20+ recommended)
- **Framework:** Next.js 14 (App Router)
- **Database:** PostgreSQL via Prisma ORM
- **Frontend:** React + Tailwind CSS
- **Auth:** NextAuth.js (email/password + Google OAuth 2.0)
- **Integrations:** Google Sheets API, Google Drive API, Telegram Bot API
- **File generation:** PDFKit (PDF), ExcelJS (Excel)

## Project Structure

```
setcash/
├── nextjs/                    # ← ALL application code is here
│   ├── app/                   # Next.js App Router pages and API routes
│   │   ├── (protected)/       # Authenticated pages (budget, bills, etc.)
│   │   ├── api/               # API route handlers
│   │   └── ...
│   ├── components/            # React components
│   │   ├── budget/            # Budget matrix components
│   │   ├── bills/             # Bills components
│   │   ├── layout/            # AppShell, Header, Sidebar
│   │   └── ...
│   ├── lib/                   # Shared utilities and DB client
│   ├── prisma/                # Prisma schema and migrations
│   ├── scripts/               # Migration and seed scripts
│   ├── auth.ts                # NextAuth config
│   ├── middleware.ts           # Next.js middleware (auth guards)
│   ├── server.ts              # Custom Express-like server wrapper
│   ├── Dockerfile
│   └── package.json
├── features/                  # Feature specs and bug reports
├── specification.md           # Living architecture/API documentation
└── CLAUDE.md                  # This file
```

## Running the Application

```bash
cd nextjs
npm install
npm run dev        # Dev server on port 3000
npm run build && npm start   # Production
```

**With Docker:**
```bash
cd nextjs
docker build -t setcash .
docker run -p 3000:3000 setcash
```

## Environment Variables

All env vars go in `nextjs/.env.local`:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Secret for NextAuth session signing |
| `NEXTAUTH_URL` | Full URL of the app (e.g. `http://localhost:3000`) |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 client secret |
| `TARGET_SHEET_ID` | Google Sheets spreadsheet ID |
| `GOOGLE_DRIVE_FOLDER_ID` | Google Drive folder ID for uploads |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token (optional) |
| `OCR_ENCRYPTION_SECRET` | Secret for encrypting OCR API keys |

A `nextjs/data/google-credentials.json` service account file is required for Google integrations.

## Key Architecture Notes

- **App Router:** Pages in `nextjs/app/(protected)/`; API routes in `nextjs/app/api/`
- **Auth:** NextAuth.js in `nextjs/auth.ts`; session guards in `nextjs/middleware.ts`
- **Database:** Prisma client in `nextjs/lib/db.ts`; schema in `nextjs/prisma/schema.prisma`
- **Multi-tenant:** Projects are isolated; users belong to projects with roles (`user`, `admin`)
- **Super-admin:** A global super-admin role exists above project admins
- **Bill tracking:** Users submit expense bills with images; admins approve/process them
- **Google Sheets sync:** Bills can be exported/synced to Google Sheets
- **Roles:** `user` → submit bills; `admin` → manage project bills; `superadmin` → manage all projects and users

## Common Development Tasks

- **Add an API route:** Create a file under `nextjs/app/api/your-route/route.ts`
- **Add a page:** Create a folder under `nextjs/app/(protected)/your-page/page.tsx`
- **Modify the database schema:** Edit `nextjs/prisma/schema.prisma`, then run `npx prisma migrate dev`
- **Add a component:** Create under `nextjs/components/` in the appropriate subdomain folder
- **Refer to API docs:** See `specification.md` for the full list of API endpoints and data models

## Linting & Testing

```bash
cd nextjs
npm run lint       # ESLint
npm run test       # Jest (integration tests with real DB)
```
