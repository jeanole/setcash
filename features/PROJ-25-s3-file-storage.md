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
+-- Local backend  (fallback when env vars absent — dev/test only)
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
