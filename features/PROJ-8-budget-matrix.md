# PROJ-8: Budget Matrix

## Status: Change Requested
**Created:** 2026-03-01
**Last Updated:** 2026-03-06

## Dependencies
- Requires: PROJ-5 (auth)
- Requires: PROJ-6 (PostgreSQL data)
- Requires: PROJ-9 (Categories & Motives must exist for matrix axes) — can be built in parallel
  but fully testable only after PROJ-9 is done

## User Stories
- As an admin, I want to see a matrix of categories vs motives with budget allocations so that
  I can plan the project's spending.
- As an admin, I want to edit budget allocation cells inline so that I can quickly adjust targets.
- As an admin, I want to see actual spending per category per motive alongside the budget so that
  I can spot over/under-spend at a glance.
- As a user, I want to view (read-only) the budget matrix so that I understand spending targets.

## Acceptance Criteria

### API Endpoints (Express → Next.js Migration)

| Express Endpoint | Next.js Route | Method | Auth | Description |
|-----------------|---------------|--------|------|-------------|
| `GET /api/budget-matrix` | `GET /api/budget-matrix` | Server Action / Route Handler | Project Access | Returns matrix data, motives, categories, spending calculations |
| `PUT /api/admin/budget-matrix` | `POST /api/budget-matrix/bulk-update` | Server Action | Admin/Owner Only | Bulk upsert of budget matrix cells |

### Page & Route Structure

- [ ] Page route: `/app/(protected)/budget/page.tsx` renders the budget matrix
- [ ] Matrix layout: **Categories as rows**, **Motives as columns** (as per existing Express implementation)
- [ ] Header displays matrix title "Budget Matrix" with project context
- [ ] Page accessible from sidebar navigation under "Budget Matrix" item

### Data Fetching (Server Component)

- [ ] Server Component fetches matrix data via Prisma using the following queries:

**1. Fetch Motives (columns):**
```typescript
const motives = await prisma.motive.findMany({
  where: { projectId },
  orderBy: [
    { name: 'asc' } // Note: "Default" motive handled specially in UI
  ],
  select: { id: true, name: true, budget: true }
});
```

**2. Fetch Categories (rows):**
```typescript
const categories = await prisma.category.findMany({
  where: { projectId },
  orderBy: [
    { name: 'asc' } // Note: "Uncategorized" handled specially in UI
  ],
  select: { id: true, name: true, budget: true }
});
```

**3. Fetch Budget Matrix Cells:**
```typescript
const matrixCells = await prisma.budgetMatrix.findMany({
  where: { projectId },
  select: { motiveId: true, categoryId: true, amount: true }
});
```

**4. Calculate Spending per Motive (proportional via junction table):**
```sql
-- Prisma raw query equivalent
SELECT bm.motive_id, SUM(b.netto_amount * bm.percentage / 100) as spent
FROM "BillMotive" bm 
JOIN "Bill" b ON b.id = bm.bill_id
WHERE b.project_id = ? 
  AND b.status NOT IN ('draft', 'pending', 'rejected')
GROUP BY bm.motive_id
```

**5. Calculate Spending per Category (proportional via junction table):**
```sql
-- Prisma raw query equivalent
SELECT bc.category_id, SUM(b.netto_amount * bc.percentage / 100) as spent
FROM "BillCategory" bc 
JOIN "Bill" b ON b.id = bc.bill_id
WHERE b.project_id = ? 
  AND b.status NOT IN ('draft', 'pending', 'rejected')
GROUP BY bc.category_id
```

**6. Calculate Cell Spending (motive × category intersection):**
```sql
-- Prisma raw query equivalent
SELECT bm.motive_id, bc.category_id,
  SUM(b.netto_amount * bm.percentage / 100 * bc.percentage / 100) as spent
FROM "BillMotive" bm
JOIN "BillCategory" bc ON bc.bill_id = bm.bill_id
JOIN "Bill" b ON b.id = bm.bill_id
WHERE b.project_id = ? 
  AND b.status NOT IN ('draft', 'pending', 'rejected')
GROUP BY bm.motive_id, bc.category_id
```

### Matrix Cell Data Structure

Each cell in the matrix represents the intersection of one Category (row) and one Motive (column):

