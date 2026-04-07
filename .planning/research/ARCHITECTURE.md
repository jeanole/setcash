# Architecture Patterns — Hardening Build Order

**Project:** SetCash Hardening Milestone
**Researched:** 2026-04-01
**Confidence:** HIGH (based on direct codebase audit, no inference required)

---

## System Layers

This is a monolithic Next.js 14 App Router application. The layers are well-defined:

```
Browser
  └── Edge Middleware (nextjs/middleware.ts)         — JWT gate, no DB
        └── Server Components (app/(protected)/)    — SSR shells
              └── Client Components (components/)   — interactive UI
                    └── API Routes (app/api/)        — REST handlers
                          └── Shared Lib (lib/)      — business logic
                                └── Prisma → PostgreSQL
```

### Component Boundaries

| Component | Responsibility | Talks To |
|-----------|---------------|---------|
| `middleware.ts` | JWT presence check, redirect to login | `auth.config.ts` (edge-safe, no Prisma) |
| `app/(protected)/layout.tsx` | Server-side auth verification, session hydration | `auth.ts` (full Prisma config) |
| `app/api/bills/route.ts` | Bill creation: parse form, create DB record, move files, allocations, edit log | `auth.ts`, `lib/db.ts`, `lib/upload.ts`, `lib/notifications.ts` |
| `app/api/bills/[id]/route.ts` | Bill read/update/delete with ownership check | `auth.ts`, `lib/db.ts` |
| `app/api/uploads/[[...path]]/route.ts` | Authenticated file serving with project scoping | `auth.ts`, `lib/db.ts`, local filesystem |
| `lib/bills.ts` | (does not exist yet) Target location for extracted shared helpers | — |
| `lib/upload.ts` | Multipart parsing (formidable), file path helpers, UPLOADS_DIR constant | Filesystem |
| `lib/ratelimit.ts` | Named rate limiters (Upstash Redis + in-memory fallback) | — |
| `lib/notifications.ts` | Project-scoped notification creation | `lib/db.ts` |
| `auth.ts` | Full NextAuth config (Prisma, bcrypt, JWT callbacks) | `lib/db.ts` |
| `auth.config.ts` | Edge-compatible NextAuth config (no Prisma, no bcrypt) | — |

---

## Data Flow

### Bill Creation Flow (current — fragile)

```
POST /api/bills
  1. auth()                              — verify JWT
  2. billCreateLimiter.check()           — rate limit
  3. parseForm()                         — formidable multipart parse
  4. $transaction(Serializable)          — calculateBillNumber + bill.create  <- TRANSACTION ENDS HERE
  5. fs.renameSync() x N                 — move temp files to uploads/
  6. prisma.billImage.create() x N       — image records (OUTSIDE transaction)
  7. syncLegacyImageColumns()            — update bill.filename (OUTSIDE transaction)
  8. saveAllocations()                   — N+1 create() calls (OUTSIDE transaction)
  9. getMotiveDisplayString()            — reread allocations for display string
  10. prisma.bill.update(motiveLegacy)   — update denorm field (OUTSIDE transaction)
  11. prisma.editLog.create()            — audit log (OUTSIDE transaction)
  12. return { ok, id }
```

Steps 5-11 are outside the transaction. A failure at any of those steps leaves a bill record
with no images, no allocations, and no audit log.

### File Serving Flow (current — path traversal risk)

```
GET /api/uploads/[...path]
  1. auth()                              — verify JWT
  2. prisma.billImage.findFirst(relPath) — primary lookup
  3. prisma.bill.findFirst(filename)     — fallback legacy lookup (looser)
  4. check session.user.currentProjectId === targetProjectId
  5. path.join(UPLOADS_DIR, relPath)     — NO guard: resolved path not verified
  6. fs.readFileSync(filePath)           — entire file into memory (blocking)
  7. return new NextResponse(buffer)
```

The legacy fallback at step 3 accepts arbitrary relPath values matched against bill.filename.
The resolved path at step 5 is never verified to stay under UPLOADS_DIR.

### Role Check Flow (current — stale JWT risk)

```
PUT /api/bills/[id]
  1. auth()                              — reads JWT from cookie
  2. session.user.role check             — reads role EMBEDDED IN JWT (set at sign-in)
  3. business logic proceeds
```

session.user.role is the role stored in the JWT at sign-in. If a user's project role changed
after that, the stale JWT still grants or denies access incorrectly until rotation.

---

## Hardening Component Boundaries

Each concern is isolated to a specific layer. These boundaries define what can change without
touching anything else.

### 1. Shared Bill Helpers (lib/bills.ts)

What: Extract saveAllocations, syncLegacyImageColumns, getMotiveDisplayString from both bill
route files into a single shared module.

Boundary: Only app/api/bills/route.ts and app/api/bills/[id]/route.ts need import changes.
No other file is affected.

Constraint: The extracted functions must accept a Prisma transaction client (tx) as a
parameter so they can be called from inside $transaction(). Current functions close over the
module-level prisma import. Signature change is required.

