# Requirements: SetCash Hardening

**Defined:** 2026-04-01
**Core Value:** Every bill submission, approval, and budget calculation must be correct, secure, and reliable — financial data tolerates zero silent failures.

## v1 Requirements

### Security

- [ ] **SEC-01**: All file-serving endpoints reject path traversal attempts (resolve path, verify it stays under allowed directory)
- [ ] **SEC-02**: Critical write operations (bill status change, delete, admin actions) re-fetch user role from database instead of trusting JWT-embedded role
- [ ] **SEC-03**: next-auth pinned to exact version `5.0.0-beta.30` (no caret) to prevent silent beta upgrades
- [ ] **SEC-04**: All mutation endpoints (POST/PUT/DELETE) validate Origin header matches app domain and reject cross-origin requests

### Code Quality

- [ ] **QUAL-01**: Duplicated bill helpers (saveAllocations, syncLegacyImageColumns, getMotiveDisplayString) extracted to shared `lib/bills.ts` module
- [ ] **QUAL-02**: N+1 sequential allocation writes replaced with `prisma.billMotive.createMany()` and `prisma.billCategory.createMany()`
- [ ] **QUAL-03**: All synchronous file I/O (readFileSync, renameSync, unlinkSync, existsSync) replaced with async equivalents across all request handlers
- [ ] **QUAL-04**: `@types/*` packages moved from dependencies to devDependencies
- [ ] **QUAL-05**: `better-sqlite3` and `@types/better-sqlite3` removed from package.json; migration script archived
- [ ] **QUAL-06**: Legacy columns (legacyId on 15+ models, motiveLegacy on Bill) removed via Prisma migration after consumer audit confirms no external readers
- [ ] **QUAL-07**: File responses streamed via `ReadableStream` wrapping `fs.createReadStream()` instead of loading entire files into memory

### Data Correctness

- [ ] **DATA-01**: Bill creation post-steps (image records, allocations, motive display update, edit log) execute inside the existing Prisma serializable transaction, with compensating cleanup for file moves on error
- [ ] **DATA-02**: Expired PasswordResetToken, EmailVerificationToken, and TelegramLinkCode records automatically cleaned up on a schedule

### Bug Fixes

- [ ] **BUGS-01**: All 45+ tracked bug reports in `features/BUG-*.md` triaged — each classified as fixed, reproducible, stale, or duplicate
- [ ] **BUGS-02**: All reproducible bugs fixed and verified
- [ ] **BUGS-03**: Stale and duplicate bug reports closed with status update in `features/INDEX.md`

### Testing

- [ ] **TEST-01**: Integration tests cover bill create, update, and delete lifecycle with real database
- [ ] **TEST-02**: Integration tests cover bill status transitions (draft → submitted → approved/rejected)
- [ ] **TEST-03**: Integration tests verify auth guards (unauthenticated → 401, wrong role → 403)
- [ ] **TEST-04**: Integration tests verify allocation math (motive + category percentages sum correctly)
- [ ] **TEST-05**: Integration tests verify budget matrix calculations

## v2 Requirements

### Security Hardening

- **SEC-V2-01**: Rate limiting on authentication endpoints (login, password reset, email verification)
- **SEC-V2-02**: Content-Security-Policy header with nonce-based approach for Next.js
- **SEC-V2-03**: Idempotency keys on bill create and VGeld transfer to prevent duplicates

### Reliability

- **REL-V2-01**: Analytics table retention automation (scheduled prune for VisitLog/PageEvent)
- **REL-V2-02**: Sentry error tracking integration for production monitoring

### Scaling

- **SCALE-V2-01**: Migrate file storage from local filesystem to object storage (S3/GCS)
- **SCALE-V2-02**: Extract Telegram bot to separate worker process or webhook mode

## Out of Scope

| Feature | Reason |
|---------|--------|
| New UI features or enhancements | Hardening milestone only — no new functionality |
| E2E browser tests (Playwright/Cypress) | Write integration tests first; E2E adds value once API layer is trusted |
| CSRF token implementation | Origin header validation (SEC-04) + SameSite cookies is sufficient |
| next-auth upgrade to stable v5 | Pin current beta first; upgrade in separate milestone after test coverage exists |
| Formidable rewrite | Mock-stream workaround is fragile but functional; document and defer |
| Database backup automation | Ops concern, not application code |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| (populated during roadmap creation) | | |

**Coverage:**
- v1 requirements: 19 total
- Mapped to phases: 0
- Unmapped: 19 ⚠️

---
*Requirements defined: 2026-04-01*
*Last updated: 2026-04-01 after initial definition*