```typescript
interface BudgetMatrixCell {
  // Composite key: categoryId + "_" + motiveId (for lookup maps)
  key: string; // e.g., "cat_123_mot_456"
  
  // Foreign Keys
  categoryId: string;  // References Category.id
  motiveId: string;    // References Motive.id
  
  // Budget Data
  budgetAmount: number;  // From BudgetMatrix.amount (default: 0)
  
  // Spending Data (calculated)
  spentAmount: number;   // Calculated via bill_motives × bill_categories junction
  
  // Derived Metrics
  variance: number;      // budgetAmount - spentAmount
  percentUsed: number;   // (spentAmount / budgetAmount) × 100
  
  // UI State
  isModified: boolean;   // Track unsaved changes
  editValue: string;     // Input buffer during editing
}
```

**Response Data Structure from API:**
```typescript
interface BudgetMatrixResponse {
  motives: Motive[];           // Array of {id, name, budget}
  categories: Category[];      // Array of {id, name, budget}
  matrix: Record<string, number>;  // Map of "{categoryId}_{motiveId}" → budget amount
  grandTotal: number;          // Sum of all budget matrix amounts
  motiveSpending: Record<string, number>;     // Map of motiveId → total spent
  categorySpending: Record<string, number>;   // Map of categoryId → total spent
  cellSpending: Record<string, number>;       // Map of "{categoryId}_{motiveId}" → spent amount
}
```

### UI Component Requirements

**1. Matrix Grid Layout:**
- [ ] Fixed header row displaying motive names as column headers
- [ ] Leftmost column displays category names as row headers
- [ ] Grid cells display budget amount and spending overlay
- [ ] Scrollable horizontally if many motives; vertically if many categories
- [ ] Sticky header row and sticky first column (category names)

**2. Cell Display:**
- [ ] Each cell shows:
  - **Budget amount** (top): The allocated budget from BudgetMatrix table
  - **Spent amount** (bottom): Calculated spending via junction tables
  - **Variance indicator** (color bar or badge): Visual indicator of budget status
- [ ] Format: Currency format (€X,XXX.XX) with German locale
- [ ] Empty/zero cells show "€0.00" or placeholder "—"

**3. Cell Editing (Admin/Owner only):**
- [ ] Client Component island (`"use client"`) for editable cells
- [ ] Click-to-edit: Single click on cell activates inline input
- [ ] Input field accepts decimal numbers ( Euros)
- [ ] Blur or Enter key triggers save action
- [ ] Escape key cancels edit, reverts to original value
- [ ] Visual indicator for cells with unsaved changes (e.g., yellow border, asterisk)

**4. Variance Indicators (Color Coding):**

| Condition | Color | Visual Indicator |
|-----------|-------|------------------|
| Spent ≤ 80% of budget | Green | Green badge or left border |
| 80% < Spent ≤ 100% of budget | Orange/Yellow | Orange badge or warning icon |
| Spent > 100% of budget | Red | Red badge or alert styling |
| No budget set (budget = 0) | Gray | Muted/disabled appearance |

Calculation: `percentUsed = (spentAmount / budgetAmount) × 100`
- Note: When budgetAmount is 0, show "—" or "N/A" to avoid division by zero

**5. Totals Row and Column:**
- [ ] Bottom row: "Total" column showing sums for each motive
  - Budget total: Sum of all budget amounts for that motive across categories
  - Spent total: Sum of all spent amounts for that motive (from motiveSpending)
- [ ] Rightmost column: "Total" row showing sums for each category
  - Budget total: Sum of all budget amounts for that category across motives
  - Spent total: Sum of all spent amounts for that category (from categorySpending)
- [ ] Bottom-right corner: Grand total (sum of all budget cells)

**6. Bulk Save Operation:**
- [ ] "Save All Changes" button enabled only when cells have been modified
- [ ] Button disabled with loading state during save operation
- [ ] Success toast notification on successful save
- [ ] Error handling with retry option on failure

**7. PDF Export:**
- [ ] "Export PDF" button in page header (admin/owner only)
- [ ] PDF generated in **landscape** orientation
- [ ] Color-coded grid matching the UI (variance indicators preserved)
- [ ] Row and column totals included
- [ ] Grand total displayed
- [ ] Project name and export date in header

**8. Loading and Empty States:**
- [ ] Skeleton loader while matrix data fetches (pulsing grid placeholders)
- [ ] Empty state if no motives exist: 
  - Message: "No motives configured — go to Settings to add motives"
  - Link/button to navigate to Settings > Motives
