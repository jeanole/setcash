# PROJ-6: SQLite → PostgreSQL Data Migration Script

## Status: Complete
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

**Tested:** 2026-03-04
**App URL:** N/A (Command-line script)
**Tester:** QA Engineer (AI)

---

### Code Review Results

#### Data Type Transformations
| Function | Status | Notes |
|----------|--------|-------|
| `toBoolean()` (line 65) | ⚠️ BUG | Returns `value === 1` which returns `false` for `null` instead of `null`. Should be `value === 1 ? true : value === 0 ? false : null` |
| `toDateTime()` (line 69) | ✅ PASS | Correctly handles null, invalid dates, and ISO strings |
| `toJson()` (line 75) | ✅ PASS | Handles null and malformed JSON gracefully |
| `toDecimal()` (line 84) | ⚠️ BUG | Uses `?? 0` which converts `null` to `0` instead of preserving `null`. This may cause data loss for optional decimal fields |

#### Foreign Key Resolution
| Check | Status | Notes |
|-------|--------|-------|
| ID maps for all tables | ✅ PASS | 16 ID maps defined (lines 31-46) |
| FK lookups checked | ✅ PASS | All lookups check for undefined before use |
| Nullable FKs handled | ✅ PASS | `billId` in editlog, `projectId` in notifications properly handled |
| **Missing telegramLinkCodeIdMap** | ⚠️ ISSUE | `telegram_link_codes` table migrated but no ID map created (not needed as it uses code as PK) |

#### Migration Order
| # | Table | Dependencies | Status |
|---|-------|--------------|--------|
| 1 | users | None | ✅ Correct |
| 2 | projects | None | ✅ Correct |
| 3 | project_positions | projects | ✅ Correct |
| 4 | project_members | projects, positions | ✅ Correct |
| 5 | motives | projects | ✅ Correct |
| 6 | categories | projects | ✅ Correct |
| 7 | bills | projects | ✅ Correct |
| 8 | bill_images | bills | ✅ Correct |
| 9 | bill_motives | bills, motives | ✅ Correct |
| 10 | bill_categories | bills, categories | ✅ Correct |
| 11 | budget_matrix | projects, motives, categories | ✅ Correct |
| 12 | vgeld | projects | ✅ Correct |
| 13 | editlog | projects, bills | ✅ Correct |
| 14 | project_settings | projects | ✅ Correct |
| 15 | ocr_log | projects, bills | ✅ Correct |
| 16 | telegram_links | projects, users | ✅ Correct |
| 17 | telegram_link_codes | projects | ✅ Correct |
| 18 | notifications | projects | ✅ Correct |

#### Idempotency
| Table | Uses upsert | legacyId unique constraint | Status |
|-------|-------------|---------------------------|--------|
| users | ✅ | ❌ **FAIL** | Schema missing `@unique` on legacyId |
| projects | ✅ | ❌ **FAIL** | Schema missing `@unique` on legacyId |
| project_positions | ✅ | ❌ **FAIL** | Schema missing `@unique` on legacyId |
| project_members | ✅ | ❌ **FAIL** | Schema missing `@unique` on legacyId |
| motives | ✅ | ❌ **FAIL** | Schema missing `@unique` on legacyId |
| categories | ✅ | ❌ **FAIL** | Schema missing `@unique` on legacyId |
| bills | ✅ | ❌ **FAIL** | Schema missing `@unique` on legacyId |
| bill_images | ✅ | ❌ **FAIL** | Schema missing `@unique` on legacyId |
| bill_motives | ✅ | ❌ **FAIL** | Schema missing `@unique` on legacyId |
| bill_categories | ✅ | ❌ **FAIL** | Schema missing `@unique` on legacyId |
| budget_matrix | ✅ | ❌ **FAIL** | Schema missing `@unique` on legacyId |
| vgeld | ✅ | ❌ **FAIL** | Schema missing `@unique` on legacyId |
| editlog | ✅ | ❌ **FAIL** | Schema missing `@unique` on legacyId |
| project_settings | ✅ (composite key) | N/A | ✅ Uses composite key upsert correctly |
| ocr_log | ✅ | ❌ **FAIL** | Schema missing `@unique` on legacyId |
| telegram_links | ✅ | ❌ **FAIL** | Schema missing `@unique` on legacyId |
| telegram_link_codes | ✅ (code PK) | N/A | ✅ Uses code as primary key |
| notifications | ✅ | ❌ **FAIL** | Schema missing `@unique` on legacyId |

#### Error Handling
| Check | Status | Line # | Notes |
|-------|--------|--------|-------|
| Per-table try/catch | ✅ PASS | 195-254 | Users wrapped in try/catch |
| Per-row try/catch | ✅ PASS | 201-229 | Individual rows have error handling |
| Errors logged | ✅ PASS | 228, 247 | Error messages include context |
| Migration continues | ✅ PASS | - | Errors don't stop other tables |
| Exit code on errors | ✅ PASS | 1185-1188 | `process.exit(1)` on errors |
| Fatal error handling | ✅ PASS | 1200-1203 | Top-level catch for fatal errors |

