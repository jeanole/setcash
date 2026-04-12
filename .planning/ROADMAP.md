# Roadmap: SetCash

## Milestones

- v1.0 Hardening - Phases 1-5 (in progress)
- v1.1 Onboarding Tour - Phases 6-8 (shipped 2026-04-12)

## Phases

<details>
<summary>v1.0 Hardening (Phases 1-5) — in progress</summary>

- [ ] **Phase 1: Security and Dependency Baseline** - Eliminate path traversal, stale JWT roles, and dirty dependencies before any structural changes
- [ ] **Phase 2: Bug Triage and Fixes** - Triage all 45+ tracked bug reports, fix reproducible ones, close stale/duplicate ones
- [ ] **Phase 3: Shared Helper Extraction** - Extract duplicated bill helpers to lib/bills.ts and replace N+1 allocation writes with batch operations
- [ ] **Phase 4: Data Correctness and Test Coverage** - Wrap bill creation in a transaction, replace synchronous I/O, stream file responses, clean up expired tokens, and write integration tests
- [ ] **Phase 5: Legacy Column Removal** - Remove legacyId and motiveLegacy columns after confirming no external consumers remain

### Phase 1: Security and Dependency Baseline
**Goal**: Known security vulnerabilities are closed and the dependency tree is clean before any structural refactoring begins
**Depends on**: Nothing (first phase)
**Requirements**: SEC-01, SEC-02, SEC-03, SEC-04, QUAL-04, QUAL-05
**Success Criteria** (what must be TRUE):
  1. A request to any file-serving endpoint with a path containing ../ is rejected with a 400 or 403 — the resolved path is verified to stay within the allowed uploads directory
  2. Admin actions (bill status change, delete) re-fetch the user role from the database on every request — a demoted user whose JWT still carries admin role cannot perform those actions
  3. The next-auth version in package.json is pinned to exactly 5.0.0-beta.30 with no caret or tilde, and npm install does not resolve a different version
  4. A cross-origin POST request to any mutation endpoint is rejected — the Origin header is validated against the app domain
  5. npm ls shows no @types/* package in production dependencies and better-sqlite3 is absent from package.json entirely
**Plans**: 3 plans
Plans:
- [ ] 01-01-PLAN.md -- Path traversal guard (assertPathWithin helper + patch all file-serving routes)
- [ ] 01-02-PLAN.md -- Admin role re-fetch (verifyAdminRole helper + patch critical write routes)
- [ ] 01-03-PLAN.md -- Origin validation + dependency cleanup (middleware Origin check, pin next-auth, clean deps)

### Phase 2: Bug Triage and Fixes
**Goal**: The backlog of 45+ tracked bug reports has a known, accurate status and every reproducible bug is fixed
**Depends on**: Phase 1
**Requirements**: BUGS-01, BUGS-02, BUGS-03
**Success Criteria** (what must be TRUE):
  1. Every BUG-*.md file in features/ has a status of Fixed, Stale, or Duplicate — none remain in unknown or unreviewed state
  2. Every bug classified as reproducible has a corresponding fix committed and the feature spec status updated to Fixed
  3. Every bug classified as stale or duplicate is closed with a note explaining the classification in features/INDEX.md
  4. No regression is introduced — existing passing tests continue to pass after bug fixes are applied
**Plans**: TBD

### Phase 3: Shared Helper Extraction
**Goal**: Duplicated bill logic lives in exactly one place, helpers accept a Prisma TransactionClient, and N+1 allocation writes are replaced with batch operations
**Depends on**: Phase 2
**Requirements**: QUAL-01, QUAL-02
**Success Criteria** (what must be TRUE):
  1. A lib/bills.ts module exists and exports saveAllocations, syncLegacyImageColumns, and getMotiveDisplayString — both bill route files import these from the shared module with no local copies remaining
  2. saveAllocations accepts a Prisma TransactionClient parameter, enabling callers inside a $transaction() block to pass the transaction client
  3. Bill motive and category records are written using prisma.billMotive.createMany() and prisma.billCategory.createMany() — a bill with 10 allocations produces exactly 2 database write operations, not 10-20
  4. All existing bill create and update flows produce identical results before and after extraction — no behavior change is introduced
**Plans**: TBD

### Phase 4: Data Correctness and Test Coverage
**Goal**: Bill creation is atomic, file I/O is non-blocking, file responses are streamed, expired tokens are cleaned up automatically, and critical paths have integration test coverage
**Depends on**: Phase 3
**Requirements**: QUAL-03, QUAL-07, DATA-01, DATA-02, TEST-01, TEST-02, TEST-03, TEST-04, TEST-05
**Success Criteria** (what must be TRUE):
  1. If bill creation fails after the bill row is inserted (e.g., allocation write error), no orphaned bill record remains in the database — the transaction rolls back completely
  2. All readFileSync, renameSync, unlinkSync, and existsSync calls in request handlers are replaced with fs.promises equivalents — no synchronous file I/O executes in the event loop during a request
  3. File download responses use ReadableStream wrapping fs.createReadStream() — the server does not load entire file contents into memory before sending
  4. Expired PasswordResetToken, EmailVerificationToken, and TelegramLinkCode records are deleted automatically on a schedule — the token tables do not grow unboundedly
  5. npm test runs integration tests covering bill create/update/delete, status transitions, auth guards (401/403), allocation math, and budget matrix calculations — all tests pass against the real database
**Plans**: TBD

### Phase 5: Legacy Column Removal
**Goal**: The legacyId and motiveLegacy columns are removed from the database schema after all consumers are migrated and an external consumer audit confirms no readers remain
**Depends on**: Phase 4
**Requirements**: QUAL-06
**Success Criteria** (what must be TRUE):
  1. A git grep legacyId and git grep motiveLegacy across all non-migration source files returns zero matches — no application code references these columns
  2. Google Sheets sync, Telegram bot, and any other integration reads bill data using normalized joins (BillMotive) rather than the legacy denormalized columns
  3. The Prisma schema contains no legacyId or motiveLegacy fields and the corresponding database migration has been applied successfully
  4. Integration tests written in Phase 4 pass without modification after the columns are dropped — no test was relying on legacy column data
**Plans**: TBD

</details>

<details>
<summary>v1.1 Onboarding Tour (Phases 6-8) — SHIPPED 2026-04-12</summary>

- [x] Phase 6: Tour Infrastructure (4/4 plans)
- [x] Phase 7: Tour UI Components (3/3 plans)
- [x] Phase 8: App Integration (3/3 plans)

See [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md) for full details.

</details>

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Security and Dependency Baseline | v1.0 | 0/3 | Planning complete | - |
| 2. Bug Triage and Fixes | v1.0 | 0/TBD | Not started | - |
| 3. Shared Helper Extraction | v1.0 | 0/TBD | Not started | - |
| 4. Data Correctness and Test Coverage | v1.0 | 0/TBD | Not started | - |
| 5. Legacy Column Removal | v1.0 | 0/TBD | Not started | - |
| 6. Tour Infrastructure | v1.1 | 4/4 | Complete | 2026-04-09 |
| 7. Tour UI Components | v1.1 | 3/3 | Complete | 2026-04-10 |
| 8. App Integration | v1.1 | 3/3 | Complete | 2026-04-12 |
