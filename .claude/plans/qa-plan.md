# QA Test Plan — PROJ-14: Spending Overview

## Feature
PROJ-14: Spending Overview
Spec: `features/PROJ-14-spending-overview.md`

## Context Summary
- Feature status: "In Progress" per INDEX.md
- Dependencies: PROJ-5 (auth), PROJ-6 (Prisma/PG), PROJ-7 (Bills), PROJ-9 (Categories/Motives)
- Expected location: `nextjs/app/(protected)/spending/page.tsx`
- Expected components: SpendingTable, SpendingProgress, SpendingTabs
- Expected sidebar nav entry: "Spending" between existing items

## User Guidance
- Code-only review — no running server
- Test all acceptance criteria by verifying source files exist and are correct
- Full security audit of data scoping and access control

## Acceptance Criteria to Test

### Page Structure
- AC-1: Page route exists at `/app/(protected)/spending/page.tsx`
- AC-2: Tab navigation with "By Motive" (default) and "By Category"
- AC-3: Tab switching is client-side (no page reload)

### By Motive Tab
- AC-4: Table columns: Motive Name, Budget, Spent, Remaining, % Used
- AC-5: Spending calculated via junction table (bill_motives) with percentage allocation
- AC-6: Only confirmed bills included (status IS NULL OR status = 'confirmed')
- AC-7: Unallocated bills row shown when bills exist without motive allocations

### By Category Tab
- AC-8: Table columns: Category Name, Budget, Spent, Remaining, % Used
- AC-9: Spending calculated via junction table (bill_categories) with percentage allocation
- AC-10: Unallocated bills row shown when bills exist without category allocations

### Color Coding
- AC-11: Green < 80%, Orange 80-99.9%, Red >= 100%
- AC-12: Color indicator as dot or pill next to percentage

### Grand Totals Row
- AC-13: Fixed bottom row with "TOTAL" in bold
- AC-14: Sum of all budgets, spent, remaining, % used
- AC-15: Top border/divider and gray background

### Calculation Rules
- AC-16: Uses netto_amount only
- AC-17: Excludes draft bills
- AC-18: Project-scoped via session currentProjectId

### Data Display Format
- AC-19: German locale currency (EUR X.XXX,XX)
- AC-20: Percentage with 1 decimal place
- AC-21: Negative numbers with minus sign

### UI States
- AC-22: Loading skeleton with 5 rows
- AC-23: Empty state "No spending recorded yet"
- AC-24: Empty state "No budget items configured" with Settings link
- AC-25: Error state with retry button

### Access Control
- AC-26: Read-only for all users
- AC-27: All authenticated project members can view
- AC-28: Data scoped to current project

### Navigation
- AC-29: Sidebar includes "Spending" navigation entry

## Edge Cases to Test
- EC-1: No bills in project
- EC-2: All bills are drafts
- EC-3: Budget = 0 with spending > 0
- EC-4: No motives/categories configured
- EC-5: Very large numbers (> 6 digits)
- EC-6: Deleted motive/category with historic bills
- EC-7: Bills without any allocations
- EC-8: Partial allocations (< 100%)
- EC-9: Bill with netto_amount = NULL or 0
- EC-10: Division by zero in % Used
- EC-11: Negative remaining budget display
- EC-12: Project switch while viewing

## Security Audit Scope
- SEC-1: Authentication required on spending page/API
- SEC-2: Project isolation — data scoped to currentProjectId
- SEC-3: No mutation endpoints exposed (read-only)
- SEC-4: Input validation on any query params

## Regression Test Scope
- REG-1: Sidebar navigation still works for all other pages
- REG-2: Budget matrix page not affected

## Commit Message
test(PROJ-14): QA Round 1 results
