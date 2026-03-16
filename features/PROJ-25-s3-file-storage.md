# PROJ-25: S3-Compatible File Storage for Bill Images

**Status:** In Progress
**Priority:** Medium
**Created:** 2026-03-16
**Dependencies:** PROJ-7

## Overview

Migrate bill image storage from local disk (`/data/uploads`) to an S3-compatible object storage provider (e.g. Hetzner Object Storage, Cloudflare R2, MinIO). This removes the dependency on a persistent local filesystem, enabling stateless Docker deployments and making images accessible via stable URLs.

## User Stories

- As an **operator**, I want bill images stored in S3-compatible object storage so that I can run stateless containers without persistent volume mounts.
- As a **user**, I want uploaded bill images to load reliably so that I can always view my receipts.
- As an **admin**, I want uploads to work the same way they do today so that the migration is transparent to end users.

## Acceptance Criteria

- [ ] Bill images are uploaded directly to an S3-compatible bucket on creation
- [ ] Existing images served from `/data/uploads` are not broken (migration path or redirect)
- [ ] Image URLs in bill detail views resolve correctly from object storage
- [ ] `STORAGE_ENDPOINT`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, and `STORAGE_REGION` env vars configure the provider
- [ ] Falls back gracefully if credentials are not set (local storage for dev)
- [ ] No persistent volume mount required in production Docker setup
- [ ] New env vars documented in `.env.local.example`

## Out of Scope

- Google credentials file (stays on disk or separate secret management)
- PDF/Excel report files (generated on-the-fly, not persisted)

## Change Requests

### CR-30: Migrate Bill Image Storage to S3-Compatible Object Storage
**Requested:** 2026-03-16 | **Priority:** Medium | **Status:** Pending Review

**Current Behavior:** Bill images are saved to `/data/uploads` on the local filesystem. This requires a persistent Docker volume and makes horizontal scaling impossible.

**Desired Behavior:** Bill images are stored in an S3-compatible bucket (e.g. Hetzner Object Storage, Cloudflare R2, MinIO). The app reads/writes images via the S3 API. Local storage is retained as a fallback for development.

**Rationale:** Enables stateless deployments, removes persistent volume dependency, and makes the app easier to host on any provider.

**Proposed Acceptance Criteria:**
- [ ] Upload writes to S3 bucket instead of `/data/uploads`
- [ ] Image retrieval serves from bucket URL or signed URL
- [ ] Provider configurable via env vars (endpoint, bucket, keys, region)
- [ ] Local filesystem fallback when env vars are absent
- [ ] Existing `/data/uploads` images not broken after deploy

**Resolution:** Pending

---

## Tech Design (Solution Architect)

### Component Structure

```
lib/storage.ts  ← NEW unified storage adapter
+-- S3 backend  (active when STORAGE_ENDPOINT + STORAGE_BUCKET set)
|   +-- upload(key, buffer)  → writes object to S3 bucket
|   +-- delete(key)          → removes object from S3
|   +-- getUrl(key)          → generates a short-lived presigned URL (1 hour)
|   Works for: production (Hetzner/R2/AWS), local MinIO, any S3-compatible provider
|   Local dev: STORAGE_ENDPOINT=http://localhost:9000 pointing at MinIO in Docker
+-- Local filesystem backend  (last resort — no env vars set at all)
    +-- upload(key, buffer)  → writes file to /data/uploads/<key>
    +-- delete(key)          → unlinks local file
    +-- getUrl(key)          → returns "/api/uploads/<key>"

API — Image write routes  (replace direct fs calls with storage adapter)
+-- POST /api/bills                          ← storage.upload on bill creation
+-- POST /api/bills/[id]/images              ← storage.upload for added images
+-- PUT  /api/bills/[id]/images/[imageId]    ← storage.upload (replace)
+-- DELETE /api/bills/[id]/images/[imageId]  ← storage.delete

API — Image read routes  (map filePath → URL at response time)
+-- GET /api/bills/[id]   ← each image: storage.getUrl(filePath) → presigned URL
+-- GET /api/bills        ← same for any thumbnail references

GET /api/uploads/[[...path]]  ← unchanged; serves local dev backend only
                                 (S3 backend bypasses this route entirely)

Frontend — ImageGallery.tsx   ← NO CHANGES NEEDED
+-- imageUrl() already accepts any URL string
+-- Will receive presigned S3 URLs from API response in production
+-- Receives "/api/uploads/<key>" in local dev — unchanged behaviour

Dockerfile
+-- Remove UPLOADS_DIR env var and mkdir for /app/data/uploads (S3 mode)
+-- Keep local fallback working for local dev without env vars
```

### Data Model

**No database schema change required.**

