# PROJ-23: Visit Analytics & Demo Usage Tracking

**Status:** Planned
**Priority:** Medium
**Created:** 2026-03-16
**Dependencies:** PROJ-22 (Demo / Test Account), PROJ-5 (Auth)

## Overview

Provide the super-admin with visibility into landing page visits and demo login usage — who clicked the demo button, when, and how often. Helps gauge interest and identify patterns without requiring a full third-party analytics setup.

## User Stories

- As a super-admin, I want to see how many people visited the landing page so I can gauge interest.
- As a super-admin, I want to see when demo logins were attempted and completed so I know who is testing the app.
- As a super-admin, I want a simple dashboard view of visit and demo usage stats so I don't have to dig through logs.

## Acceptance Criteria

- [ ] Landing page visits are logged (timestamp, anonymised IP/UA, no PII beyond what's needed)
- [ ] Each demo login attempt is logged (timestamp, Turnstile success/fail, login success/fail)
- [ ] Super-admin can view a stats page showing visit counts and demo usage over time
- [ ] Data is aggregated — daily/weekly totals visible
- [ ] No external analytics service required (self-hosted, stored in DB)
- [ ] Logs are automatically pruned after a configurable retention period (default: 90 days)
- [ ] GDPR-compliant — no full IP storage, no cookies for tracking, no fingerprinting

## Technical Notes

- New `VisitLog` and `DemoLoginAttempt` tables in Prisma schema
- Landing page hits tracked via a lightweight API route (`/api/analytics/visit`) called client-side on mount
- Demo login events already pass through `/api/auth/demo-login` — add logging there
- Super-admin analytics page under `/superadmin/analytics` or as a tab in the existing super-admin panel

## Change Requests

### CR-28: Insights into Site Visits and Demo Usage
**Requested:** 2026-03-16 | **Priority:** Medium | **Status:** Pending Review

**Current Behavior:** No visibility into landing page traffic or demo login activity.

**Desired Behavior:** Super-admin sees visit counts and demo login events (who, when, success/fail) in a simple dashboard.

**Rationale:** Helps the owner understand how many people discover and try the app, without relying on third-party tracking tools.

**Proposed Acceptance Criteria:**
- [ ] Visit counter on landing page (anonymous, no PII)
- [ ] Demo login attempts logged with timestamp and outcome
- [ ] Super-admin view showing daily/weekly stats
- [ ] 90-day auto-pruning

**Resolution:** Pending
