# BUG-39: Upload Fails with EACCES Permission Denied on /data/uploads

**Status:** Resolved
**Reported:** 2026-03-08
**Severity:** Critical
**Skill Tag:** backend
**Feature:** PROJ-7

---

## Description

### Expected Behavior
Uploading an image when creating or editing a bill should succeed and the file should be saved to the uploads directory.

### Actual Behavior
Upload and bill creation fail with a 500 Internal Server Error. Server logs show:

```
Bill creation failed: Error: EACCES: permission denied, mkdir '/data/uploads'
```

The server attempts to create the directory `/data/uploads` (filesystem root) instead of `/app/data/uploads`.

## Steps to Reproduce

1. Run the Next.js app via Docker (`docker-compose up`)
2. Log in and navigate to Bills
3. Create a new bill and attach an image
4. Observe: 500 error, bill not saved

## Root Cause

`lib/upload.ts` computes:

```ts
export const UPLOADS_DIR = path.join(process.cwd(), '..', 'data', 'uploads');
```

In **development** (`cwd = .../vbudget/nextjs`): resolves correctly to `.../vbudget/data/uploads`.

In **Docker** (`WORKDIR /app`, standalone server runs as `node server.js` from `/app`): `cwd = /app`, so `path.join('/app', '..', 'data', 'uploads')` = `/data/uploads` — the filesystem root, inaccessible to the non-root `nextjs` user.

## Environment

- Docker Desktop on Windows
- Next.js standalone output (`output: 'standalone'` in next.config.mjs)
- Non-root user (`nextjs`) in container

---

## Resolution

**Status:** Resolved
**Resolved Date:** 2026-03-08
**Fixed In:** fix(BUG-39)

**Fix:**
1. `lib/upload.ts`: Use `UPLOADS_DIR` env var with dev fallback — `process.env.UPLOADS_DIR || path.join(process.cwd(), '..', 'data', 'uploads')`
2. `Dockerfile`: Create `/app/data/uploads` with correct ownership and set `ENV UPLOADS_DIR=/app/data/uploads`
3. `docker-compose.yml`: Mount `./data/uploads` as a named volume at `/app/data/uploads` for persistence