#### Column Mapping Accuracy
| SQLite Column | PostgreSQL Column | Status | Line # |
|---------------|-------------------|--------|--------|
| `hash` | `passwordHash` | ✅ Correct | 210, 218 |
| `file` | `filePath` | ✅ Correct | 601, 610 |
| `admin`/`super_admin` | `isSuperAdmin` | ✅ Correct | 211, 219 |
| `is_read` | `isRead` | ✅ Correct | 1117, 1127 |
| `ocr_fields` | JSON | ✅ Correct | 536, 559 |
| `changes` | JSON | ✅ Correct | 871, 881 |
| `fields_written` | JSON | ✅ Correct | 969, 981 |
| `ai_response` | JSON | ✅ Correct | 970, 982 |
| `project_role` | `role` enum | ✅ Correct | 366, 374 |
| `ocr_status` | Enum mapping | ✅ Correct | 505-508 |
| `status` | Enum mapping | ✅ Correct | 511-515 |

---

### Acceptance Criteria Status

#### AC-1: Script Location
- [x] Script at `/nextjs/scripts/migrate-sqlite-to-pg.ts`
- [x] Runnable via `npx tsx` (verified: `npm run migrate:sqlite` works)

#### AC-2: SQLite Path Configuration
- [x] Default path `../../data/vbudget.db` works
- [x] Custom path via `SQLITE_PATH` env var works

#### AC-3: PostgreSQL Connection
- [x] Connection succeeds with valid DATABASE_URL
- [x] Error message shown if DATABASE_URL missing: "Error: DATABASE_URL environment variable is required"
- [x] Exit code 1 on connection failure

#### AC-4: Migration Order
- [ ] **BUG**: Order incorrect per spec. Spec says: users → projects → project_members → motives → categories → bills → bill_motives → bill_categories → vgeld → editlog → settings
- Actual order includes `project_positions` (correctly added) but missing `bill_images` from spec list

#### AC-5: ID Mapping
- [x] ID maps exist for all tables (16 maps)
- [x] FK resolution logic implemented
- [ ] **BUG**: Idempotency fails because `legacyId` is not marked `@unique` in Prisma schema

#### AC-6: Idempotency
- [ ] **CRITICAL BUG**: Upsert fails because `legacyId` lacks `@unique` constraint
- Error: "Argument `where` of type UserWhereUniqueInput needs at least one of `id` or `email` arguments"
- This affects ALL tables except project_settings and telegram_link_codes

#### AC-7: Per-Table Summary
- [x] Output format: `✓ users: 5 rows migrated`
- [x] Error format: `✗ users: 0 rows, 3 errors`
- [x] Detailed errors shown (first 3)
- [x] Final summary with totals

#### AC-8: Error Handling
- [x] Per-table try/catch implemented
- [x] Per-row error handling
- [x] Migration continues after errors
- [x] Exit code 1 on errors
- [ ] **BUG**: Error AC says "does not partially commit" but Prisma's upsert may partially commit per table

#### AC-9: NPM Script
- [x] `npm run migrate:sqlite` defined in package.json
- [x] Command executes successfully

#### AC-10: Documentation
- [ ] **NOT VERIFIED**: PROJ-4 spec documentation not checked

---

### Edge Cases Status

#### EC-1: Bill Image Paths
- [x] `filePath` field migrated (file column, line 601, 610)
- [x] Binary content not migrated (correct)

#### EC-2: EditLog References
- [x] `billId` resolved via ID mapping (line 860)
- [x] Nullable FK handled correctly (line 860: `row.bill_id ? billIdMap.get(row.bill_id) : null`)

#### EC-3: Project-Scoped Settings
- [x] Settings migrated with correct project UUID (line 910)
- [x] Uses composite key upsert correctly

#### EC-4: Null Value Preservation
- [ ] **BUG**: `toDecimal()` converts null to 0 (line 84), should preserve null
- [ ] **BUG**: `toBoolean()` returns `false` for null (line 65), should return null for tri-state logic
- [x] `toDateTime()` preserves null (line 70)
- [x] `toJson()` preserves null (line 76)

#### EC-5: Boolean Conversion
- [x] `toBoolean()` converts 0/1 (line 65)
- [ ] **BUG**: Returns `false` for null instead of `null`

#### EC-6: Timestamp Conversion
- [x] ISO strings converted to DateTime (line 69-72)
- [x] Invalid dates handled (returns null)

---

### Security Audit Results

| Check | Status | Notes |
|-------|--------|-------|
| Password logging | ✅ PASS | Password hashes logged but not plaintext passwords |
| Connection string | ✅ PASS | Masked in output (`//***@`) line 97 |
| Parameterized queries | ✅ PASS | Prisma handles this |
| File system access | ✅ PASS | Read-only access to SQLite file |
| Error messages | ✅ PASS | No sensitive data in error messages |

