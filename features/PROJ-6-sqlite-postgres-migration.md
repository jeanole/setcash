# PROJ-6: SQLite → PostgreSQL Data Migration Script

## Status: Planned
**Created:** 2026-03-01
**Last Updated:** 2026-03-01

## Dependencies
- Requires: PROJ-4 (Prisma schema + PostgreSQL instance via docker-compose.test.yml)

## User Stories
- As a developer, I want a migration script that copies all data from the existing SQLite
  database into PostgreSQL so that no production data is lost during cutover.
- As a developer, I want the script to be idempotent so that I can safely re-run it without
  creating duplicate records.
- As a developer, I want the script to report a clear summary (rows copied per table, any
  errors) so that I can verify correctness before cutting over.
- As a developer, I want the script to map legacy SQLite integer IDs to new UUIDs and store
  the mapping so that all foreign key relationships are preserved after migration.

## Acceptance Criteria
- [ ] Script located at `/nextjs/scripts/migrate-sqlite-to-pg.ts` (runnable via `ts-node` or
      `npx tsx`)
- [ ] Reads from `DATA_DIR/vbudget.db` (path configurable via env var `SQLITE_PATH`)
- [ ] Writes to PostgreSQL via Prisma using `DATABASE_URL`
- [ ] Migrates all tables in dependency order:
      1. `users`
      2. `projects`
      3. `project_members`
      4. `motives`
      5. `categories`
      6. `bills` (including `image_path`, `netto_amount`, `ai_*` fields)
      7. `bill_motives`
      8. `bill_categories`
      9. `vgeld`
      10. `editlog`
      11. `settings`
- [ ] Stores a `legacyId` → UUID mapping in memory during the run to resolve FK references
- [ ] Idempotent: uses `upsert` (match on `legacyId`) so re-running does not duplicate rows
- [ ] Prints a per-table summary: `Table: bills — 142 rows inserted, 0 errors`
- [ ] Exits with code 1 and a clear message if any table migration fails; does not partially commit
- [ ] `npm run migrate:sqlite` convenience script added to `/nextjs/package.json`
- [ ] README section in PROJ-4 scaffold documents how to run the migration

## Edge Cases
- Bill image files live in `data/uploads/` — the script copies file paths only (not the actual
  files); a separate note instructs the developer to `cp -r data/uploads/ nextjs/public/uploads/`
- `editlog` entries reference both `user_id` and `bill_id` — both must be resolved via ID mapping
- `settings` table may have project-scoped rows — all must be migrated with the correct project UUID
- Null values in optional columns must be preserved as `null` (not empty string)
- SQLite booleans (stored as 0/1) must be cast to PostgreSQL booleans
- SQLite timestamps (TEXT ISO strings) must be parsed and inserted as `DateTime`

## Technical Requirements
- Runtime: `tsx` / `ts-node` (no compilation step required)
- DB access: Prisma client for writes; `better-sqlite3` for reads
- Error handling: wrap each table in a try/catch; log error + continue so full report is visible
- Branch: `to_nextjs`

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
