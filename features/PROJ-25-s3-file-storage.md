# PROJ-25: S3-Compatible File Storage for Bill Images

**Status:** Planned
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
