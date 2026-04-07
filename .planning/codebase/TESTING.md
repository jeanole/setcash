# Testing Patterns

**Analysis Date:** 2026-04-01

## Test Framework

**Runner:**
- Jest 29.7 with ts-jest for TypeScript transformation
- Config: `nextjs/jest.config.js`

**Assertion Library:**
- Jest built-in (`expect`, `toBe`, `toEqual`, `toHaveLength`, etc.)

**Run Commands:**
```bash
cd nextjs
npm run test              # Run all tests
npm run test:watch        # Watch mode
npx jest --coverage       # Coverage (no dedicated script)
```

**Test Timeout:** 30000ms (30 seconds) -- configured globally for DB-backed tests

## Test File Organization

**Location:**
- All tests in `nextjs/__tests__/` directory (separate from source, not co-located)
- Mirrors source structure: `__tests__/api/` for API route tests, `__tests__/lib/` for library tests

**Naming:**
- `{module}.test.ts` pattern (e.g., `categories.test.ts`, `ratelimit.test.ts`)

**Structure:**
```
nextjs/__tests__/
  api/
    categories.test.ts     # Tests for nextjs/app/api/categories/route.ts
    health.test.ts         # Tests for nextjs/app/api/health/route.ts
    motives.test.ts        # Tests for nextjs/app/api/motives/route.ts
  lib/
    ratelimit.test.ts      # Tests for nextjs/lib/ratelimit.ts
  helpers.ts               # Shared test utilities (context factory, mock session)
  smoke.test.ts            # Basic infrastructure smoke test
```

## Test Infrastructure

**Global Setup:** `nextjs/jest.global-setup.js`
- Loads environment variables from `.env.test` via `@next/env`
- Runs before any test file

**Setup After Env:** `nextjs/jest.setup.ts`
- Disconnects Prisma client in `afterAll` to prevent connection leaks
- Lazy-requires `@/lib/db` so non-DB tests skip connection

**Module Resolution:**
- `@/*` alias mapped to `<rootDir>/*` in `jest.config.js`
- ESM packages (next-auth, jose, etc.) transformed via `transformIgnorePatterns` exception

**Environment:** `node` (not jsdom -- these are backend/API tests)

## Test Helpers

**File:** `nextjs/__tests__/helpers.ts`

**TestContext Factory:**
```typescript
import { createTestContext, cleanupTestContext, makeSession, TestContext } from '../helpers';

// Creates isolated user + project + membership in test DB
let ctx: TestContext;
beforeAll(async () => { ctx = await createTestContext(); });
afterAll(async () => { await cleanupTestContext(ctx); });
```

**`TestContext` interface:**
```typescript
interface TestContext {
  userId: string;
  userEmail: string;
  projectId: string;
}
```

**`makeSession(ctx, role?)`** -- builds mock NextAuth session:
```typescript
makeSession(ctx)             // role defaults to 'user'
makeSession(ctx, 'admin')   // override role
```

**`jsonRequest(url, method, body)`** -- builds Request for route handlers:
```typescript
const req = jsonRequest('http://localhost/api/bills', 'POST', { vendor: 'Test' });
```

## Test Structure

**Suite Organization:**
```typescript
import { auth } from '@/auth';
import { GET } from '@/app/api/categories/route';
import { db } from '@/lib/db';
import { createTestContext, cleanupTestContext, makeSession, TestContext } from '../helpers';

jest.mock('@/auth');
const mockAuth = auth as jest.MockedFunction<typeof auth>;

describe('GET /api/categories', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  afterAll(async () => {
    await cleanupTestContext(ctx);
  });

  it('should return 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce(null);
    const req = new Request('http://localhost/api/categories');
    const res = await GET(req as never);
    expect(res.status).toBe(401);
  });

  it('should return categories for the current project', async () => {
    const cat = await db.category.create({
      data: { name: 'Travel', projectId: ctx.projectId, budget: 1000 },
    });
    mockAuth.mockResolvedValueOnce(makeSession(ctx) as never);
    const req = new Request('http://localhost/api/categories');
    const res = await GET(req as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.some((c: { id: string }) => c.id === cat.id)).toBe(true);
    // Cleanup seeded data
    await db.category.delete({ where: { id: cat.id } });
  });
});
```

## Mocking

**Framework:** Jest built-in (`jest.mock`, `jest.fn`)

**Auth Mocking (primary pattern):**
```typescript
jest.mock('@/auth');
const mockAuth = auth as jest.MockedFunction<typeof auth>;

// Per-test session control:
mockAuth.mockResolvedValueOnce(null);                    // unauthenticated
mockAuth.mockResolvedValueOnce(makeSession(ctx) as never);  // authenticated
```

**What to Mock:**
- `@/auth` (NextAuth `auth()` function) -- always mocked in API tests
- Session returned with `mockResolvedValueOnce` per test for isolation

