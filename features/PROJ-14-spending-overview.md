# PROJ-14: Spending Overview

## Status: Planned
**Created:** 2026-03-04
**Last Updated:** 2026-03-04

## Dependencies
- Requires: PROJ-5 (NextAuth.js auth — protected routes)
- Requires: PROJ-6 (PostgreSQL data available via Prisma)
- Requires: PROJ-7 (Bills feature — spending data source)
- Requires: PROJ-9 (Categories & Motives — budget allocation axes)

## User Stories
- As a user, I want to see spending by motive so that I understand where money is going.
- As a user, I want to see spending by category so that I can track expenses across different types.
- As an admin, I want to see budget vs spent comparison so that I can identify overspending.
- As a user, I want to see color-coded spending indicators (green/orange/red) so that I can quickly spot budget issues.
- As an admin, I want to see remaining budget per motive/category so that I can plan future spending.

## Acceptance Criteria

### Page Structure
- [ ] **Page Route:** `/app/(protected)/spending/page.tsx` — spending overview page
- [ ] **Tab Navigation:** Two tabs at the top of the page:
  - Tab 1: "By Motive" (default active)
  - Tab 2: "By Category"
  - Tab switching does not reload the page (client-side state)

### By Motive Tab
- [ ] **Table Columns (left to right):**
  1. **Motive Name** — display name from `motives` table
  2. **Budget** — total budget from `budget_matrix` (sum of all category allocations for this motive) or from `motives.budget` if matrix not used
  3. **Spent** — calculated netto amount (see Calculation Formulas below)
  4. **Remaining** — Budget - Spent (can be negative)
  5. **% Used** — (Spent / Budget) × 100, formatted with 1 decimal place (e.g., "85.3%")

- [ ] **Spending Calculation Formula (Motive):**
  ```sql
  SELECT bm.motive_id, SUM(b.netto_amount * bm.percentage / 100) as spent
  FROM bill_motives bm 
  JOIN bills b ON b.id = bm.bill_id
  WHERE b.project_id = ? 
    AND (b.status IS NULL OR b.status = 'confirmed')
  GROUP BY bm.motive_id
  ```

- [ ] **Unallocated Bills Row:** If bills exist with NO motive allocations (not in `bill_motives`), display a row:
  - Name: "(unallocated)" in italics/gray
  - Budget: €0.00
  - Spent: Sum of `netto_amount` for all bills not in `bill_motives`
  - Remaining: negative of spent amount
  - % Used: "—" (dash, no percentage)

### By Category Tab
- [ ] **Table Columns (left to right):**
  1. **Category Name** — display name from `categories` table
  2. **Budget** — total budget from `budget_matrix` (sum of all motive allocations for this category) or from `categories.budget` if matrix not used
  3. **Spent** — calculated netto amount (see Calculation Formulas below)
  4. **Remaining** — Budget - Spent (can be negative)
  5. **% Used** — (Spent / Budget) × 100, formatted with 1 decimal place

- [ ] **Spending Calculation Formula (Category):**
  ```sql
  SELECT bc.category_id, SUM(b.netto_amount * bc.percentage / 100) as spent
  FROM bill_categories bc 
  JOIN bills b ON b.id = bc.bill_id
  WHERE b.project_id = ? 
    AND (b.status IS NULL OR b.status = 'confirmed')
  GROUP BY bc.category_id
  ```

- [ ] **Unallocated Bills Row:** If bills exist with NO category allocations (not in `bill_categories`), display a row:
  - Name: "(unallocated)" in italics/gray
  - Budget: €0.00
  - Spent: Sum of `netto_amount` for all bills not in `bill_categories`
  - Remaining: negative of spent amount
  - % Used: "—" (dash, no percentage)

### Color Coding on % Used Column
- [ ] **Green:** < 80% budget used (`percent < 80`)
- [ ] **Orange:** 80% to 99.9% budget used (`percent >= 80 AND percent < 100`)
- [ ] **Red:** ≥ 100% budget used (`percent >= 100` OR spent > budget)
- [ ] Color indicator appears as a colored dot or pill next to the percentage value

### Grand Totals Row
- [ ] **Fixed bottom row** with label "TOTAL" in bold
- [ ] **Columns:**
  - Name: "TOTAL" (bold)
  - Budget: Sum of all motive/category budgets
  - Spent: Sum of all motive/category spent amounts
  - Remaining: Total Budget - Total Spent
  - % Used: (Total Spent / Total Budget) × 100, formatted with 1 decimal place
- [ ] Totals row has a top border/divider to separate from data rows
- [ ] Totals row has a light gray background tint