N+1 fix lives here: When extracting, replace the for loop of prisma.billMotive.create() calls
with prisma.billMotive.createMany({ data: [...] }). Same for billCategory. This is safe
because createMany on PostgreSQL is atomic and returns a count (not the created records),
which the current code does not use.

### 2. Transaction Scope Expansion (app/api/bills/route.ts)

What: Move prisma.billImage.create() records, syncLegacyImageColumns(), saveAllocations(),
getMotiveDisplayString() update, and prisma.editLog.create() inside the existing
$transaction() block.

Boundary: Changes are confined entirely to app/api/bills/route.ts. No schema changes.
No interface changes to callers.

Constraint: fs.renameSync() (the actual file move from temp to uploads directory) cannot be
inside a DB transaction. The correct pattern is:
- Move the file first (before the transaction), using a temp-to-staging path
- If the transaction fails, clean up the staged file
- This is an at-least-once compensation pattern, not strict atomicity

Dependency: Requires the shared helper extraction (1) first, because the extracted functions
must accept a transaction client parameter.

### 3. Path Traversal Guard (app/api/uploads/[[...path]]/route.ts)

What: After constructing filePath = path.join(UPLOADS_DIR, relPath), add a guard to confirm
the resolved path starts with UPLOADS_DIR.

Boundary: One file, four lines of code. No schema or interface changes. The existing
bug-reports/screenshots/[filename]/route.ts already does this correctly and is the
reference pattern.

Dependency: None. This is a standalone, safe-to-do-first change.

### 4. Stale JWT Role Re-verification

What: On critical write operations (DELETE bill, status transitions, admin-only endpoints),
re-fetch the user's current ProjectMember.role from the database instead of reading
session.user.role (JWT-embedded).

Where this is needed:
- PUT /api/bills/[id] line 297 — isAdmin check uses session.user.role
- DELETE /api/bills/[id] line 475 — same pattern
- Any status transition endpoint (submitted to approved, approved to rejected)

Boundary: Each affected route file adds one prisma.projectMember.findUnique() call after
auth(). No schema changes. No shared code needed.

Dependency: None. Independent of all other work.

### 5. Integration Tests (__tests__/api/)

What: Add tests for: bill CRUD, authorization (403 when not owner or admin), allocation math,
stale-role edge case.

Existing infrastructure:
- createTestContext() / cleanupTestContext() in __tests__/helpers.ts
- makeSession() — builds mock NextAuth session
- jest.mock('@/auth') + mockAuth.mockResolvedValueOnce() — established pattern
- jest.config.ts — real database, 30-second timeout, ts-jest with ESM transformation

The test pattern from categories.test.ts is the template:
  1. Import the route handler function directly
  2. Mock auth at module level
  3. Seed test data via Prisma in beforeAll, clean in afterAll
  4. Call handler with new Request(url), assert on res.status and res.json()

Gap: Bill creation tests require multipart FormData, not JSON. parseForm() uses formidable
which needs a Readable stream mock. This is the only complexity above the categories pattern.

Dependency: Integration tests for bill creation should follow helper extraction, not precede
it. Testing the fragile path and then refactoring means rewriting tests.

### 6. Legacy Column Removal (prisma/schema.prisma)

What: Remove legacyId from 15+ models, and motiveLegacy from Bill.

Two-phase approach required:

Phase A (safe): Confirm motiveLegacy is the only remaining reader/writer. Currently written
in POST /api/bills and PUT /api/bills/[id], and read in Google Sheets export. After
saveAllocations is extracted and lib/bills.ts has getMotiveDisplayString, replace the Sheets
export read with a fresh join on BillMotive.

Phase B (destructive): After Phase A is live and verified, add a Prisma migration to drop the
columns. This requires a git grep motiveLegacy and git grep legacyId scan across all
non-migration files before the migration runs.

Dependency: Phase A requires lib/bills.ts extraction (1) to be complete.

### 7. Dependency Cleanup (package.json)