- [ ] Empty state if no categories exist:
  - Message: "No categories configured — go to Settings to add categories"

### Server Action: Bulk Update

**File:** `app/(protected)/budget/actions.ts`

```typescript
"use server";

interface BudgetCellUpdate {
  motiveId: string;
  categoryId: string;
  amount: number;
}

export async function updateBudgetMatrix(cells: BudgetCellUpdate[]) {
  // 1. Verify admin/owner role
  // 2. Validate each cell (motiveId and categoryId belong to project)
  // 3. Prisma upsert for each cell:
  //    - Use @@unique([projectId, motiveId, categoryId]) constraint
  // 4. Return success/error
}
```

**Prisma Upsert Logic:**
```typescript
await prisma.budgetMatrix.upsert({
  where: {
    projectId_motiveId_categoryId: {
      projectId,
      motiveId: cell.motiveId,
      categoryId: cell.categoryId
    }
  },
  update: { amount: cell.amount },
  create: {
    projectId,
    motiveId: cell.motiveId,
    categoryId: cell.categoryId,
    amount: cell.amount
  }
});
```

### Protected Default Handling

Per specification section 5 (Protected Defaults):
- [ ] Category "Uncategorized" and Motive "Default" cannot be renamed or deleted
- [ ] These protected items appear in the matrix with special styling or indicator
- [ ] Sorting: "Default" motive appears first; "Uncategorized" category appears first

## Edge Cases

### Data Edge Cases
- [ ] **Year with no bills**: All spent cells show €0.00, budget cells remain editable
- [ ] **Motive deleted mid-session**: If motive is deleted while admin has matrix open, subsequent save should handle gracefully (ignore deleted motive cells)
- [ ] **Cell value cleared (empty)**: Treated as €0.00 allocation, not null; empty string converted to 0
- [ ] **Very large numbers (>6 digits)**: Cells must not overflow layout; truncate with tooltip showing full value
- [ ] **Division by zero**: When budget is 0 but spending exists, display "∞" or "Over budget" indicator instead of percentage
- [ ] **Negative budget values**: Validate and reject negative inputs; show validation error
- [ ] **Concurrent edits from two admin sessions**: Last-write-wins strategy acceptable at this scale; no optimistic locking required

### UI Edge Cases
- [ ] **Many motives/categories**: Horizontal and vertical scroll with sticky headers; consider max-width columns
- [ ] **Zero motives**: Display empty state with link to Settings
- [ ] **Zero categories**: Display empty state with link to Settings
- [ ] **Single motive/category**: Matrix should still render correctly (minimum 1x1 grid)
- [ ] **Network failure during save**: Error message with "Retry" button; preserve unsaved changes in state
- [ ] **Session timeout during edit**: On save attempt, redirect to login with return URL

### Calculation Edge Cases
- [ ] **Draft bills excluded**: Only bills with status NOT IN ('draft', 'pending', 'rejected') contribute to spending calculations
- [ ] **Bills with 0% allocation**: Bills with no motive/category allocations contribute 0 to spending
- [ ] **Partial allocations**: When bill doesn't have 100% allocation to motives/categories, unallocated portion does not appear in matrix spending
- [ ] **Floating point precision**: Use Decimal type for all currency calculations; round to 2 decimal places for display

### Permission Edge Cases
- [ ] **User role viewing matrix**: Read-only view; no edit controls rendered
- [ ] **Admin demoted to user while editing**: Next save action will fail with auth error; handle gracefully
- [ ] **Project switch while editing**: Warn user about unsaved changes before navigation

## Technical Requirements
- Matrix data fetched server-side in a Server Component via Prisma
- Inline edit uses a Client Component island (`"use client"`) for the cell input
- Bulk save uses a Next.js Server Action
- Branch: `to_nextjs`

### Database Schema References

**BudgetMatrix Model:**
```prisma
model BudgetMatrix {
  id         String  @id @default(uuid())
  projectId  String
  motiveId   String
  categoryId String
  amount     Decimal @default(0)

  project  Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  motive   Motive   @relation(fields: [motiveId], references: [id], onDelete: Cascade)
  category Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)

  @@unique([projectId, motiveId, categoryId])
  @@index([projectId])
  @@index([motiveId])
  @@index([categoryId])
}
```