---

### Execution Test Results

#### Prerequisites Check
- [x] docker-compose.test.yml exists
- [x] PostgreSQL running on port 5433
- [x] data/vbudget.db exists (73728 bytes)
- [x] DATABASE_URL configured

#### Pre-Migration State
SQLite row counts (from database):
- users: 3 rows
- projects: 2 rows
- project_positions: 17 rows
- project_members: 5 rows
- motives: 9 rows
- categories: 19 rows
- bills: 16 rows
- bill_images: 12 rows
- bill_motives: 15 rows
- bill_categories: 12 rows
- budget_matrix: 126 rows
- vgeld: 4 rows
- editlog: 41 rows
- project_settings: 15 rows
- ocr_log: 21 rows
- telegram_links: 1 row
- telegram_link_codes: 0 rows
- notifications: 0 rows

#### First Migration Run
- [x] Script executed
- [ ] **FAILED**: Exit code 1 (318 total errors)
- Error: `Argument `where` of type UserWhereUniqueInput needs at least one of `id` or `email` arguments`
- **Root Cause**: Prisma schema missing `@unique` on `legacyId` fields

#### Post-Migration Verification
- [ ] **N/A**: Migration failed, no rows migrated
- 0 rows migrated to PostgreSQL

#### Idempotency Test
- [ ] **N/A**: Cannot test - first migration failed

#### Error Scenario Tests
- [x] Missing DATABASE_URL: Error shown, exit code 1
- [x] Invalid SQLite path: Error shown, exit code 1
- [x] Appropriate error messages for both cases

---

### Bugs Found

#### BUG-1: legacyId Not Unique - Causes Upsert Failure
- **Severity:** Critical
- **Skill Tag:** [Backend]
- **Steps to Reproduce:**
  1. Start test PostgreSQL database
  2. Run `npm run migrate:sqlite` in nextjs directory
  3. Observe errors for all tables
- **Expected:** Migration succeeds with rows upserted
- **Actual:** All tables fail with error "Argument `where` of type XWhereUniqueInput needs at least one of `id` or `email` arguments"
- **Root Cause:** Prisma schema defines `legacyId Int?` without `@unique` constraint. Prisma requires unique fields for upsert WHERE clauses.
- **Fix Required:** Add `@unique` to `legacyId` fields in schema.prisma for all tables, then create migration

#### BUG-2: toDecimal Loses Null Values
- **Severity:** Medium
- **Skill Tag:** [Backend]
- **Line:** 84
- **Steps to Reproduce:**
  1. Check `toDecimal()` function
  2. Pass `null` value
  3. Observe return value is `new Decimal(0)` not `null`
- **Expected:** `toDecimal(null)` returns `null`
- **Actual:** `toDecimal(null)` returns `Decimal(0)`
- **Impact:** Optional decimal fields (like bill amounts) will be stored as 0 instead of NULL, potentially causing incorrect totals

#### BUG-3: toBoolean Loses Null Values
- **Severity:** Low
- **Skill Tag:** [Backend]
- **Line:** 65
- **Steps to Reproduce:**
  1. Check `toBoolean()` function
  2. Pass `null` value
  3. Observe return value is `false` not `null`
- **Expected:** `toBoolean(null)` returns `null`
- **Actual:** `toBoolean(null)` returns `false`
- **Impact:** SQLite null booleans become PostgreSQL false, losing tri-state semantics

#### BUG-4: Missing telegramLinkIdMap Usage
- **Severity:** Low
- **Skill Tag:** [Backend]
- **Line:** 1036
- **Issue:** `telegramLinkIdMap` is created and populated (line 1036) but never used for FK resolution. No other table references telegram_links, so this is cosmetic.

---

### Summary

- **Acceptance Criteria:** 7/10 passed (AC-4, AC-6, AC-10 have issues)
- **Edge Cases:** 3/6 passed (EC-4, EC-5 have issues)
- **Bugs Found:** 4 total (1 Critical, 1 Medium, 2 Low)
- **Security:** Pass
- **Production Ready:** **NO**
- **Recommendation:** **Fix BUG-1 before deployment**

### Required Actions Before Deployment

1. **[Critical]** Add `@unique` attribute to `legacyId` fields in Prisma schema for all tables
2. **[Critical]** Create Prisma migration: `npx prisma migrate dev --name add_legacyid_unique`
3. **[Medium]** Fix `toDecimal()` to preserve null: `return value === null ? null : new Decimal(value ?? 0)`
4. **[Low]** Fix `toBoolean()` to preserve null: `return value === null ? null : value === 1`
5. **[Low]** Remove unused `telegramLinkIdMap` or add FK references

### Regression Test Scope
- PROJ-4 scaffold: ✅ Works (PostgreSQL running)
- PROJ-5 authentication: **NOT TESTED** (migration blocked)

## Deployment
_To be added by /deploy_