What: Move @types/* packages from dependencies to devDependencies. Remove better-sqlite3
and @types/better-sqlite3. Pin next-auth to exact version.

Boundary: package.json only. No code changes. Requires npm install after change.

Dependency: None. Safe to do independently, but do last to avoid disrupting active work.

---

## Suggested Build Order

The dependency graph drives this order. Items with no dependencies can be parallelized.

```
Phase 1 (no dependencies — do in parallel):
  - Path traversal guard         4 lines, zero risk
  - Stale JWT re-verification    additive DB read in critical routes
  - Dependency cleanup           package.json only

Phase 2 (after Phase 1):
  - Extract lib/bills.ts         shared helpers, tx-client parameter

Phase 3 (after Phase 2):
  - Expand transaction scope     wrap post-creation steps in tx
  - Integration tests            bill CRUD + auth edge cases

Phase 4 (after Phase 3):
  - Legacy column removal        confirm no readers, then migrate
```

Rationale:

Path traversal and stale JWT are security fixes. They are independent and low-risk and should
be done before structural refactoring creates merge complexity.

Helper extraction must precede transaction expansion because the helpers must accept a
transaction client parameter. Doing transaction expansion against the current duplicated code
would require applying the change twice and would make the duplication worse.

Integration tests for bill creation should follow the extraction. Testing the current fragile
path and then refactoring means rewriting the tests.

Legacy column removal is last because it is irreversible and depends on confirming the
extracted motiveLegacy write path has been fully replaced by the BillMotive join.

---

## Patterns to Follow

### Pattern: Extracted Helper Accepting Transaction Client

```typescript
// lib/bills.ts
import { Prisma } from '@prisma/client';

type TxClient = Prisma.TransactionClient;

export async function saveAllocations(
  tx: TxClient,
  billId: string,
  motiveAllocations: { motiveId: string; percentage: number }[],
  categoryAllocations: { categoryId: string; percentage: number }[],
  projectId: string
): Promise<void> {
  await tx.billMotive.deleteMany({ where: { billId } });
  await tx.billCategory.deleteMany({ where: { billId } });

  const [uncatMotive, uncatCategory] = await Promise.all([
    tx.motive.findFirst({ where: { name: 'Default', projectId } }),
    tx.category.findFirst({ where: { name: 'Uncategorized', projectId } }),
  ]);

  const motiveRows = buildRows(motiveAllocations, uncatMotive?.id);
  const categoryRows = buildRows(categoryAllocations, uncatCategory?.id);

  await Promise.all([
    tx.billMotive.createMany({ data: motiveRows.map(r => ({ ...r, billId })) }),
    tx.billCategory.createMany({ data: categoryRows.map(r => ({ ...r, billId })) }),
  ]);
}
```

### Pattern: Path Traversal Guard

```typescript
const filePath = path.join(UPLOADS_DIR, relPath);
const resolvedPath = path.resolve(filePath);
const resolvedBase = path.resolve(UPLOADS_DIR);
if (!resolvedPath.startsWith(resolvedBase + path.sep)) {
  return new NextResponse('Forbidden', { status: 403 });
}
```

Reference: nextjs/app/api/bug-reports/screenshots/[filename]/route.ts lines 33-38.

### Pattern: DB Role Re-verification

```typescript
// After auth(), for critical write operations only:
const membership = session.user.role !== 'superadmin'
  ? await prisma.projectMember.findUnique({
      where: { projectId_userEmail: { projectId, userEmail: session.user.email } },
      select: { role: true },
    })
  : null;

const isAdmin = membership?.role === 'admin'
  || membership?.role === 'owner'
  || session.user.role === 'superadmin'; // superadmin has no membership row
```

### Pattern: Integration Test for API Route

```typescript
// __tests__/api/bills.test.ts
import { auth } from '@/auth';
import { POST } from '@/app/api/bills/route';
import { createTestContext, cleanupTestContext, makeSession, TestContext } from '../helpers';

jest.mock('@/auth');
const mockAuth = auth as jest.MockedFunction<typeof auth>;

describe('POST /api/bills', () => {
  let ctx: TestContext;
  beforeAll(async () => { ctx = await createTestContext(); });
  afterAll(async () => { await cleanupTestContext(ctx); });

  it('should return 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce(null);
    const req = new Request('http://localhost/api/bills', { method: 'POST' });
    const res = await POST(req as never);
    expect(res.status).toBe(401);
  });
});
```

---

## Anti-Patterns to Avoid

### Anti-Pattern: Expanding Transaction Without Extracting First

Starting the transaction expansion before extracting to lib/bills.ts means saveAllocations
still closes over the module-level prisma client, not the transaction client tx. The code
appears to work but silently bypasses transaction isolation — allocations write to the real
DB even if the transaction rolls back.

Detection: If saveAllocations(billId, ...) receives no tx parameter, it is using the
module-level prisma client.

### Anti-Pattern: Testing Against Fragile Code Then Refactoring

Writing bill creation tests against the current un-extracted, non-transactional flow means
the tests encode the buggy behavior. When the transaction is expanded, the tests pass for
the wrong reasons. Write tests against the refactored code.

### Anti-Pattern: Dropping Legacy Columns Without Confirming All Readers

motiveLegacy is read in the Google Sheets export code path. Dropping the column before
replacing that read with a join causes a runtime error on the export endpoint. A full
git grep is required before the migration.

### Anti-Pattern: Re-verifying Role on Every Route

Only critical, irreversible operations need a DB role re-check: DELETE, status transitions,
admin-only writes. GET endpoints do not need it. Over-applying adds unnecessary DB load.

---

*Source: direct codebase audit — app/api/bills/route.ts, app/api/bills/[id]/route.ts,
app/api/uploads/[[...path]]/route.ts, __tests__/, jest.config.ts, .planning/codebase/CONCERNS.md,
.planning/codebase/ARCHITECTURE.md*