**Related Models:**
- `Motive`: id, projectId, name, budget
- `Category`: id, projectId, name, budget  
- `BillMotive`: billId, motiveId, percentage
- `BillCategory`: billId, categoryId, percentage
- `Bill`: id, projectId, nettoAmount, status

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Overview
PROJ-8 ports the **Budget Matrix feature** from the Express/SQLite app to Next.js/PostgreSQL. This is a planning tool where admins allocate budgets across Categories (rows) and Motives (columns), then track actual spending calculated from Bills via junction tables.

**Existing Code to Port:**
- Backend: `routes/budget.js` (114 lines) - Matrix data queries and bulk update endpoint
- Frontend: Vanilla JS matrix grid with inline editing (to be rewritten in React)

### Component Structure (Visual Tree)

```
Budget Matrix Page (/budget)
├── Server Component: page.tsx
│   ├── Header Section
│   │   ├── Title "Budget Matrix"
│   │   ├── Year Selector (dropdown - future use)
│   │   ├── "Export PDF" Button (admin/owner only)
│   │   └── "Save All Changes" Button (admin/owner only, disabled when no changes)
│   └── Matrix Container
│       ├── Empty State (if no motives or categories)
│       │   └── Link to Settings > Motives/Categories
│       ├── Loading Skeleton (while data fetches)
│       │   └── Pulsing grid placeholders
│       └── Matrix Grid (Client Component)
│           ├── Sticky Header Row
│           │   ├── Corner Cell (empty)
│           │   ├── Motive Columns (sorted: "Default" first)
│           │   └── Total Column
│           ├── Scrollable Body
│           │   └── Category Rows (sorted: "Uncategorized" first)
│           │       ├── Row Header (category name)
│           │       ├── Data Cells (editable for admin)
│           │       │   ├── Budget Amount (top)
│           │       │   ├── Spent Amount (bottom)
│           │       │   └── Variance Indicator (color bar)
│           │       └── Row Total Cell
│           └── Footer Row (Totals)
│               ├── "Total Budget" label
│               ├── Motive Budget Totals
│               └── Grand Total
│
Client Component: BudgetMatrixGrid
├── State: matrix data, modified cells, loading state
├── Effect: Fetch data via API on mount
├── Handlers:
│   ├── onCellEditStart() - Enter edit mode
│   ├── onCellEditCancel() - Revert changes
│   ├── onCellEditSave() - Update local state
│   └── onBulkSave() - Submit all changes to Server Action
└── Render:
    ├── MatrixHeader (sticky)
    ├── MatrixBody (scrollable)
    └── SaveStatusIndicator

Client Component: BudgetMatrixCell
├── Display Mode:
│   ├── Budget amount (formatted currency)
│   ├── Spent amount (formatted, gray)
│   └── Variance badge (green/orange/red/gray)
└── Edit Mode (admin only, on click):
    ├── Number input (€ amount)
    ├── Enter/Blur to save
    ├── Escape to cancel
    └── Visual indicator for unsaved changes
```

### Data Model (Plain Language)

**Core Entities:**
- **Motive** — A spending purpose (e.g., "Production", "Marketing"). Has a name and default budget. Protected: "Default" cannot be renamed/deleted.
- **Category** — An expense type (e.g., "Equipment", "Travel"). Has a name and default budget. Protected: "Uncategorized" cannot be renamed/deleted.
- **BudgetMatrix Cell** — Stores the allocated budget amount for one Motive + Category intersection. Composite unique key: (projectId, motiveId, categoryId).

**Spending Calculations:**
- **Motive Spending** — Sum of net bill amounts × motive percentage allocation (from BillMotive junction table). Excludes draft/pending/rejected bills.
- **Category Spending** — Sum of net bill amounts × category percentage allocation (from BillCategory junction table). Excludes draft/pending/rejected bills.
- **Cell Spending (Motive × Category)** — Sum of net bill amounts × motive% × category%. This represents the actual spending that falls in both a specific motive AND category.

**Storage:**
- All data stored in PostgreSQL via Prisma ORM
- BudgetMatrix table stores only explicitly set allocations (sparse)
- Missing cells default to €0 budget

