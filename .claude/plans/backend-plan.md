# Backend Implementation Plan

## Feature
PROJ-6: SQLite → PostgreSQL Data Migration Script
Spec: `features/PROJ-6-sqlite-postgres-migration.md`

## Context Summary

### Project Context (from INDEX.md)
- PROJ-6 is "In Progress" status
- Depends on PROJ-4 (Next.js scaffold + PostgreSQL) which is Deployed
- Part of the `to_nextjs` branch migration effort

### Existing Tables (SQLite - Legacy)
Located in `data/vbudget.db`:
1. `users` - id, email, hash, admin, super_admin, default_project_id
2. `projects` - id, name, subtitle, created_at
3. `project_positions` - id, project_id, name
4. `project_members` - id, project_id, user_email, project_role, position_id
5. `motives` - id, name, budget, project_id
6. `categories` - id, name, budget, project_id
7. `bills` - id, date, email, bill_number, type, vendor, item, comment, motive, brutto19, brutto7, brutto0, amount, filename, file, ocr_status, ocr_fields, telegram_caption, netto_amount, status, project_id
8. `bill_images` - id, bill_id, filename, file, sort_order, created_at
9. `bill_motives` - id, bill_id, motive_id, percentage
10. `bill_categories` - id, bill_id, category_id, percentage
11. `budget_matrix` - id, motive_id, category_id, amount, project_id
12. `vgeld` - id, date, amount, from_user, to_user, created_by, project_id
13. `editlog` - id, timestamp, user, bill_id, changes, source, project_id
14. `project_settings` - project_id, key, value
15. `ocr_log` - id, project_id, bill_id, timestamp, provider, status, fields_written, ai_response, error_detail
16. `telegram_links` - id, project_id, telegram_user_id, user_email, linked_at
17. `telegram_link_codes` - code, user_email, project_id, expires_at, created_at
18. `notifications` - id, user_email, type, message, project_id, is_read, created_at

### Target Tables (PostgreSQL via Prisma)
All models use UUID primary keys with `legacyId Int?` for migration mapping:
- `User`, `Project`, `ProjectPosition`, `ProjectMember`, `Motive`, `Category`
- `Bill`, `BillImage`, `BillMotive`, `BillCategory`, `BudgetMatrix`
- `Vgeld`, `EditLog`, `ProjectSettings`, `OcrLog`
- `Notification`, `TelegramLink`, `TelegramLinkCode`

### Key Differences to Handle
| Aspect | SQLite | PostgreSQL/Prisma |
|--------|--------|-------------------|
| Primary Keys | INTEGER AUTOINCREMENT | UUID (String) |
| Foreign Keys | INTEGER | UUID (String) |
| Booleans | 0/1 INTEGER | Boolean |
| Dates | TEXT (ISO strings) | DateTime |
| JSON | TEXT | Json |
| User role | `admin` column (0/1) | `isSuperAdmin` + `ProjectRole` enum |

## User Decisions

**None required** - This is a one-time data migration tool with well-defined requirements. The spec already covers:
- Script location: `/nextjs/scripts/migrate-sqlite-to-pg.ts`
- SQLite path: configurable via `SQLITE_PATH` env var, default `../../data/vbudget.db`
- PostgreSQL connection: via `DATABASE_URL` env var
- All tables and migration order defined
- Idempotency via upsert
- Reporting requirements

## Open Bug Reports to Address
None - No open bugs for PROJ-6 in INDEX.md

## Implementation Plan

### 1. Dependencies to Add
Add to `nextjs/package.json` devDependencies:
- `better-sqlite3` - For reading from SQLite database
- `@types/better-sqlite3` - TypeScript types

### 2. Migration Script Structure
Create `/nextjs/scripts/migrate-sqlite-to-pg.ts`:

