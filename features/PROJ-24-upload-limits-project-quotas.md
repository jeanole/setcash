# PROJ-24: Upload Limits & Project Quotas

**Status:** Planned
**Priority:** Medium
**Created:** 2026-03-16
**Dependencies:** PROJ-7 (Bills), PROJ-17 (Super-Admin)

## Overview

Introduce a configurable upload limit per project, laying the groundwork for a paid-tier model. The super-admin can set the limit per project. When a project hits its limit, further uploads are blocked with a clear message. This enables a freemium path where paid projects get higher or unlimited quotas.

## User Stories

- As a super-admin, I want to set an upload limit per project so I can control resource usage and enable a paid tier.
- As a project admin, I want to see how many uploads my project has used and how many remain.
- As a user, I want to see a clear message when my project has reached its upload limit so I know what to do next.
- As a super-admin, I want to set a global default limit that applies to new projects automatically.

## Acceptance Criteria

- [ ] `Project` model has an `uploadLimit` field (nullable integer — null = unlimited)
- [ ] Super-admin can set `uploadLimit` per project in the super-admin panel
- [ ] Super-admin can set a global default upload limit in system settings
- [ ] Bill upload API checks current bill count against the project's limit before accepting
- [ ] When limit is reached, upload is rejected with HTTP 402/403 and a user-friendly error message
- [ ] Bills page shows current usage vs. limit (e.g. "47 / 100 uploads used")
- [ ] Example/demo project has its own limit (default: 50)
- [ ] Deleted bills do not free up quota (count is cumulative, not current)
- [ ] Super-admin can reset a project's upload counter manually

## Technical Notes

- Add `uploadLimit Int?` and `uploadCount Int @default(0)` to `Project` in schema
- Increment `uploadCount` atomically on successful bill creation
- Super-admin panel: add limit field to project edit view
- System settings: add global default upload limit
- Bills page header: show quota usage bar when a limit is set

## Change Requests

### CR-29: Upload Limits per Project for Paid Tier Foundation
**Requested:** 2026-03-16 | **Priority:** Medium | **Status:** Pending Review

**Current Behavior:** Projects can upload unlimited bills with no quota or billing-tier concept.

**Desired Behavior:** Super-admin can set an upload limit per project. Users see their usage. Uploads are blocked when limit is reached.

**Rationale:** Enables a freemium/paid-tier model in the long run — free projects get a capped quota, paid projects get higher or unlimited quotas.

**Proposed Acceptance Criteria:**
- [ ] `uploadLimit` and `uploadCount` on Project model
- [ ] Super-admin can configure limit per project
- [ ] Upload API enforces the limit
- [ ] UI shows usage vs. limit
- [ ] Global default limit configurable in super-admin settings

**Resolution:** Pending