### Tech Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Data Fetching** | Server Component for initial load | Fetches motives, categories, matrix cells, and spending calculations server-side for fast initial render |
| **Cell Editing** | Client Component island | Interactive editing requires local state for tracking modifications; keeps Server Component clean |
| **Save Strategy** | Bulk Server Action | Single API call for all modified cells reduces network overhead and ensures atomic updates |
| **State Management** | React useState + useReducer | Sufficient for matrix state; no need for external state library |
| **PDF Generation** | PDFKit (server-side) | Already used in Express; consistent output with existing reports. Generates binary PDF for download. |
| **Sorting** | Client-side | Motives and categories lists are small (< 50 each); sorting can happen client-side after fetch |
| **Real-time Updates** | Manual refresh | No WebSocket/SSE needed; users manually save changes and refresh to see updated spending |

**Why Server Component + Client Islands:**
- Server Component handles complex Prisma queries (6 queries including raw SQL for spending calculations)
- Initial HTML render has no loading flicker
- Client Components only loaded for editable areas, reducing JS bundle

**Why Not React Table Library:**
- Matrix is not a standard table (cells are intersections, not records)
- Custom grid layout gives better control for sticky headers/rows
- Existing DataTable component (used in Bills) is row-oriented, not suitable for matrix

### Code Reuse Opportunities

**From routes/budget.js (Express):**
1. **Spending calculation SQL patterns** — The three raw SQL queries for motive spending, category spending, and cell spending can be ported to Prisma `$queryRaw` almost verbatim
2. **Matrix key format** — Using `"{categoryId}_{motiveId}"` as lookup key pattern proven in Express
3. **Bulk upsert logic** — Transaction pattern for saving multiple cells translates to Prisma `upsert` in a loop

**From PROJ-7 Bills Feature:**
1. **Admin role checking** — Same pattern: `session?.user?.role === 'admin' \|\| session?.user?.role === 'superadmin'`
2. **Loading skeleton** — DataTable skeleton animation style can be adapted for matrix grid
3. **Currency formatting** — German locale (€X.XXX,XX) already implemented
4. **Error toast pattern** — Toast notifications for save success/failure
5. **API client pattern** — Fetch wrapper with error handling in `lib/api/`

**From existing UI components:**
1. **DataTable styling** — Table header/footer background colors, cell padding, border styles
2. **Color scheme** — Green/orange/red variance indicators match existing status badges
3. **Empty state pattern** — Centered message with CTA button

### API Design

| Route | Method | Access | Description |
|-------|--------|--------|-------------|
| `/api/budget-matrix` | GET | Project Access | Returns complete matrix data (motives, categories, cells, spending) |
| `/api/budget-matrix/bulk-update` | POST | Admin/Owner Only | Bulk upsert of modified cells |
| `/api/reports/budget-matrix/pdf` | GET | Project Access | Download matrix as PDF (used by PROJ-11) |

### Dependencies

**New packages required:**
- `pdfkit` - PDF generation for matrix export (already planned for PROJ-11)

**Existing packages used:**
- `@prisma/client` - Database access
- `next-auth` - Authentication/session
- `zod` - Input validation (Server Action)

### Security Considerations

1. **Admin-only mutations** — Server Action verifies admin/owner role before any database writes
2. **Project scoping** — All queries include `projectId` from session to prevent cross-project data leakage
3. **Input validation** — Zod schema validates cell updates (positive numbers, valid UUIDs)
4. **Rate limiting** — Bulk save should have rate limiting (consider `@upstash/ratelimit`)

### Performance Considerations

1. **Query optimization** — 6 parallel queries on initial load; raw SQL for spending calculations is faster than Prisma nested queries
2. **Bundle size** — Matrix grid is a single Client Component; rest is server-rendered
3. **Memory** — Matrix data size is bounded (categories × motives, typically < 500 cells)
4. **PDF generation** — Server-side only; stream response to client

## Architecture Review
**Reviewed:** 2026-03-06 | **Verdict:** Ready with one simplification

### ⚠️ Custom Grid Component — Slight Over-Engineering
The spec proposes a custom `BudgetMatrixGrid` Client Component with a custom `BudgetMatrixCell`. The original Express implementation is a plain HTML table with inline editing (`routes/budget.js` is only 114 lines).

**Recommendation:** Use a native `<table>` with CSS `position: sticky` for the header row and first column instead of a custom grid component. This:
- Keeps the implementation close to the original
- Reduces JS bundle size
- Is simpler to maintain
- Achieves the same sticky header/column effect