```typescript
// ID Mapping Maps (in-memory)
const userIdMap: Map<number, string> = new Map();
const projectIdMap: Map<number, string> = new Map();
const projectPositionIdMap: Map<number, string> = new Map();
const projectMemberIdMap: Map<number, string> = new Map();
const motiveIdMap: Map<number, string> = new Map();
const categoryIdMap: Map<number, string> = new Map();
const billIdMap: Map<number, string> = new Map();
const billImageIdMap: Map<number, string> = new Map();
const billMotiveIdMap: Map<number, string> = new Map();
const billCategoryIdMap: Map<number, string> = new Map();
const budgetMatrixIdMap: Map<number, string> = new Map();
const vgeldIdMap: Map<number, string> = new Map();
const editLogIdMap: Map<number, string> = new Map();
const ocrLogIdMap: Map<number, string> = new Map();
const notificationIdMap: Map<number, string> = new Map();
const telegramLinkIdMap: Map<number, string> = new Map();

// Migration results tracking
interface MigrationResult {
  table: string;
  inserted: number;
  errors: number;
  errorDetails: string[];
}
```

### 3. Migration Order & Logic

#### Step 1: Users (Root - no FKs)
- SQLite: `id, email, hash, admin, super_admin, default_project_id`
- PG: `id, legacyId, email, passwordHash, isSuperAdmin, isActive, defaultProjectId, createdAt`
- Transformations:
  - `hash` → `passwordHash`
  - `super_admin || admin` → `isSuperAdmin` (boolean)
  - `default_project_id` → resolved via projectIdMap after projects migrated

#### Step 2: Projects (Root - no FKs)
- SQLite: `id, name, subtitle, created_at`
- PG: `id, legacyId, name, subtitle, createdAt`
- Transformations:
  - `created_at` TEXT → `createdAt` DateTime

#### Step 3: ProjectPositions
- SQLite: `id, project_id, name`
- PG: `id, legacyId, projectId, name`
- FK: `project_id` → `projectIdMap.get(project_id)`

#### Step 4: ProjectMembers
- SQLite: `id, project_id, user_email, project_role, position_id`
- PG: `id, legacyId, projectId, userEmail, role, positionId`
- Transformations:
  - `project_role` → `role` (ProjectRole enum: 'user' | 'admin')
- FKs: `project_id`, `position_id` (nullable)

#### Step 5: Motives
- SQLite: `id, name, budget, project_id`
- PG: `id, legacyId, projectId, name, budget`
- FK: `project_id` → `projectIdMap.get(project_id)`

#### Step 6: Categories
- SQLite: `id, name, budget, project_id`
- PG: `id, legacyId, projectId, name, budget`
- FK: `project_id` → `projectIdMap.get(project_id)`

#### Step 7: Bills
- SQLite: `id, date, email, bill_number, type, vendor, item, comment, motive, brutto19, brutto7, brutto0, amount, filename, file, ocr_status, ocr_fields, telegram_caption, netto_amount, status, project_id`
- PG: `id, legacyId, projectId, submittedByEmail, date, billNumber, type, vendor, item, comment, motiveLegacy, brutto19, brutto7, brutto0, nettoAmount, grossAmount, status, ocrStatus, ocrFields, telegramCaption, filename, createdAt`
- Transformations:
  - `date` TEXT → `date` DateTime
  - `email` → `submittedByEmail`
  - `amount` → `grossAmount`
  - `ocr_status` TEXT → `ocrStatus` OcrStatus enum
  - `ocr_fields` TEXT → `ocrFields` Json (parse JSON)
  - `status` TEXT ('confirmed', 'pending', etc.) → BillStatus enum
  - `motive` → `motiveLegacy` (kept for historical reference)
- FK: `project_id` → resolved

#### Step 8: BillImages
- SQLite: `id, bill_id, filename, file, sort_order, created_at`
- PG: `id, legacyId, billId, filename, filePath, sortOrder, createdAt`
- Transformations:
  - `file` → `filePath`
  - `sort_order` → `sortOrder`
  - `created_at` TEXT → `createdAt` DateTime
- FK: `bill_id` → `billIdMap.get(bill_id)`

#### Step 9: BillMotives
- SQLite: `id, bill_id, motive_id, percentage`
- PG: `id, legacyId, billId, motiveId, percentage`
- FKs: `bill_id`, `motive_id`

#### Step 10: BillCategories
- SQLite: `id, bill_id, category_id, percentage`
- PG: `id, legacyId, billId, categoryId, percentage`
- FKs: `bill_id`, `category_id`

#### Step 11: BudgetMatrix
- SQLite: `id, motive_id, category_id, amount, project_id`
- PG: `id, legacyId, projectId, motiveId, categoryId, amount`
- FKs: `project_id`, `motive_id`, `category_id`

