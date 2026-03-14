# BUG-48: Google Credentials File Is Global — Any Project Admin Overwrites All Projects

**Status:** Open
**Reported:** 2026-03-14
**Severity:** High
**Skill Tag:** [Backend]
**Feature:** PROJ-12: Integrations (Google Sheets + Telegram)

---

## Description

### Expected Behavior
Google service account credentials should be isolated per project. One project admin's actions should not affect another project's Google integration.

### Actual Behavior
All projects share a single credentials file at `data/google-credentials.json`. When any project admin uploads credentials via `POST /api/admin/export/google-config`, `saveCredentials()` overwrites the global file, immediately breaking every other project's Google Sheets integration.

## Steps to Reproduce

1. Admin of Project A configures Google credentials
2. Admin of Project B uploads different credentials
3. Project A's Google Sheets sync now uses Project B's service account

## Environment

- **Files:**
  - `nextjs/lib/google.ts` lines 11-17, 29-32
  - `nextjs/app/api/admin/export/google-config/route.ts` line 113
- **Date:** 2026-03-14

## Root Cause

`CREDENTIALS_PATH` is a static constant pointing to a single file path, with no project scoping.

## Fix

Store credentials per-project. Options:
1. File per project: `data/google-credentials-{projectId}.json`
2. Encrypted in database: new `ProjectGoogleCredentials` table with AES-256-GCM encrypted JSON keyed by `projectId`

Option 2 is preferred for Docker/multi-instance deployments.