**What stays the same:**
- Server Component for initial data fetch (6 Prisma queries) ✅
- Client island for inline editing ✅
- Bulk Server Action for saving changes ✅
- All spending SQL queries port directly ✅

### No Other Concerns
Route Handler vs Server Action split is correct. Data shape matches Express response exactly.

---

## QA Test Results

**Tested:** 2026-03-06
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)

### Acceptance Criteria Status

| AC | Criterion | Status | Notes |
|----|-----------|--------|-------|
| AC-1 | Page Structure & Routing | ✅ PASS | All sub-criteria verified in code |
| AC-2 | Data Fetching | ✅ PASS | Sorting and calculations correct |
| AC-3 | Matrix Grid Layout | ✅ PASS | Sticky headers implemented |
| AC-4 | Cell Display | ✅ PASS | Currency formatting correct |
| AC-5 | Variance Indicators | ✅ PASS | Green/Amber/Red/Gray logic correct |
| AC-6 | Cell Editing | ⚠️ PARTIAL | Missing unsaved changes indicator (Bug B-1) |
| AC-7 | Totals Row and Column | ✅ PASS | All totals calculated correctly |
| AC-8 | Bulk Save Operation | ✅ PASS | Toast notifications working |
| AC-9 | Protected Defaults | ✅ PASS | Default/Uncategorized sorting correct |
| AC-10 | Empty States | ⚠️ PARTIAL | Missing skeleton loader (Bug B-2) |
| AC-11 | API Endpoints | ✅ PASS | Auth and responses correct |

**Acceptance Criteria: 9/11 fully passed, 2 partial**

### Edge Cases Status

| EC | Edge Case | Status | Notes |
|----|-----------|--------|-------|
| EC-1 | Year with no bills | ✅ PASS | Shows €0.00 correctly |
| EC-2 | Motive deleted mid-session | ⚠️ UNCERTAIN | No explicit handling (Bug B-3) |
| EC-3 | Cell value cleared | ✅ PASS | Treated as €0.00 |
| EC-4 | Very large numbers | ❌ FAIL | May overflow layout (Bug B-4) |
| EC-5 | Division by zero | ✅ PASS | Shows "—" indicator |
| EC-6 | Negative budget values | ✅ PASS | Zod validation rejects |
| EC-7 | Concurrent edits | ✅ PASS | Last-write-wins acceptable |
| EC-8 | Many motives/categories | ✅ PASS | Scroll with sticky headers |
| EC-9 | Zero motives/categories | ✅ PASS | Empty states displayed |
| EC-10 | Single motive/category | ✅ PASS | 1x1 grid renders |
| EC-11 | Network failure on save | ⚠️ UNCERTAIN | No retry button (Bug B-5) |
| EC-12 | Session timeout | ❌ FAIL | Not handled gracefully (Bug B-6) |
| EC-13 | Draft bills excluded | ✅ PASS | SQL filter correct |
| EC-14 | Floating point precision | ⚠️ UNCERTAIN | Using Number not Decimal (Bug B-7) |

### Security Audit Results

| Check | Status | Notes |
|-------|--------|-------|
| Authentication required | ✅ PASS | 401 returned for unauthenticated |
| User cannot edit matrix | ✅ PASS | 403 returned for non-admin |
| Cross-project data isolation | ✅ PASS | All queries scoped to projectId |
| Super admin access | ✅ PASS | Can access all projects |
| Negative amounts rejected | ✅ PASS | Zod validation |
| Non-numeric values rejected | ✅ PASS | Zod validation |
| SQL injection prevention | ✅ PASS | Parameterized queries |
| **Rate limiting** | ❌ **FAIL** | **No rate limiting on bulk update (Bug B-9 - HIGH)** |
| Data exposure check | ✅ PASS | No sensitive data leaked |

### Bugs Found

#### B-1: Missing Visual Indicator for Unsaved Changes
- **Severity:** Medium
- **Skill:** [Frontend]
- **Steps to Reproduce:**
  1. Login as admin
  2. Navigate to Budget Matrix
  3. Click a cell to edit
  4. Change the value
  5. Click elsewhere (blur to save locally)
  6. Expected: Cell shows visual indicator (yellow border, asterisk) that it's been modified but not saved to server
  7. Actual: No visual distinction between saved and unsaved cells
