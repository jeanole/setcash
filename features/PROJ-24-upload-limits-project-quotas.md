# PROJ-24: Upload Limits & Project Quotas

**Status:** In Progress
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
- [ ] Deleting bills frees up quota (count is based on current bills, not cumulative)

## Technical Notes

- Add `uploadLimit Int?` to `Project` in schema (no counter field — count live from bills table)
- Super-admin panel: add limit field to project edit view
- System settings: add global default upload limit via `SystemConfig` table
- Bills page header: show quota usage bar when a limit is set
- Bill upload API: count current bills for project before accepting new one

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

**Resolution:** Accepted

---

## Tech Design (Solution Architect)

### Component Structure

```
Super-Admin Modal
└── ProjectsTab (existing)
    ├── Quota columns: "Used / Limit" per project row   ← new
    └── Edit Quota button → QuotaEditModal              ← new

Bills Page (existing)
└── QuotaBanner                                         ← new
    ├── Progress bar: "47 / 100 uploads used"
    └── Warning state when near/at limit

New Bill Page (existing)
└── Blocked state when limit reached                    ← new
    └── Message: "Upload limit reached — contact admin"

Super-Admin System Settings Tab                         ← new tab
└── GlobalQuotaForm
    └── "Default upload limit for new projects" field
```

### Data Model

**Changes to Project (existing table):**
- `uploadLimit` — optional integer, null = unlimited

No counter field. Usage is calculated live by counting the project's current bills. Deleting a bill frees up quota automatically.

**New: SystemConfig table**
- `key` — unique text identifier (e.g. `defaultUploadLimit`)
- `value` — text (parsed on read)

One row per global setting. Reusable for future system-wide config without schema changes.

### API Changes

| Route | Change |
|---|---|
| `POST /api/bills` | Count current bills for project; reject if at limit |
| `GET /api/superadmin/projects` | Include `uploadLimit` and live bill count |
| `PATCH /api/superadmin/projects/[id]` | Accept `uploadLimit` to set/clear quota |
| `GET /api/superadmin/system-config` | Return global settings including `defaultUploadLimit` |
| `PATCH /api/superadmin/system-config` | Update global settings |
| `POST /api/projects` | Apply `defaultUploadLimit` from SystemConfig on project creation |

### Tech Decisions

- **Live count over cumulative counter** — deleting bills frees quota, simpler schema, no risk of counter drift
- **`null` for unlimited** — quota UI is hidden entirely for projects with no limit set
- **`SystemConfig` table over env var** — super-admin can change the default live from the UI without a server restart
- **No new packages needed** — uses existing Prisma, Next.js, Tailwind

### Migration

One Prisma migration:
- Add `uploadLimit Int?` to `Project`
- Create `SystemConfig` table (`key`, `value`)
