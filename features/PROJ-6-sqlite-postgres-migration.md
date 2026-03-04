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

### Overview
PROJ-6 is a **one-time data migration tool** that bridges the legacy Express/SQLite app and the new Next.js/PostgreSQL app. It reads from the existing `vbudget.db` file and writes to PostgreSQL via Prisma, transforming integer IDs to UUIDs while preserving all relationships.

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Migration Script                            │
│              /nextjs/scripts/migrate-sqlite-to-pg.ts            │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌──────────────┐    ┌────────────────┐    ┌──────────────────┐
│   SQLite     │    │  ID Mapping    │    │   PostgreSQL     │
│  (Source)    │───▶│    Engine      │───▶│   (Target)       │
│              │    │                │    │                  │
│ • vbudget.db │    │ In-memory maps │    │ • Prisma Client  │
│ • Integer PKs│    │ legacyId → UUID│    │ • UUID PKs       │
│ • TEXT dates │    │                │    │ • DateTime       │
│ • 0/1 bools  │    │ Preserves FKs  │    │ • Boolean        │
└──────────────┘    └────────────────┘    └──────────────────┘
```

### Data Flow (Dependency Order)

Tables must be migrated in order because of foreign key relationships:

| Order | Table | Has Foreign Keys To |
|-------|-------|---------------------|
| 1 | `users` | None (root) |
| 2 | `projects` | None (root) |
| 3 | `project_positions` | `projects` |
| 4 | `project_members` | `projects`, `users`, `project_positions` |
| 5 | `motives` | `projects` |
| 6 | `categories` | `projects` |
| 7 | `bills` | `projects`, `users` (via email) |
| 8 | `bill_images` | `bills` |
| 9 | `bill_motives` | `bills`, `motives` |
| 10 | `bill_categories` | `bills`, `categories` |
| 11 | `budget_matrix` | `projects`, `motives`, `categories` |
| 12 | `vgeld` | `projects` |
| 13 | `editlog` | `projects`, `bills` |
| 14 | `project_settings` | `projects` |
| 15 | `telegram_links` | `projects`, `users` |

### ID Mapping Strategy

**The Challenge:** SQLite uses integer IDs (1, 2, 3...), PostgreSQL uses UUIDs. Foreign keys must be preserved.

**Solution:** In-memory mapping tables

```
During migration:
┌─────────────┐         ┌──────────────────┐
│ SQLite User │         │ PostgreSQL User  │
│ id: 1       │────────▶│ id: uuid-v4-xxx  │
│ email: bob  │         │ legacyId: 1      │
└─────────────┘         └──────────────────┘
                              │
                              ▼
                        ┌─────────────┐
                        │ userIdMap   │
                        │ { 1: uuid } │
                        └─────────────┘
```

When migrating `bills` (which reference `user_id`), the script looks up the legacy ID in the map to get the new UUID.

### Data Type Transformations

| SQLite Type | PostgreSQL Type | Transformation |
|-------------|-----------------|----------------|
| `INTEGER` (PK) | `String` (UUID) | Generate UUID, store `legacyId` |
| `INTEGER` (0/1) | `Boolean` | `!!value` or `value === 1` |
| `TEXT` (ISO date) | `DateTime` | `new Date(text)` |
| `REAL` | `Decimal` | Direct pass-through |
| `TEXT` (enums) | Enum type | Map values (e.g., 'admin' → 'admin') |

### Idempotency Strategy

Each table migration uses Prisma `upsert`:
- **Match key:** `legacyId` field
- **Create:** Insert new row with generated UUID
- **Update:** Overwrite existing row (safe re-run)

**Benefits:**
- Safe to re-run if migration fails halfway
- Can migrate "deltas" (new rows in SQLite after initial migration)
- No need to truncate PostgreSQL before re-running

### Error Handling & Reporting

**Per-Table Approach:**
- Each table wrapped in try/catch
- Success: Report rows migrated
- Error: Log error, continue to next table
- Final summary with exit code

**Final Report:**
```
═══════════════════════════════════════
  Migration Complete
═══════════════════════════════════════
✓ users: 5 rows migrated
✓ projects: 2 rows migrated
✓ bills: 142 rows migrated
✗ budget_matrix: 0 rows, 3 errors

Exit code: 1 (errors occurred)
```

### Environment Configuration

| Variable | Purpose | Default |
|----------|---------|---------|
| `SQLITE_PATH` | Path to SQLite file | `../../data/vbudget.db` |
| `DATABASE_URL` | PostgreSQL connection | (required) |

### Dependencies

| Package | Purpose |
|---------|---------|
| `better-sqlite3` | Read from SQLite (synchronous, fast) |
| `@prisma/client` | Write to PostgreSQL |

### Usage

```bash
# From /nextjs directory
npm run migrate:sqlite

# Or directly
npx tsx scripts/migrate-sqlite-to-pg.ts
```

### Pre-Migration Checklist (Manual)

Before running the script, the operator must:

1. **Copy image files:** `cp -r data/uploads/ nextjs/public/uploads/`
2. **Verify PostgreSQL is running** and `DATABASE_URL` is set
3. **Verify Prisma schema is migrated:** `npx prisma migrate deploy`
4. **Back up SQLite database** (optional but recommended)

### Post-Migration Verification

The script outputs row counts that should be verified:
- Compare SQLite row count ≈ PostgreSQL row count
- Check that `legacyId` fields are populated
- Spot-check a few records for data integrity

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