### Calculation Rules (Critical)
- [ ] **Netto amounts only:** Use `bills.netto_amount` column (already calculated from brutto tiers)
- [ ] **Confirmed bills only:** Include bills where `status IS NULL OR status = 'confirmed'`
- [ ] **Exclude drafts:** Bills with `status = 'draft'` are NEVER included in spending calculations
- [ ] **Junction table logic:** Spending is allocated proportionally via `bill_motives.percentage` and `bill_categories.percentage`:
  - For each bill-motive allocation: `allocated = bill.netto_amount × percentage / 100`
  - For each bill-category allocation: `allocated = bill.netto_amount × percentage / 100`
- [ ] **Project-scoped:** All queries filtered by `project_id` from current session

### Data Display Format
- [ ] **Currency format:** €X,XXX.XX (German locale: €1.234,56)
- [ ] **Percentage format:** X.X% (e.g., 85.3%)
- [ ] **Negative numbers:** Display with minus sign: -€123.45
- [ ] **Zero values:** Display as €0.00
- [ ] **Large numbers:** Format with thousands separators, no overflow (max 999,999,999.99)

### UI States
- [ ] **Loading state:** Skeleton table with 5 rows while data fetches
- [ ] **Empty state (no bills):** Display message "No spending recorded yet" with optional icon
- [ ] **Empty state (no motives/categories):** Display "No budget items configured" with link to Settings page
- [ ] **Error state:** If data fetch fails, display error message with retry button

### Access Control
- [ ] Page is **read-only** for all users (no editing of spending data)
- [ ] All authenticated project members can view spending
- [ ] Data is scoped to current project from session

## Edge Cases

### EC-1: No Bills in Project
- **Scenario:** Project exists but has zero bills
- **Expected:** Empty state with "No spending recorded yet" message
- **Totals row:** All zeros, % Used shows "—"

### EC-2: All Bills Are Drafts
- **Scenario:** Bills exist but all have `status = 'draft'`
- **Expected:** All spending columns show €0.00
- **Totals row:** All zeros

### EC-3: Budget is €0 but There is Spending
- **Scenario:** Motive/category has budget=0 but bills are allocated to it
- **Expected:** 
  - Remaining = -Spent (negative)
  - % Used shows "∞" or "100%+" in red
  - Color coding: Red (over budget)

### EC-4: No Motives/Categories Configured
- **Scenario:** Project has no motives or categories in database
- **Expected:** Empty state with "No budget items configured" and link to Settings

### EC-5: Very Large Numbers (> 6 digits)
- **Scenario:** Budget or spending exceeds €999,999
- **Expected:** Format with thousands separators (e.g., €1.234.567,89), table cells handle overflow gracefully

### EC-6: Deleted Motive/Category with Historic Bills
- **Scenario:** Motive/category was deleted but historic bills still reference it via allocations
- **Expected:** 
  - Show row with name "(deleted)" in gray/italic
  - Budget: €0.00 (deleted items have no budget)
  - Spending: Still calculated from historic allocations
  - % Used: "—" (dash, cannot calculate without budget)

### EC-7: Bills Without Any Allocations
- **Scenario:** Bills exist but have no entries in `bill_motives` or `bill_categories`
- **Expected:** Show "(unallocated)" row with spending from these bills

### EC-8: Bill with Partial Allocations (< 100%)
- **Scenario:** Bill has motive allocations summing to < 100% (e.g., only 70% allocated)
- **Expected:** Only the allocated portion is counted; remaining 30% is effectively "lost" from spending (matches Express behavior)

### EC-9: Bill with No Netto Amount
- **Scenario:** Bill has `netto_amount = NULL` or `0`
- **Expected:** Contributes €0.00 to spending (no division by zero risk)

### EC-10: Division by Zero in % Used
- **Scenario:** Budget = 0 but spending > 0
- **Expected:** Display "—" or "∞" instead of calculating percentage

### EC-11: Negative Remaining Budget Display
- **Scenario:** Spent > Budget
- **Expected:** Remaining shows negative value in red (e.g., -€1,234.56)

### EC-12: Project Switch While Viewing
- **Scenario:** User switches projects via sidebar while on Spending page
- **Expected:** Page reloads with new project's data (no stale data from previous project)

## Technical Requirements
- Server Component for data fetching via Prisma
- Calculate spending using bill allocations (junction tables)
- Color thresholds: Green < 80%, Orange 80-99.9%, Red ≥ 100%
- Use project-scoped queries via session
- Branch: `to_nextjs`

## Database Query Reference

### Spending by Motive (Prisma)
```typescript
// Group spending by motive via junction table
const motiveSpending = await prisma.billMotive.groupBy({
  by: ['motiveId'],
  _sum: {
    allocatedAmount: true, // calculated field: bill.netto_amount * percentage / 100
  },
  where: {
    bill: {
      projectId: session.currentProjectId,
      OR: [
        { status: null },
        { status: 'confirmed' }
      ]
    }
  }
});
```

