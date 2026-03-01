# PROJ-8: Budget Matrix

## Status: Planned
**Created:** 2026-03-01
**Last Updated:** 2026-03-01

## Dependencies
- Requires: PROJ-5 (auth)
- Requires: PROJ-6 (PostgreSQL data)
- Requires: PROJ-9 (Categories & Motives must exist for matrix axes) — can be built in parallel
  but fully testable only after PROJ-9 is done

## User Stories
- As an admin, I want to see a matrix of motives vs. months with budget allocations so that
  I can plan the project's spending.
- As an admin, I want to edit budget allocation cells inline so that I can quickly adjust targets.
- As an admin, I want to see actual spending per motive per month alongside the budget so that
  I can spot over/under-spend at a glance.
- As a user, I want to view (read-only) the budget matrix so that I understand spending targets.

## Acceptance Criteria
- [ ] `/app/(protected)/budget/page.tsx` renders a matrix: rows = motives, columns = months
      (Jan–Dec of the selected year)
- [ ] Year selector (dropdown) defaults to current year; changing year reloads the matrix
- [ ] Each cell shows: budget allocation amount (editable by admin) + actual spend (read-only)
      + variance indicator (green if under budget, red if over)
- [ ] Admin can click any cell to edit the allocation amount inline; change is saved on blur /
      Enter via a Server Action
- [ ] "Save all" button performs a bulk upsert of all modified cells
- [ ] Category breakdown row below each motive row showing spend per category (collapsible)
- [ ] Column totals (monthly budget vs. spend) and row totals (annual budget vs. spend) displayed
- [ ] `AllocationWidget` from PROJ-7 reused for the per-bill allocation; budget matrix has its
      own separate `BudgetCell` component
- [ ] Loading skeleton while matrix data fetches
- [ ] Empty state if no motives exist: "No motives configured — go to Settings to add motives"

## Edge Cases
- Year with no bills → all actual spend cells show €0.00, budget cells editable
- Motive deleted mid-year → historic rows remain in matrix with a "(deleted)" label
- Cell value cleared (empty) → treated as €0.00 allocation, not null
- Concurrent edits from two admin sessions → last-write-wins (acceptable at this scale)
- Very large numbers (> 6 digits) → cells must not overflow layout; truncate with tooltip

## Technical Requirements
- Matrix data fetched server-side in a Server Component via Prisma
- Inline edit uses a Client Component island (`"use client"`) for the cell input
- Bulk save uses a Next.js Server Action
- Branch: `to_nextjs`

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
