# Roadmap: SetCash

## Milestones

- v1.0 Hardening - Phases 1-5 (in progress)
- v1.1 Onboarding Tour - Phases 6-8 (planned)

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

### v1.1 Onboarding Tour

**Milestone Goal:** Guide new users through SetCash's core features with a 6-step speech-bubble tooltip tour on first login (always for test/demo users).

- [ ] **Phase 6: Tour Infrastructure** - Database persistence, API endpoint, React context provider, and centralized step configuration
- [ ] **Phase 7: Tour UI Components** - Speech-bubble tooltip, spotlight overlay, navigation controls, and keyboard support
- [ ] **Phase 8: App Integration** - Wire tour into existing UI with data-tour attributes, auto-start logic, mobile adaptation, and theme support

## Phase Details

### Phase 6: Tour Infrastructure
**Goal**: The tour has a persistent backend, a React context for state management, and a single configuration file defining all 6 steps with their target selectors and content
**Depends on**: Phase 5 (previous milestone)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04
**Success Criteria** (what must be TRUE):
  1. User's tour completion state survives logout and login — the hasSeenTour flag is stored in the database and read on session load
  2. A POST to the tour completion API endpoint marks the current user's tour as seen and returns success — subsequent reads of tour state reflect the change
  3. A TourProvider React context is available to any component in the protected layout, exposing current step, step count, and navigation callbacks
  4. All 6 tour steps are defined in a single configuration file with target CSS selector, title, body text, and placement — adding or reordering a step requires editing only this file
**Plans**: 4 plans
Plans:
- [x] 06-01-PLAN.md — Add hasSeenTour to User model and wire through JWT/session pipeline
- [x] 06-02-PLAN.md — Create centralized tour step configuration (6 steps)
- [x] 06-03-PLAN.md — POST /api/tour/complete endpoint with rate limiting and client wrapper
- [x] 06-04-PLAN.md — TourProvider React context and protected layout mount

### Phase 7: Tour UI Components
**Goal**: Users see a polished, accessible speech-bubble tooltip tour with spotlight highlighting and full navigation controls
**Depends on**: Phase 6
**Requirements**: UI-01, UI-02, UI-03, UI-04
**Success Criteria** (what must be TRUE):
  1. A speech-bubble tooltip with a directional arrow is visually anchored to the target element and repositions correctly when the window is resized
  2. The target element is highlighted with a spotlight cutout while the rest of the page is dimmed by a semi-transparent overlay — clicking the overlay does not dismiss the tour
  3. The tooltip displays Next, Back, Skip, and Done buttons appropriate to the current step position (no Back on step 1, Done on last step instead of Next)
  4. Pressing Escape dismisses the tour, and left/right arrow keys navigate between steps — focus is trapped within the tooltip while it is open
**Plans**: 3 plans
Plans:
- [x] 07-01-PLAN.md — TourOverlay: SVG mask spotlight overlay with cutout
- [x] 07-02-PLAN.md — TourTooltip: Speech-bubble tooltip with arrow and navigation controls
- [x] 07-03-PLAN.md — TourController: Orchestrator with positioning, keyboard, and barrel export
**UI hint**: yes

### Phase 8: App Integration
**Goal**: The tour is wired into the live application, starts automatically for the right users, works on all viewports, and respects the current theme
**Depends on**: Phase 7
**Requirements**: INTG-01, INTG-02, INTG-03, INTG-04
**Success Criteria** (what must be TRUE):
  1. Every UI element targeted by a tour step has a data-tour attribute matching the step configuration — the tour can locate and anchor to each target without fragile class or ID selectors
  2. A new user logging in for the first time sees the tour start automatically without any manual trigger — a demo/test user sees the tour on every login regardless of the hasSeenTour flag
  3. On mobile viewports (below 1024px, matching the Tailwind `lg:` breakpoint used by the sidebar), tour steps that target elements not visible or not meaningful on mobile are either skipped or repositioned — the tour completes without broken positioning or invisible targets
  4. Tour tooltip background, text color, arrow color, and overlay opacity match the active theme (light or dark) — switching themes mid-tour updates the tooltip appearance
**Plans**: 3 plans
Plans:
- [ ] 08-01-PLAN.md — Attach data-tour attributes to the 6 target host components (Sidebar/Header/ProjectSwitcher/QuickActions/RecentBillsList/DashboardClient)
- [ ] 08-02-PLAN.md — Tour runtime adaptation (auto-start gating, viewport-aware target resolution, retry+skip-forward, budget-matrix copy update)
- [ ] 08-03-PLAN.md — Requirements drift correction (INTG-03 → 1024px) and theme verification checklist + human verify checkpoint
**UI hint**: yes

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
| 6. Tour Infrastructure | v1.1 | 4/4 | Complete | - |
| 7. Tour UI Components | v1.1 | 0/3 | Planning complete | - |
| 8. App Integration | v1.1 | 0/3 | Planning complete | - |