### Spending by Category (Prisma)
```typescript
// Group spending by category via junction table
const categorySpending = await prisma.billCategory.groupBy({
  by: ['categoryId'],
  _sum: {
    allocatedAmount: true, // calculated field: bill.netto_amount * percentage / 100
  },
  where: {
    bill: {
      projectId: session.currentProjectId,
      OR: [
        { status: null },
        { status: 'confirmed' }
      ]
    }
  }
});
```

### Unallocated Bills Query
```typescript
// Bills not in any motive allocation
const unallocatedMotives = await prisma.bill.aggregate({
  _sum: { nettoAmount: true },
  where: {
    projectId: session.currentProjectId,
    OR: [{ status: null }, { status: 'confirmed' }],
    motives: { none: {} } // no bill_motives records
  }
});

// Bills not in any category allocation
const unallocatedCategories = await prisma.bill.aggregate({
  _sum: { nettoAmount: true },
  where: {
    projectId: session.currentProjectId,
    OR: [{ status: null }, { status: 'confirmed' }],
    categories: { none: {} } // no bill_categories records
  }
});
```

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Overview
PROJ-14 creates a **read-only spending dashboard** that visualizes budget utilization across two dimensions: Motives (budget purposes) and Categories (expense types). The page provides at-a-glance budget health through color-coded indicators and detailed spending breakdowns.

**Existing Code to Leverage:**
- Backend: `routes/budget.js` — spending calculation logic via junction tables
- Frontend: `components/ui/DataTable.tsx` — reusable table component from PROJ-7
- Patterns: `app/(protected)/bills/page.tsx` — data fetching and loading states

---

### Component Structure (Visual Tree)

```
Spending Overview Page (/spending)
├── Page Header
│   ├── Title "Spending Overview"
│   └── Subtitle "Track budget utilization by motive and category"
│
├── Tab Navigation (client-side state, no page reload)
│   ├── Tab 1: "By Motive" (default active)
│   └── Tab 2: "By Category"
│
├── Tab Panel: By Motive
│   ├── SpendingTable (reusable DataTable variant)
│   │   ├── Header Row: Motive | Budget | Spent | Remaining | % Used
│   │   ├── Data Rows: One per motive + "(unallocated)" row
│   │   │   └── % Used Column: Color-coded indicator (dot/pill)
│   │   │       ├── Green dot: < 80% used
│   │   │       ├── Orange dot: 80-99% used
│   │   │       └── Red dot: ≥ 100% used
│   │   └── Grand Totals Row (fixed bottom, gray background)
│   │       ├── Label: "TOTAL" (bold)
│   │       ├── Budget: Sum of all motive budgets
│   │       ├── Spent: Sum of all motive spending
│   │       ├── Remaining: Total Budget - Total Spent
│   │       └── % Used: Overall utilization percentage
│   └── Empty State (when no motives configured)
│       ├── Message: "No budget items configured"
│       └── Action: Link to Settings page
│
├── Tab Panel: By Category
│   └── (Same structure as By Motive, data grouped by category)
│
├── Loading State (while fetching)
│   └── Skeleton table with 5 placeholder rows
│
└── Error State (on fetch failure)
    ├── Error message
    └── Retry button
```

**Special Row Types:**
- **(unallocated)**: Gray/italic row for bills with no motive/category allocations
- **(deleted)**: Gray/italic row for deleted motives/categories with historic spending
- **∞ indicator**: When budget = €0 but spending > €0, show infinity symbol in red

---

### Data Model (Plain Language)

**Budget Sources:**
Each motive and category has a budget stored in the database. Budgets can come from:
- `motives.budget` / `categories.budget` — simple per-item budget
- `budget_matrix` — cross-dimensional allocations (motive × category intersections)

**Spending Calculation:**
Spending is calculated from **confirmed bills only** (draft bills are excluded):
1. For each bill, take its `netto_amount` (pre-calculated from brutto tiers)
2. Look up allocations in junction tables (`bill_motives`, `bill_categories`)
3. Apply percentage: `allocated_amount = netto_amount × percentage / 100`
4. Sum all allocated amounts per motive/category

**Junction Table Logic:**
- `BillMotive` — links bills to motives with a percentage split
- `BillCategory` — links bills to categories with a percentage split
- A bill can be split across multiple motives (e.g., 70% Project A, 30% Project B)
- Unallocated portions are NOT counted in spending (matches existing Express behavior)

**Grand Totals:**
- Sum of all visible rows (motives/categories + unallocated if present)
- Calculated independently for each tab
- Color coding applies to overall % used

---

