# QA Test Plan

## Feature
PROJ-6: SQLite → PostgreSQL Data Migration Script
Spec: `features/PROJ-6-sqlite-postgres-migration.md`

## Context Summary
- PROJ-6 marked as "Complete" in INDEX.md
- Implementation committed: `8077402 feat(PROJ-6): Implement SQLite to PostgreSQL migration script`
- Script located at `nextjs/scripts/migrate-sqlite-to-pg.ts` (~1,200 lines)
- Depends on PROJ-4 (Next.js scaffold) which is Deployed

## User Guidance
- Focus areas: Data type transformations, Foreign key mapping, Idempotency, Error handling
- Test scope: Full — all acceptance criteria, edge cases, and code review
- Execution: Run against test database (requires running PostgreSQL)

## Acceptance Criteria to Test

### AC-1: Script Location
- **Expected:** Script at `/nextjs/scripts/migrate-sqlite-to-pg.ts`, runnable via `npx tsx`
- **Test:** Verify file exists, check shebang, verify TypeScript compilation

### AC-2: SQLite Path Configuration
- **Expected:** Reads from `DATA_DIR/vbudget.db`, path configurable via `SQLITE_PATH` env var
- **Test:** Verify default path works, verify custom path override works

### AC-3: PostgreSQL Connection
- **Expected:** Writes to PostgreSQL via Prisma using `DATABASE_URL`
- **Test:** Verify connection succeeds, verify error if DATABASE_URL missing

### AC-4: Migration Order
- **Expected:** Tables migrated in dependency order (users → projects → positions → members → motives → categories → bills → bill_images → bill_motives → bill_categories → budget_matrix → vgeld → editlog → project_settings → ocr_log → telegram_links → telegram_link_codes → notifications)
- **Test:** Review code for correct order, verify FK constraints satisfied

### AC-5: ID Mapping
- **Expected:** `legacyId` → UUID mapping stored in memory, FK references resolved
- **Test:** Verify ID maps exist for all tables, verify FK resolution logic

### AC-6: Idempotency
- **Expected:** Uses `upsert` on `legacyId`, re-running doesn't duplicate rows
- **Test:** Run migration twice, verify row counts don't increase

### AC-7: Per-Table Summary
- **Expected:** Prints `Table: bills — 142 rows inserted, 0 errors` format
- **Test:** Run migration, verify output format matches spec

### AC-8: Error Handling
- **Expected:** Exit code 1 on errors, continues to next table, doesn't partially commit
- **Test:** Review error handling in code, verify try/catch per table

### AC-9: NPM Script
- **Expected:** `npm run migrate:sqlite` works
- **Test:** Verify script defined in package.json, command runs

### AC-10: Documentation
- **Expected:** README section documents how to run migration
- **Test:** Check PROJ-4 spec for migration documentation

## Edge Cases to Test

### EC-1: Bill Image Paths
- **Expected:** File paths copied only, not actual files
- **Test:** Verify filePath field migrated, not binary content

### EC-2: EditLog References
- **Expected:** `user_id` and `bill_id` resolved via ID mapping
- **Test:** Verify editlog entries reference correct migrated records

### EC-3: Project-Scoped Settings
- **Expected:** Settings migrated with correct project UUID
- **Test:** Verify project_settings rows have correct projectId

### EC-4: Null Value Preservation
- **Expected:** Optional nulls preserved as `null`, not empty string
- **Test:** Check null handling in TypeScript conversion functions

### EC-5: Boolean Conversion
- **Expected:** SQLite 0/1 → PostgreSQL boolean
- **Test:** Verify `toBoolean()` function, check notifications.is_read migration

### EC-6: Timestamp Conversion
- **Expected:** ISO text strings → DateTime
- **Test:** Verify `toDateTime()` function handles various formats

## Security Audit Scope

Since this is a one-time migration script (not a running service), security focuses on:
- **Data exposure:** Does the script log sensitive data (passwords, tokens)?
- **Database security:** Does it use parameterized queries (Prisma does this)?
- **File system:** Does it read/write files safely?
- **Error messages:** Do errors expose sensitive paths or connection strings?

## Code Review Checklist

### Data Type Transformations
- [ ] `toBoolean()` correctly handles 0/1/null
- [ ] `toDateTime()` handles ISO strings, nulls, invalid dates
- [ ] `toJson()` safely parses JSON, handles nulls/malformed
- [ ] `toDecimal()` handles nulls, creates Prisma Decimal objects

### Foreign Key Resolution
- [ ] ID maps created for all 16 tables
- [ ] FK lookups checked for undefined before use
- [ ] Nullable FKs handled correctly (billId in editlog, etc.)

### Migration Order
- [ ] Root tables (users, projects) migrated first
- [ ] Dependent tables migrated after parents
- [ ] No circular dependency issues

### Idempotency
- [ ] All tables use `upsert` with correct where clause
- [ ] `legacyId` field used as match key
- [ ] ProjectSettings uses composite key upsert correctly

### Error Handling
- [ ] Per-table try/catch blocks
- [ ] Errors logged with context
- [ ] Migration continues after errors
- [ ] Final summary shows error count
- [ ] Exit code 1 on errors

### Column Mapping Accuracy
- [ ] `hash` → `passwordHash`
- [ ] `file` → `filePath` (BillImages)
- [ ] `admin`/`super_admin` → `isSuperAdmin`
- [ ] `is_read` → `isRead`
- [ ] `ocr_fields`, `changes`, `fields_written`, `ai_response` → JSON
- [ ] All enum mappings correct (status, ocrStatus, role)

## Execution Test Plan

1. **Prerequisites Check**
   - [ ] Docker compose test stack running (PostgreSQL on 5433)
   - [ ] SQLite database exists at `data/vbudget.db`
   - [ ] `DATABASE_URL` set correctly

2. **Pre-Migration State**
   - [ ] Record row counts from SQLite
   - [ ] Verify PostgreSQL is empty or has only seed data

3. **First Migration Run**
   - [ ] Run `npm run migrate:sqlite`
   - [ ] Capture output
   - [ ] Verify exit code 0
   - [ ] Verify per-table summaries

4. **Post-Migration Verification**
   - [ ] Compare row counts (SQLite vs PostgreSQL)
   - [ ] Spot-check specific records for data integrity
   - [ ] Verify `legacyId` fields populated
   - [ ] Check FK relationships preserved

5. **Idempotency Test**
   - [ ] Run migration again
   - [ ] Verify row counts unchanged
   - [ ] Verify exit code 0

6. **Error Scenario Test**
   - [ ] Test with invalid DATABASE_URL
   - [ ] Test with missing SQLite file
   - [ ] Verify appropriate error messages and exit codes

## Regression Test Scope

Since this is a new script, no regression testing needed. However, verify:
- PROJ-4 scaffold still works (docker-compose.test.yml starts)
- PROJ-5 authentication still works after migration

## Bug Report Template

See `.claude/skills/qa/test-template.md`
