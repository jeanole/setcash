# PROJ-13: Production Cutover

## Status: Planned
**Created:** 2026-03-01
**Last Updated:** 2026-03-01

## Dependencies
- Requires: PROJ-4 through PROJ-12 all deployed and QA-verified on `docker-compose.test.yml`

## User Stories
- As a developer, I want to swap `docker-compose.yml` to serve the Next.js app so that
  production users get the new stack.
- As a developer, I want to run the SQLite → PostgreSQL migration against production data
  before switching so that no data is lost.
- As a developer, I want a smoke test checklist to verify the cutover was successful so
  that I can confidently decommission the Express app.
- As a developer, I want the Express app code archived (not deleted) so that I can roll
  back if a critical issue is found.

## Acceptance Criteria
- [ ] Pre-cutover checklist documented and signed off:
  - [ ] All PROJ-4 through PROJ-12 QA test results show pass
  - [ ] `docker-compose.test.yml` has been running stably for at least 1 day with migrated data
  - [ ] Production SQLite → PostgreSQL migration run completed with 0 errors
  - [ ] Bill image files copied from `data/uploads/` to Next.js upload dir
- [ ] `docker-compose.yml` updated to replace the `app` (Express) service with:
  - `nextjs` service: builds from `/nextjs/Dockerfile`, exposes port 5000 → 3001
  - `postgres` service: PostgreSQL 15, data volume mounted at `./data/postgres/`
  - `redis` (optional): if session or caching layer is needed
- [ ] `/nextjs/Dockerfile` is production-ready:
  - Multi-stage build (deps → builder → runner)
  - Non-root user
  - `NODE_ENV=production`
  - Health check defined
- [ ] Old Express app source moved to `/express-legacy/` directory (not deleted)
- [ ] `.env.example` at repo root updated to reflect Next.js env vars (replacing Express vars)
- [ ] Post-cutover smoke test checklist:
  - [ ] Login with email/password works
  - [ ] Login with Google OAuth works
  - [ ] Bill list loads for a test project
  - [ ] Bill upload (with image) succeeds
  - [ ] Admin approve action works
  - [ ] Budget matrix loads and saves
  - [ ] PDF export downloads correctly
  - [ ] Google Sheets sync completes without error
  - [ ] Telegram notification fires on bill submit
- [ ] If any smoke test fails → documented rollback procedure: point `docker-compose.yml` back
      to Express `app` service, restore SQLite volume mount

## Edge Cases
- Production data migration takes > 5 minutes → run during a low-traffic window; notify users
  of a maintenance window
- PostgreSQL volume already contains data from a previous test run → migration script's
  idempotent upsert handles this safely
- Bill images not copied → images return 404 in the new app; rollback is safe since Express
  still has the originals

## Technical Requirements
- Dockerfile: multi-stage, non-root, health check
- `docker-compose.yml`: replace Express service, add Postgres service with named volume
- Rollback plan: documented in this spec and in the repo's README
- Branch: `to_nextjs` → merge to `main` only after smoke tests pass
- Final commit message: `deploy: cut over production to Next.js + PostgreSQL`

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