`BillImage.filePath` already stores a "pointer to the file." In S3 mode it stores an S3 object key (e.g. `jens/jens_1.01_2026-03-16.jpg`) — structurally identical to the existing local relative path. Tens of thousands of existing DB records remain valid without any migration.

**New environment variables:**

| Variable | Example | Purpose |
|---|---|---|
| `STORAGE_ENDPOINT` | `https://nbg1.your-objectstorage.com` | S3-compatible provider URL |
| `STORAGE_BUCKET` | `setcash-bills` | Bucket name |
| `STORAGE_ACCESS_KEY` | `AKIA...` | Access key ID |
| `STORAGE_SECRET_KEY` | `wJalr...` | Secret access key |
| `STORAGE_REGION` | `nbg1` | Region (required by S3 SDK) |

All five are optional — when absent the app runs in local disk mode (dev unchanged).

**Migration of existing images:** No DB changes. A one-time script uploads `/data/uploads` files to the S3 bucket using the same relative paths as keys. The `/api/uploads` proxy continues to serve any files not yet migrated.

### How Images Are Served (key design decision)

The current approach routes every image byte through the server (`fs.readFileSync` → response). The new approach generates **short-lived presigned URLs** at API response time:

```
Browser → GET /api/bills/[id]
  Server: checks session + project membership (unchanged)
  Server: for each image → storage.getUrl(filePath) → presigned S3 URL (1-hour TTL)
  Response: { images: [{ file: "https://bucket.provider.com/jens/bill.jpg?X-Amz-..." }] }

Browser → <img src="https://...presigned...">
  Images load directly from S3 — zero server bandwidth, CDN-friendly
```

Security is enforced at presigned URL generation time (same auth checks as today), not at download time.

### Tech Decisions

| Decision | Why |
|---|---|
| **Presigned URLs over server proxy** | Images bypass server entirely — eliminates memory spike from `readFileSync`, removes bandwidth bottleneck, enables CDN caching |
| **Single `lib/storage.ts` adapter** | Four upload routes currently duplicate disk logic. One adapter = one change point if provider changes |
| **S3 key = current `filePath` value** | Zero DB migration — existing `filePath` values are valid S3 keys |
| **AWS SDK (`@aws-sdk/client-s3`)** | Works with every S3-compatible provider (Hetzner, Cloudflare R2, MinIO, AWS) |
| **Local fallback when no env vars** | Developers run without S3; existing tests and dev workflow unchanged |
| **Frontend unchanged** | `imageUrl()` in `ImageGallery` accepts any URL — no component changes needed |

### Dependencies

| Package | Purpose |
|---|---|
| `@aws-sdk/client-s3` | S3-compatible upload, delete, object operations |
| `@aws-sdk/s3-request-presigner` | Generates short-lived signed download URLs |

### Files to Create / Modify

| File | Action | What changes |
|---|---|---|
| `lib/storage.ts` | **Create** | Unified adapter with S3 and local backends |
| `lib/upload.ts` | **Modify** | Replace `fs.renameSync` / `fs.copyFileSync` calls with `storage.upload`; keep formidable parsing |
| `app/api/bills/route.ts` | **Modify** | Call `storage.upload`; remove `fs.renameSync` |
| `app/api/bills/[id]/images/route.ts` | **Modify** | Call `storage.upload` |
| `app/api/bills/[id]/images/[imageId]/route.ts` | **Modify** | Call `storage.upload` + `storage.delete` |
| `app/api/bills/[id]/route.ts` | **Modify** | Map `filePath → storage.getUrl(filePath)` in response |
| `app/api/bills/route.ts` | **Modify** | Map `filePath → storage.getUrl(filePath)` in list response |
| `app/api/uploads/[[...path]]/route.ts` | **No change** | Continues to serve local dev backend |
| `Dockerfile` | **Modify** | Remove persistent volume dependency for S3 mode |
| `.env.local.example` | **Modify** | Document 5 new `STORAGE_*` env vars |
| `scripts/migrate-uploads-to-s3.ts` | **Create** | One-time migration script for existing images |

---

## QA Test Results

**Tested:** 2026-03-16
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)
**Commit Under Test:** 84de132

### Acceptance Criteria Status

#### AC-1: Bill images uploaded to S3-compatible bucket on creation
- [x] `POST /api/bills` uses `storage.uploadFile()` for new bill images
- [x] `POST /api/bills/[id]/images` uses `storage.uploadFile()` for added images
- [x] `PUT /api/bills/[id]/images/[imageId]` uses `storage.uploadFile()` for replaced images
- [x] Temp files read via `fs.readFileSync()`, uploaded via storage adapter, temp cleaned up

