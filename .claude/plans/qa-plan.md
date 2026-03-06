# QA Test Plan

## Feature
PROJ-8: Budget Matrix
Spec: /mnt/c/Users/jensmoeller/code/vbudget/features/PROJ-8-budget-matrix.md

## Context Summary
Budget Matrix is a Next.js/PostgreSQL feature that displays a matrix of Categories (rows) vs Motives (columns) with budget allocations and actual spending calculations. Two critical bugs (BUG-15, BUG-16) were recently fixed - SQL column names and PostgreSQL enum casting.

**Key Files:**
- `nextjs/app/(protected)/budget/page.tsx` - Server Component with spending queries
- `nextjs/app/api/budget-matrix/route.ts` - API route handler
- `nextjs/app/api/budget-matrix/bulk-update/route.ts` - Bulk update endpoint
- `nextjs/components/budget/BudgetMatrixClient.tsx` - Client component with editing
- `nextjs/components/budget/BudgetMatrixTable.tsx` - Table display with sticky headers
- `nextjs/components/budget/BudgetMatrixCell.tsx` - Individual cell with variance indicators

## User Guidance
Test accounts: http://localhost:3000
- Admin/Owner user: Can view and edit budget matrix
- Regular user: View-only access
- Super admin: Full access to all projects

Scope: Full testing - all acceptance criteria, edge cases, security audit

## Acceptance Criteria to Test

### AC-1: Page Structure & Routing
- [ ] Page route `/budget` renders correctly
- [ ] Matrix layout: Categories as rows, Motives as columns
- [ ] Header displays "Budget Matrix" title
- [ ] Page accessible from sidebar navigation

### AC-2: Data Fetching
- [ ] Motives fetched and sorted ("Default" first, then alphabetical)
- [ ] Categories fetched and sorted ("Uncategorized" first, then alphabetical)
- [ ] Budget matrix cells loaded correctly
- [ ] Spending calculations (motive, category, cell) computed correctly

### AC-3: Matrix Grid Layout
- [ ] Fixed header row with motive names as column headers
- [ ] Leftmost column displays category names as row headers
- [ ] Sticky header row and sticky first column work on scroll
- [ ] Horizontal/vertical scroll for many motives/categories

### AC-4: Cell Display
- [ ] Each cell shows budget amount (top) and spent amount (bottom)
- [ ] Currency format: €X.XXX,XX (German locale)
- [ ] Empty/zero cells show €0.00 or placeholder
- [ ] Variance indicator visible (percentage badge)

### AC-5: Variance Indicators
- [ ] Green: Spent ≤ 80% of budget
- [ ] Amber/Yellow: 80% < Spent ≤ 100% of budget
- [ ] Red: Spent > 100% of budget
- [ ] Gray: No budget set (budget = 0)

### AC-6: Cell Editing (Admin/Owner)
- [ ] Click-to-edit activates inline input
- [ ] Number input accepts decimal values
- [ ] Enter key triggers save
- [ ] Escape key cancels edit
- [ ] Blur triggers save
- [ ] Visual indicator for unsaved changes

### AC-7: Totals Row and Column
- [ ] Bottom row shows motive totals
- [ ] Rightmost column shows category totals
- [ ] Bottom-right corner shows grand total
- [ ] Both budget and spent amounts in totals

### AC-8: Bulk Save Operation
- [ ] "Save Changes" button enabled only when cells modified
- [ ] Button disabled with loading state during save
- [ ] Success toast notification on successful save
- [ ] Error handling with retry option on failure

### AC-9: Protected Defaults
- [ ] "Default" motive appears first in columns
- [ ] "Uncategorized" category appears first in rows
- [ ] Protected items handled correctly

### AC-10: Empty States
- [ ] Empty state when no motives: link to Settings > Motives
- [ ] Empty state when no categories: link to Settings > Categories
- [ ] Skeleton loader while data fetches

### AC-11: API Endpoints
- [ ] GET /api/budget-matrix returns complete data
- [ ] POST /api/budget-matrix/bulk-update saves changes (admin only)
- [ ] Proper error responses for unauthorized access

## Edge Cases to Test

### Data Edge Cases
- [ ] **Year with no bills**: All spent cells show €0.00
- [ ] **Motive deleted mid-session**: Save handles gracefully
- [ ] **Cell value cleared**: Treated as €0.00
- [ ] **Very large numbers**: Cells don't overflow layout
- [ ] **Division by zero**: Budget=0 but spending exists shows "∞" or "Over budget"
- [ ] **Negative budget values**: Validate and reject
- [ ] **Concurrent edits**: Last-write-wins acceptable

### UI Edge Cases
- [ ] **Many motives/categories**: Scroll with sticky headers
- [ ] **Zero motives**: Display empty state
- [ ] **Zero categories**: Display empty state
- [ ] **Single motive/category**: Matrix renders correctly (1x1)
- [ ] **Network failure during save**: Error message with retry
- [ ] **Session timeout during edit**: Redirect to login

### Calculation Edge Cases
- [ ] **Draft bills excluded**: Only confirmed/approved/paid bills in spending
- [ ] **Bills with 0% allocation**: Contribute 0 to spending
- [ ] **Partial allocations**: Unallocated portion not in matrix
- [ ] **Floating point precision**: Decimal calculations correct

### Permission Edge Cases
- [ ] **User role viewing matrix**: Read-only, no edit controls
- [ ] **Admin demoted to user**: Save fails with auth error
- [ ] **Project switch while editing**: Warn about unsaved changes

## Security Audit Scope

### Authentication
- [ ] Cannot access /budget without login
- [ ] Cannot access /api/budget-matrix without login
- [ ] Cannot access /api/budget-matrix/bulk-update without login

### Authorization
- [ ] User cannot edit matrix (API returns 403)
- [ ] User cannot access other projects' data
- [ ] Admin can only edit their project's matrix
- [ ] Super admin can access all projects

### Input Validation
- [ ] Negative amounts rejected
- [ ] Non-numeric values rejected
- [ ] XSS attempts in budget values blocked
- [ ] SQL injection attempts blocked (motiveId, categoryId)

### Rate Limiting
- [ ] Bulk save has rate limiting
- [ ] Excessive requests handled gracefully

### Data Exposure
- [ ] API doesn't expose sensitive data
- [ ] Response doesn't include other projects' data

## Regression Test Scope

### Related Deployed Features
- [ ] PROJ-5 (NextAuth): Login/logout works
- [ ] PROJ-7 (Bills): Bills list still functional
- [ ] PROJ-9 (Categories/Motives): Settings pages work
- [ ] PROJ-10 (Members): Project switching works

## Responsive / Cross-Browser Scope

### Breakpoints
- [ ] 375px (mobile): Table scrolls horizontally
- [ ] 768px (tablet): Layout adapts
- [ ] 1440px (desktop): Full layout

### Browsers
- [ ] Chrome
- [ ] Firefox
- [ ] Safari

## Bug Report Template
Reference: /mnt/c/Users/jensmoeller/code/vbudget/.claude/skills/qa/test-template.md

Tag bugs with:
- Severity: Critical | High | Medium | Low
- Skill: [Frontend] | [Backend] | [Architecture] | [Deploy]