### Tech Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Tab Implementation** | URL query param (`?tab=motive` or `?tab=category`) | Allows direct linking to specific view; syncs with browser history; easy to implement with `useSearchParams` |
| **Data Fetching** | Server Component + async data fetch | Spending calculations are compute-intensive; server-side keeps bundle small; leverages existing Prisma patterns |
| **Color Thresholds** | Tailwind classes: `emerald-500` (green), `amber-500` (orange), `rose-500` (red) | Consistent with vBudget design system; accessible color contrast |
| **Color Indicator Style** | Small circular dot (8px) next to percentage | Compact, scannable, universally understood pattern |
| **Currency Formatting** | German locale: `€1.234,56` | Matches existing Express app behavior; user expectation for German market |
| **Loading State** | Skeleton rows (pulsing gray bars) | Consistent with PROJ-7 bills table; perceived performance boost |
| **Empty States** | Dedicated messages + action links | Clear next steps for users; reduces confusion |
| **Project Switching** | Automatic data refresh on `currentProjectId` change | Uses existing session-based project scoping; no stale data |

**Calculation Location:**
- **Server-side**: All aggregation queries run in the Server Component
- **Client-side**: Only percentage formatting and color determination
- **Rationale**: Prisma's aggregation (`groupBy`, `_sum`) is more efficient than fetching all bills and calculating client-side

**Data Refresh Strategy:**
- Page uses Next.js `revalidatePath` pattern for mutations (if any parent components modify bills)
- On project switch: Full page re-render with new project data
- No real-time updates required (spending changes when bills change)

---

### Code Reuse Opportunities

**From PROJ-7 (Bills Feature):**

| Component/Pattern | Reuse in PROJ-14 | Notes |
|-------------------|------------------|-------|
| `DataTable.tsx` | Yes — base table component | Add support for footer row (totals) |
| `useBills.ts` hook pattern | Adapt — spending-specific hook | Create `useSpending.ts` for spending data |
| Loading skeleton | Yes — same pulse animation | 5 rows for consistency |
| Empty state pattern | Yes — icon + message + CTA | Adapt messaging for spending context |
| German currency formatter | Yes — extract to utility | `formatCurrency(value)` helper |
| Session-based project scoping | Yes — same pattern | `session.user.currentProjectId` |

**From Express (`routes/budget.js`):**

| Logic | Reuse Approach |
|-------|----------------|
| Motive spending aggregation | Port SQL to Prisma `groupBy` |
| Category spending aggregation | Port SQL to Prisma `groupBy` |
| Unallocated bills query | Port SQL to Prisma `aggregate` with `none` relation filter |
| Confirmed-only filter | Reuse: `status: null OR 'confirmed'` |
| Netto amount calculation | Already in `bills.netto_amount` column |

**New Components to Build:**
- `SpendingTable` — wraps DataTable with spending-specific columns and totals row
- `SpendingProgress` — color-coded dot + percentage display
- `SpendingTabs` — tab navigation with URL state management

---

### Dependencies

**No new packages required.** All functionality uses existing dependencies:

| Package | Purpose |
|---------|---------|
| `next` | Server Components, routing, `useSearchParams` |
| `@prisma/client` | Database queries, aggregation |
| `next-auth` | Session access for project scoping |
| `tailwindcss` | Styling, color utilities |
| `lucide-react` | Icons for empty states |

---

### API Route Design

**Server Component Data Fetching (no separate API route needed):**
The page will fetch data directly in the Server Component using Prisma:

1. **Fetch motives + spending:** `prisma.motive.findMany()` + `prisma.billMotive.groupBy()`
2. **Fetch categories + spending:** `prisma.category.findMany()` + `prisma.billCategory.groupBy()`
3. **Fetch unallocated amounts:** `prisma.bill.aggregate()` with relation filters

**Rationale:** Server Components can query the database directly without exposing API endpoints, reducing code duplication and improving performance.

---

### Edge Case Handling (Architecture Level)

| Edge Case | UI Behavior |
|-----------|-------------|
| No bills in project | Empty state: "No spending recorded yet" |
| All bills are drafts | All spending = €0.00; totals row shows zeros |
| Budget = €0 with spending | % Used shows "∞" in red; remaining = negative |
| Deleted motive with historic bills | Row labeled "(deleted)"; budget = €0; % Used = "—" |
| Bills without allocations | "(unallocated)" row captures this spending |
| Division by zero | Display "—" (dash) instead of percentage |
| Very large numbers | Format with thousands separators; no overflow |

---

### Responsive Considerations

- **Desktop (>1024px)**: Full 5-column table with generous padding
- **Tablet (768-1024px)**: Condensed table, smaller padding
- **Mobile (<768px)**: Horizontal scroll or card-based layout (decision: horizontal scroll preferred for data density)

---

### Security Notes

- All data scoped to `currentProjectId` from session
- Page is read-only; no mutation endpoints needed
- No admin-only features; all authenticated project members can view


## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