- **Priority:** Fix in next sprint

#### B-2: Missing Skeleton Loader During Data Fetch
- **Severity:** Low
- **Skill:** [Frontend]
- **Steps to Reproduce:**
  1. Navigate to Budget Matrix with slow network
  2. Expected: Skeleton loader (pulsing grid placeholders) while data fetches
  3. Actual: No loading state, page may appear blank briefly
- **Priority:** Nice to have

#### B-3: No Graceful Handling of Mid-Session Motive Deletion
- **Severity:** Low
- **Skill:** [Backend]
- **Steps to Reproduce:**
  1. Admin A opens Budget Matrix
  2. Admin B deletes a motive
  3. Admin A tries to save a cell for deleted motive
  4. Expected: Graceful handling, cell ignored or clear error message
  5. Actual: Uncertain - may cause database error
- **Priority:** Nice to have

#### B-4: Very Large Numbers May Overflow Cell Layout
- **Severity:** Medium
- **Skill:** [Frontend]
- **Steps to Reproduce:**
  1. Edit a cell
  2. Enter very large amount (e.g., €999,999,999.99)
  3. Expected: Cell handles gracefully (truncation, tooltip, or overflow)
  4. Actual: No max-width or overflow handling, may break layout
- **Priority:** Fix in next sprint

#### B-5: Network Failure Shows Error But No Retry Button
- **Severity:** Low
- **Skill:** [Frontend]
- **Steps to Reproduce:**
  1. Modify a cell
  2. Disconnect network
  3. Click Save Changes
  4. Expected: Error toast with "Retry" button to resubmit
  5. Actual: Error toast only, user must manually click Save again
- **Priority:** Nice to have

#### B-6: Session Timeout During Edit Not Handled Gracefully
- **Severity:** Medium
- **Skill:** [Frontend]
- **Steps to Reproduce:**
  1. Edit multiple cells
  2. Let session expire
  3. Try to save
  4. Expected: Redirect to login with return URL, preserve changes
  5. Actual: Generic error message, changes may be lost
- **Priority:** Fix in next sprint

#### B-7: Potential Floating Point Precision Issues
- **Severity:** Low
- **Skill:** [Backend]
- **Steps to Reproduce:**
  1. Complex spending calculations with many bills
  2. Expected: Precise decimal calculations (2 decimal places)
  3. Actual: JavaScript Number type may have floating point errors
- **Priority:** Nice to have

