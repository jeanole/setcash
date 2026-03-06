# PROJ-8: Budget Matrix

## Status: Complete
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
_To be added by /qa_

## Deployment
_To be added by /deploy_

## Open Bug Reports

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| [BUG-15](BUG-15-budget-matrix-sql-column-error.md) | Critical | Budget Matrix SQL Query Uses Wrong Column Names | Resolved |
