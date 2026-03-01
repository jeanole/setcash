# PROJ-4: Next.js App Scaffold + PostgreSQL + Docker

## Status: Planned
**Created:** 2026-03-01
**Last Updated:** 2026-03-01

## Context
Parallel rewrite of vBudget using Next.js 14 (App Router), Prisma ORM, and PostgreSQL.
The new app lives in `/nextjs/` inside the existing repo. The existing Express app remains
untouched during the migration. All migration work happens on branch `to_nextjs`.

## Dependencies
- None (this is the foundation step)

## User Stories
- As a developer, I want a working Next.js 14 App Router scaffold so that I can build
  the new app incrementally without touching the existing Express app.
- As a developer, I want a Prisma schema that mirrors the current SQLite schema so that
  the data model is established before any feature pages are built.
- As a developer, I want a `docker-compose.test.yml` so that I can spin up the new Next.js
  app + PostgreSQL locally and test end-to-end without affecting the production Express app.
- As a developer, I want a basic shared layout (header, sidebar shell, main content area)
  so that subsequent feature pages have a consistent frame to drop into.

## Acceptance Criteria
- [ ] `/nextjs/` directory contains a Next.js 14+ project initialised with App Router (`app/` dir)
- [ ] TypeScript is configured (`tsconfig.json` present, strict mode on)
- [ ] Prisma is installed and configured to connect to PostgreSQL via `DATABASE_URL` env var
- [ ] Prisma schema (`schema.prisma`) defines all models matching the current vBudget tables:
      `User`, `Project`, `ProjectMember`, `Bill`, `BillImage`, `BillMotive`, `BillCategory`,
      `Category`, `Motive`, `Vgeld`, `EditLog`, `Settings`
- [ ] `prisma migrate dev` runs successfully against a fresh PostgreSQL instance
- [ ] `docker-compose.test.yml` at repo root starts: `nextjs` service (port 3001) + `postgres` service
- [ ] `.env.test` (gitignored) documents all required env vars with placeholder values;
      `.env.test.example` is committed with the same keys and dummy values
- [ ] `npm run dev` inside `/nextjs/` starts without errors on port 3001
- [ ] Root layout (`app/layout.tsx`) renders a sidebar shell and main content slot
- [ ] A placeholder home page (`app/page.tsx`) renders "vBudget — Next.js migration in progress"
- [ ] Branch `to_nextjs` is the only branch where `/nextjs/` changes are committed

## Edge Cases
- The existing Express app must not be modified in any way during this step
- `docker-compose.test.yml` must not conflict with the existing `docker-compose.yml` (different
  service names, different host ports)
- If `DATABASE_URL` is missing, the Next.js app must fail fast with a clear error, not silently
- Prisma schema must use `uuid` as default ID strategy (not auto-increment integers) to avoid
  collision with future data migration from SQLite integer IDs — use `String @id @default(uuid())`
  but also store the legacy SQLite integer id as `legacyId Int?` for migration mapping

## Technical Requirements
- Next.js: 14+ with App Router
- ORM: Prisma (latest stable)
- Database: PostgreSQL 15+
- Language: TypeScript (strict)
- Node: 20+
- Port: 3001 (Next.js dev / docker), 5432 (Postgres internal)
- Branch: `to_nextjs`

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