**What NOT to Mock:**
- Database (`@/lib/db`) -- tests use a real test database
- Route handlers -- imported and called directly as functions
- Prisma client -- real queries against `.env.test` database

**Environment Mocking (for lib tests):**
```typescript
// Clear env vars before module load to test fallback behavior
beforeAll(() => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});
afterAll(() => {
  // Restore original values
});
```

## Test Data Management

**Creation:** Tests seed their own data via Prisma within `beforeAll` or individual tests
**Cleanup:** Manual cleanup in `afterAll` (via `cleanupTestContext`) or inline after assertions
**Isolation:** Each test suite creates a unique user/project with random suffix to avoid collisions:
```typescript
const suffix = Math.random().toString(36).slice(2, 8);
const userEmail = `test-${suffix}@example.com`;
```

**Cascade Behavior:** Deleting the project cascades to members/bills/categories/motives (DB FK constraints)

## Test Types Present

**Integration Tests (API route tests):**
- `nextjs/__tests__/api/categories.test.ts` -- GET /api/categories
- `nextjs/__tests__/api/health.test.ts` -- GET /api/health
- `nextjs/__tests__/api/motives.test.ts` -- GET /api/motives
- Pattern: Import route handler, create Request, assert Response status + body
- Use real database, mock only auth session

**Unit Tests:**
- `nextjs/__tests__/lib/ratelimit.test.ts` -- in-memory rate limiter behavior
- Tests pure logic without DB; manipulates env vars to control module behavior

**Smoke Test:**
- `nextjs/__tests__/smoke.test.ts` -- verifies Jest infrastructure runs (`1 + 1 === 2`)

**E2E Tests:**
- Not present. No Playwright, Cypress, or similar framework configured.

## Common Test Patterns

**Auth Testing:**
```typescript
it('should return 401 when not authenticated', async () => {
  mockAuth.mockResolvedValueOnce(null);
  const req = new Request('http://localhost/api/endpoint');
  const res = await GET(req as never);
  expect(res.status).toBe(401);
});
```

**Project Isolation Testing:**
```typescript
it('should not return data from another project', async () => {
  const otherProject = await db.project.create({ data: { name: 'Other' } });
  const item = await db.motive.create({
    data: { name: 'Hidden', projectId: otherProject.id, budget: 0 },
  });
  mockAuth.mockResolvedValueOnce(makeSession(ctx) as never);
  const res = await GET(req as never);
  const body = await res.json();
  expect(body.some((m: { id: string }) => m.id === item.id)).toBe(false);
  await db.project.delete({ where: { id: otherProject.id } });
});
```

**Rate Limit Testing:**
```typescript
it('should block requests that exceed the limit', async () => {
  const id = `burst-test-${Date.now()}`;
  const results = await Promise.all(
    Array.from({ length: 11 }, () => limiter.limit(id))
  );
  const blocked = results.filter(r => !r.success);
  expect(blocked.length).toBeGreaterThanOrEqual(1);
});
```

## Coverage

**Requirements:** No enforced coverage threshold
**Current state:** Minimal -- only 3 API routes and 1 library module have tests

## Test Coverage Gaps

**Untested API Routes (high priority):**
- `nextjs/app/api/bills/route.ts` -- core CRUD for bills (most complex route)
- `nextjs/app/api/bills/[id]/route.ts` -- single bill GET/PUT/DELETE
- `nextjs/app/api/users/route.ts` -- user management
- `nextjs/app/api/projects/route.ts` -- project management
- `nextjs/app/api/notifications/route.ts` -- notification endpoints
- `nextjs/app/api/budget-matrix/route.ts` -- budget matrix data
- `nextjs/app/api/superadmin/` -- all superadmin endpoints
- `nextjs/app/api/reports/` -- report generation

**Untested Libraries:**
- `nextjs/lib/utils.ts` -- utility functions (formatCurrency, calculateBillNumber, etc.)
- `nextjs/lib/notifications.ts` -- notification helpers
- `nextjs/lib/upload.ts` -- file upload handling
- `nextjs/lib/google.ts` -- Google Sheets/Drive integration
- `nextjs/lib/email.ts` -- email sending
- `nextjs/lib/ocr.ts` -- OCR processing

**No Component Tests:**
- No React component tests exist (no jsdom environment, no React Testing Library)
- All components in `nextjs/components/` are untested

**No E2E Tests:**
- No browser-based testing framework configured

## Docker Test Environment

A `nextjs/Dockerfile.test` exists for running tests in CI with a real database.

## How to Add New Tests

1. Create test file in `nextjs/__tests__/` mirroring source path
2. For API tests:
   - Import the route handler directly
   - Mock `@/auth` with `jest.mock`
   - Use `createTestContext()` for DB setup
   - Use `cleanupTestContext()` in `afterAll`
   - Test auth (401), missing project (400), forbidden (403), and happy path
3. For library tests:
   - Import the module under test
   - Mock external deps if needed (env vars, services)
4. Always clean up seeded test data

---

*Testing analysis: 2026-04-01*