#### B-8: No Warning for Unsaved Changes on Project Switch
- **Severity:** Medium
- **Skill:** [Frontend]
- **Steps to Reproduce:**
  1. Edit budget cells (don't save)
  2. Switch project via sidebar
  3. Expected: Warning dialog "You have unsaved changes. Leave anyway?"
  4. Actual: Navigation proceeds, changes lost
- **Priority:** Fix in next sprint

#### B-9: Missing Rate Limiting on Bulk Update API [HIGH SEVERITY]
- **Severity:** High
- **Skill:** [Backend]
- **Steps to Reproduce:**
  1. Login as admin
  2. Send rapid-fire POST requests to /api/budget-matrix/bulk-update
  3. Expected: Rate limiting prevents abuse (429 Too Many Requests)
  4. Actual: No rate limiting, potential for DoS or data corruption
- **Priority:** Fix before deployment
- **Security Impact:** Could allow malicious users to overwhelm database with bulk updates

### Summary

- **Acceptance Criteria:** 9/11 fully passed (82%), 2 partial
- **Edge Cases:** 9/14 handled correctly (64%), 3 uncertain, 2 fail
- **Security:** 8/9 checks passed (89%), 1 high severity issue
- **Regression:** All 4 deployed features verified working
- **Bugs Found:** 9 total (1 High, 5 Medium, 3 Low)

**Production Ready:** NO

**Recommendation:** Fix Bug B-9 (rate limiting) before deployment. Address B-1, B-4, B-6, B-8 in next sprint. B-2, B-3, B-5, B-7 are nice-to-have improvements.

## Deployment
_To be added by /deploy_

## Open Bug Reports

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| [BUG-15](BUG-15-budget-matrix-sql-column-error.md) | Critical | Budget Matrix SQL Query Uses Wrong Column Names | Resolved |
| [BUG-16](BUG-16-budget-prisma-enum-error.md) | Critical | Budget Page Crashes with Prisma Enum Error | Resolved |
| B-1 (QA) | Medium | Missing visual indicator for unsaved cell changes | Open [Frontend] |
| B-2 (QA) | Low | No skeleton loader during data fetch | Open [Frontend] |
| B-3 (QA) | Low | No graceful handling if motive deleted mid-session | Open [Backend] |
| B-4 (QA) | Medium | Very large numbers may overflow cell layout | Open [Frontend] |
| B-5 (QA) | Low | Network failure shows error but no retry button | Open [Frontend] |
| B-6 (QA) | Medium | Session timeout during edit not handled gracefully | Open [Frontend] |
| B-7 (QA) | Low | Potential floating point precision issues | Open [Backend] |
| B-8 (QA) | Medium | No warning for unsaved changes on project switch | Open [Frontend] |
| B-9 (QA) | **High** | **Missing rate limiting on bulk update API** | **Open [Backend]** |
| [BUG-26](BUG-26-budget-billstatus-enum-draft.md) | Critical | Budget Page Crashes with Invalid BillStatus Enum Value "draft" | Resolved |

## Change Requests

### CR-9: Budget Matrix Express Parity — Interactive Motives/Categories, Cell UX, Visual Appearance
**Requested:** 2026-03-07 | **Priority:** High | **Status:** Pending Review

**Current Behavior:**
The Next.js budget matrix is functional but stripped-down compared to the original Express app. Key missing capabilities:
- Motives and categories can only be created/renamed/deleted via dedicated Settings pages (not inline in the matrix)
- Cells show budget and spent amounts but have no color-coded status (ok/warn/over/neg)
- No hover tooltip showing budget, spent, remaining, and % consumed per cell
- The matrix does not indicate live totals as you type — totals only update on save
- Column/row header focus behavior is missing (select-all on focus, format on blur)
- Visual appearance differs significantly from the Express original

**Desired Behavior:**
Bring the Next.js budget matrix to full parity with the original Express app:

1. **Inline motive management (columns):** An "+ Add motive" input directly in the matrix header row. Pencil icon to rename inline (Enter confirms, Esc cancels). × button to delete with confirm dialog.
2. **Inline category management (rows):** An "+ Add category" input row at the bottom of the matrix. Pencil rename + × delete same as above.
3. **Cell color coding:**
   - `bm-cell-ok` (green tint): spending > 0, < 80% of budget
   - `bm-cell-warn` (amber tint): spending ≥ 80% of budget
   - `bm-cell-over` (red tint): spending ≥ 100% of budget
   - `bm-cell-neg` (gray tint): spending exists but budget is 0
4. **Cell hover tooltip:** Shows "Budget / Ausgaben / Verbleibend / Verbraucht %" for each cell, row total, and column total.
5. **Live totals:** Row totals and column totals update as you type in cells (before saving).
6. **Cell focus behavior:** On focus, show raw number and select all. On blur, reformat with comma-decimal (e.g., `1,234.56`).
7. **Horizontal scroll with sticky corner:** First column (category names) stays fixed; matrix scrolls right. Uses `scroll-padding-left` equal to sticky corner width.
8. **Visual appearance alignment:** Match the overall look of the Express original (header styling, cell borders, font sizes).

**Rationale:**
The Express app is the production reference. Users switching to the Next.js app expect the same interactivity. Inline motive/category management is a core workflow — forcing users to leave the matrix to add a column is a significant UX regression.

**Proposed Acceptance Criteria:**
- [ ] "+ Add motive" button/input in the header row creates a new motive inline
- [ ] Pencil rename of motive works inline (Enter/Esc) in the header row
- [ ] × delete motive shows confirm dialog, then removes the column
- [ ] "+ Add category" button/input at bottom of matrix creates a new category row inline
- [ ] Pencil rename of category works inline in the row header
- [ ] × delete category shows confirm dialog, then removes the row
- [ ] Cells have color classes based on spent vs budget percentage (ok/warn/over/neg)
- [ ] Hovering a cell shows tooltip with budget, spent, remaining, % consumed
- [ ] Row and column totals update live as user types (before save)
- [ ] Cell focus: show raw number + select all; blur: reformat to locale string
- [ ] Matrix scrolls horizontally with category column sticky (does not scroll)
- [ ] Visual appearance matches Express original closely

**Resolution:** Pending