#### AC-2: Existing images from /data/uploads not broken
- [x] `/api/uploads/[[...path]]` route still exists and serves files
- [x] Migration script `scripts/migrate-uploads-to-s3.ts` exists with skip-if-exists logic
- [ ] BUG: In S3 mode, `/api/uploads` proxy uses `storage.getFileBuffer()` which only queries S3, not local disk. If migration is incomplete, unmigrated local images return 404. See BUG-1.

#### AC-3: Image URLs resolve correctly from object storage
- [x] `GET /api/bills/[id]` maps images via `storage.getFileUrl(img.filePath)` with `Promise.all`
- [x] `GET /api/bills` list route maps images via `storage.getFileUrl(img.filePath)` with `Promise.all`
- [x] Presigned URLs generated with 1-hour TTL

#### AC-4: Environment variables configure the provider
- [x] All 5 env vars read in `lib/storage.ts`: `STORAGE_ENDPOINT`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_REGION`
- [x] S3Client configured with `forcePathStyle: true` for MinIO/Hetzner compatibility
- [x] `STORAGE_REGION` defaults to `'auto'` when not set

#### AC-5: Falls back gracefully if credentials not set
- [x] `isS3Enabled()` requires both `STORAGE_ENDPOINT` and `STORAGE_BUCKET` to be non-empty
- [x] All 4 public functions (`uploadFile`, `deleteFile`, `getFileUrl`, `getFileBuffer`) check `isS3Enabled()` and fall back to local filesystem
- [x] Local fallback creates directories recursively if missing

#### AC-6: No persistent volume mount required in production Docker setup
- [ ] BUG: Dockerfile still creates `/app/data/uploads` directory and sets `UPLOADS_DIR=/app/data/uploads` (lines 79-81). The tech design specifies removing these for S3 mode. See BUG-2.

#### AC-7: New env vars documented in .env.local.example
- [ ] BUG: `.env.local.example` file does not exist. Env vars were documented in `.env.test.example` instead, which does not match the spec. See BUG-3.

### Edge Cases Status

#### EC-1: Upload with invalid/corrupt image data
- [ ] BUG: `validateFile()` with magic byte checking exists in `lib/upload.ts` but is NOT called in any bill upload route. Formidable `filter` only checks file extensions, not content. Pre-existing issue, not introduced by PROJ-25. See BUG-4.

#### EC-2: S3 credentials set but invalid
- [x] S3 SDK errors propagate to API route catch blocks and return HTTP 500
- [x] Error messages use `error.message` which may include SDK details but not credentials

#### EC-3: Very large file upload respects existing limits
- [x] Formidable `maxFileSize` (10MB) unchanged
- [x] Formidable `maxFiles` (10) unchanged
- [x] Project upload quota check in bill creation unchanged

#### EC-4: Concurrent uploads -- no race conditions on key generation
- [x] Bill number calculated inside `Serializable` transaction
- [x] Multiple images in same bill use index suffix

#### EC-5: Delete image when S3 object doesn't exist
- [x] `storage.deleteFile()` wraps S3 `DeleteObjectCommand` in try/catch, logs but does not re-throw
- [x] S3 `DeleteObject` is inherently idempotent

#### EC-6: Mixed state -- some images local, some S3
- [ ] BUG: No dual-lookup fallback. In S3 mode, `getFileBuffer()` only queries S3, not local disk. Unmigrated local images become inaccessible. See BUG-1.

#### EC-7: Presigned URL expiration
- [x] `getSignedUrl()` called with `{ expiresIn: 3600 }` (1 hour) -- matches spec

#### EC-8: S3 key uses existing filePath format
- [x] Key format `userFolder/savedFilename` is structurally identical to existing local relative path
- [x] No DB migration needed

### Security Audit Results

- [x] S-1: Authentication: All storage-related routes require authenticated session via `auth()`
- [x] S-2: Authorization: Bill routes verify project membership; uploads proxy checks project ID; image routes check submitter/admin
- [x] S-3: Presigned URL leakage: 1-hour TTL, no sensitive data in key names. Note: presigned URLs are inherently shareable for their TTL -- this is by design per the tech spec.
- [ ] S-4: Path traversal: No explicit validation that S3 keys or file paths do not contain `../` sequences. While `generateFilename()` does not produce traversal sequences, no defense-in-depth check exists in `uploadFile()` or `getFileBuffer()` local fallback. See BUG-5.
- [x] S-5: SSRF via STORAGE_ENDPOINT: Endpoint is operator-controlled via environment variable, not user-supplied. Acceptable risk.
- [x] S-6: Secret exposure: Credentials not logged or returned in API responses. AWS SDK error messages may leak endpoint URLs but not access keys. Low severity.
- [ ] S-7: Content-Type validation: `validateFile()` magic byte check exists but is not called in upload routes. See BUG-4.
- [x] S-8: Migration script: Does not log credentials. Logs endpoint and bucket name only. Error messages use `.message` property only.

### Regression Test Results

- [x] PROJ-7 (Bills CRUD): Bill create/read/update/delete all functional with storage adapter
- [x] PROJ-24 (Upload Limits): File size, count, and project quota limits preserved
- [x] PROJ-19 (OCR): `lib/ocr.ts` uses `storage.getFileBuffer()` correctly with null check
- [x] `/api/uploads` proxy: Uses `storage.getFileBuffer()`, works in both modes, auth checks intact
- [x] Telegram image upload: Downloads to `os.tmpdir()`, uploads via `storage.uploadFile()`, cleans up temp file
- [x] Admin image export: Uses `storage.getFileBuffer()` to read images for ZIP archive
- [x] PDF report: Uses `storage.getFileBuffer()` to embed images in PDF

### Bugs Found

#### BUG-1: No fallback to local disk in S3 mode for unmigrated images [Backend]
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Deploy with S3 env vars configured (S3 mode enabled)
  2. Do NOT run migration script (or run partially -- some images not yet in S3)
  3. Access a bill with an image that only exists locally in `/data/uploads`
  4. Expected: Image loads (from local disk as fallback)
  5. Actual: Image returns 404 because `getFileBuffer()` and `getFileUrl()` only query S3 when `isS3Enabled()` is true
- **Priority:** Fix before deployment -- this breaks the "Existing images not broken" acceptance criterion during the migration window

#### BUG-2: Dockerfile not updated for S3 mode [Deploy]
- **Severity:** Low
- **Steps to Reproduce:**
  1. Review Dockerfile lines 79-81
  2. Expected: `mkdir /app/data/uploads` and `UPLOADS_DIR` env var removed per tech design
  3. Actual: Both are still present
- **Priority:** Fix in next sprint -- not breaking (the directory is harmless in S3 mode), but contradicts the spec and adds unnecessary Docker layer

#### BUG-3: STORAGE_* env vars not documented in .env.local.example [Deploy]
- **Severity:** Low
- **Steps to Reproduce:**
  1. Look for `.env.local.example` in the nextjs directory
  2. Expected: File exists with all 5 `STORAGE_*` env vars documented
  3. Actual: File does not exist. Env vars were added to `.env.test.example` only.
- **Priority:** Fix in next sprint -- developers may not find the documentation

#### BUG-4: validateFile() magic byte check not called in upload routes [Backend]
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Upload a file with `.jpg` extension but non-JPEG content (e.g., a renamed executable)
  2. Expected: Upload rejected due to content mismatch
  3. Actual: Upload accepted because only formidable's extension filter runs; `validateFile()` is never called
- **Note:** Pre-existing issue, not introduced by PROJ-25. The function exists in `lib/upload.ts` but is not imported in any route.
- **Priority:** Fix in next sprint

#### BUG-5: No path traversal validation on storage keys [Backend]
- **Severity:** Low
- **Steps to Reproduce:**
  1. If a `BillImage.filePath` containing `../` were stored in the database (e.g., via direct DB manipulation), `storage.uploadFile()` or `getFileBuffer()` in local mode would resolve the path via `path.join(UPLOADS_DIR, key)`, potentially reading/writing outside the uploads directory
  2. Expected: Keys containing `../` are rejected or sanitized
  3. Actual: No validation exists
- **Note:** Exploitation requires ability to write arbitrary filePath values to the database, which is not possible through normal API usage. Defense-in-depth improvement.
- **Priority:** Nice to have

#### BUG-6: Telegram uploads use flat key without user folder prefix [Backend]
- **Severity:** Low
- **Steps to Reproduce:**
  1. Send a photo via Telegram bot
  2. Image is stored with key `tg_<timestamp>_<random>.<ext>` (flat, no folder)
  3. Bill routes store images with key `<userFolder>/<filename>` (folder structure)
  4. Expected: Consistent key format across all upload paths
  5. Actual: Telegram uploads lack user folder prefix, creating inconsistent S3 key structure
- **Note:** Pre-existing inconsistency, not introduced by PROJ-25. Does not break functionality.
- **Priority:** Nice to have

### Summary
- **Acceptance Criteria:** 5/7 passed (AC-6 and AC-7 failed -- low severity deployment issues)
- **Bugs Found:** 6 total (0 critical, 2 medium, 4 low)
- **Security:** 1 issue found (path traversal -- low severity, defense-in-depth)
- **Regression:** All 7 regression checks passed
- **Production Ready:** NO
- **Recommendation:** Fix BUG-1 (no local fallback in S3 mode) before deployment -- it is a data availability risk during migration. BUG-2 and BUG-3 are low-severity deployment hygiene issues. BUG-4 is pre-existing and not a blocker for this feature.