#### Step 12: Vgeld
- SQLite: `id, date, amount, from_user, to_user, created_by, project_id`
- PG: `id, legacyId, projectId, date, amount, fromUser, toUser, createdBy, createdAt`
- Transformations:
  - `date` TEXT → `date` DateTime
  - `createdAt` = now (not in SQLite)
- FK: `project_id`

#### Step 13: EditLog
- SQLite: `id, timestamp, user, bill_id, changes, source, project_id`
- PG: `id, legacyId, projectId, timestamp, user, billId, changes, source`
- Transformations:
  - `timestamp` TEXT → `timestamp` DateTime
  - `changes` TEXT → `changes` Json (parse JSON)
- FKs: `project_id`, `bill_id` (nullable)

#### Step 14: ProjectSettings
- SQLite: `project_id, key, value`
- PG: Same structure (composite PK)
- FK: `project_id` → resolved

#### Step 15: OcrLog
- SQLite: `id, project_id, bill_id, timestamp, provider, status, fields_written, ai_response, error_detail`
- PG: `id, legacyId, projectId, billId, timestamp, provider, status, fieldsWritten, aiResponse, errorDetail`
- Transformations:
  - `timestamp` TEXT → `timestamp` DateTime
  - `fields_written` TEXT → `fieldsWritten` Json
  - `ai_response` TEXT → `aiResponse` Json
- FKs: `project_id` (nullable), `bill_id` (nullable)

#### Step 16: TelegramLinks
- SQLite: `id, project_id, telegram_user_id, user_email, linked_at`
- PG: `id, legacyId, projectId, telegramUserId, userEmail, linkedAt`
- Transformations:
  - `linked_at` TEXT → `linkedAt` DateTime
- FKs: `project_id`, `user_email` (resolved via email, not ID map)

#### Step 17: TelegramLinkCodes
- SQLite: `code, user_email, project_id, expires_at, created_at`
- PG: Same structure (code is PK)
- Transformations:
  - `expires_at` TEXT → `expiresAt` DateTime
  - `created_at` TEXT → `createdAt` DateTime
- FKs: `project_id`, `user_email`

#### Step 18: Notifications
- SQLite: `id, user_email, type, message, project_id, is_read, created_at`
- PG: `id, legacyId, userEmail, type, message, projectId, isRead, createdAt`
- Transformations:
  - `is_read` INTEGER (0/1) → `isRead` Boolean
  - `created_at` TEXT → `createdAt` DateTime
- FKs: `user_email`, `project_id` (nullable)

### 4. Data Type Helpers
```typescript
function toBoolean(value: number | null): boolean {
  return value === 1;
}

function toDateTime(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

function toJson(value: string | null): any {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function toDecimal(value: number | null): Decimal {
  return new Decimal(value ?? 0);
}
```

### 5. Idempotency Strategy
Each table uses Prisma `upsert`:
```typescript
await prisma.user.upsert({
  where: { legacyId: sqliteUser.id },
  update: { /* all fields */ },
  create: { 
    id: uuid(),
    legacyId: sqliteUser.id,
    /* all fields */
  },
});
```

### 6. Error Handling & Reporting
- Wrap each table migration in try/catch
- Continue on error (don't stop the whole migration)
- Collect error details per table
- Print summary at the end
- Exit code 1 if any errors occurred

### 7. NPM Script
Add to `nextjs/package.json`:
```json
"migrate:sqlite": "tsx scripts/migrate-sqlite-to-pg.ts"
```

### 8. Environment Variables
- `SQLITE_PATH` - Path to SQLite database (default: `../../data/vbudget.db`)
- `DATABASE_URL` - PostgreSQL connection string (required)

## Checklist

- [ ] Add `better-sqlite3` and `@types/better-sqlite3` to devDependencies
- [ ] Create migration script at `/nextjs/scripts/migrate-sqlite-to-pg.ts`
- [ ] Implement ID mapping for all tables
- [ ] Implement all 18 table migrations in correct order
- [ ] Handle all data type transformations (boolean, datetime, json)
- [ ] Use upsert for idempotency
- [ ] Add proper error handling with per-table reporting
- [ ] Add `npm run migrate:sqlite` script
- [ ] Print final summary with row counts
- [ ] Exit with code 1 on any errors
- [ ] Test the migration script
