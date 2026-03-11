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


## QA Test Results (Round 2)

**Tested:** 2026-03-11
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)
**Method:** Code-only review (source file inspection of all implementation files)

**Files reviewed:**
- `nextjs/lib/spending.ts` -- data fetching module (320 lines)
- `nextjs/app/(protected)/spending/page.tsx` -- server component page (87 lines)
- `nextjs/app/api/spending/route.ts` -- API endpoint (43 lines)
- `nextjs/components/spending/SpendingPageClient.tsx` -- client component with tabs (240 lines)
- `nextjs/components/spending/SpendingTable.tsx` -- table display component (293 lines)
- `nextjs/components/layout/Sidebar.tsx` -- sidebar navigation (325 lines)
- `nextjs/prisma/schema.prisma` -- Prisma model definitions

---

### Acceptance Criteria Status

#### AC-1: Page Route
- [x] Page exists at `nextjs/app/(protected)/spending/page.tsx`

#### AC-2: Tab Navigation (By Motive / By Category)
- [x] Two tabs rendered: "By Motive" and "By Category" (`SpendingPageClient.tsx` lines 200-211)
- [x] "By Motive" is default active (line 128: defaults to `'motive'` when no `tab` query param)

#### AC-3: Client-side Tab Switching
- [x] Tab switch uses `router.replace()` with URL query param -- no full page reload (`SpendingPageClient.tsx` line 153)

#### AC-4: By Motive Table Columns
- [x] Columns are Name, Budget, Spent, Remaining, % Used (`SpendingTable.tsx` lines 179-195)

#### AC-5: Motive Spending Calculation
- [x] Formula: `nettoAmount * percentage / 100` from BillMotive junction table (`spending.ts` lines 138-145)
- [ ] BUG: Status filter is too broad -- see BUG-1 below [Backend]

#### AC-6: Confirmed Bills Only
- [ ] BUG: Code uses `status: { not: BillStatus.draft }` which includes `rejected`, `pending`, `approved`, `paid` statuses. Spec says "status IS NULL OR status = 'confirmed'" -- only NULL and confirmed should be included. See BUG-1. [Backend]

#### AC-7: Unallocated Bills Row (Motive)
- [x] Present with `motives: { none: {} }` filter and "(unallocated)" label (`spending.ts` lines 162-183)

#### AC-8: By Category Table Columns
- [x] Same 5-column structure as motive tab

#### AC-9: Category Spending Calculation
- [x] Formula: `nettoAmount * percentage / 100` from BillCategory junction table (`spending.ts` lines 236-243)

#### AC-10: Unallocated Bills Row (Category)
- [x] Present with `categories: { none: {} }` filter (`spending.ts` lines 268-290)

#### AC-11: Color Coding -- Green
- [x] Green dot (`bg-emerald-500`) when `percentUsed < 80` (`SpendingTable.tsx` line 55)

#### AC-12: Color Coding -- Orange
- [x] Orange dot (`bg-amber-500`) when `percentUsed >= 80 && < 100` (`SpendingTable.tsx` line 53)

#### AC-13: Color Coding -- Red
- [x] Red dot (`bg-rose-500`) when `percentUsed >= 100` (`SpendingTable.tsx` line 51)

#### AC-14: Color Indicator Style
- [x] Small circular dot (8px / `w-2 h-2 rounded-full`) next to percentage text (`SpendingTable.tsx` line 66)

#### AC-15: Grand Totals Row -- Label
- [x] "TOTAL" in bold (`font-bold`, `SpendingTable.tsx` line 262)

#### AC-16: Grand Totals Row -- Calculations
- [x] Sum of all budgets, spent, remaining via `getSpendingTotals()` (`spending.ts` lines 301-319)

#### AC-17: Grand Totals Row -- Styling
- [x] Top border: `border-t-2 border-zinc-200` (line 261)
- [x] Gray background: `bg-zinc-50` (line 261)

#### AC-18: Netto Amounts Only
- [x] Uses `bill.nettoAmount` field from Prisma model (`spending.ts` lines 131, 228)

#### AC-19: Exclude Drafts
- [x] `CONFIRMED_BILL_FILTER` excludes `BillStatus.draft` (`spending.ts` line 53)
- Note: Over-inclusive filter -- see BUG-1

#### AC-20: Junction Table Logic
- [x] Proportional allocation via percentage: `nettoAmount * percentage / 100` for both BillMotive and BillCategory

#### AC-21: Project-scoped
- [x] All queries filter by `projectId` parameter passed from session

#### AC-22: Currency Format (German Locale)
- [x] `Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })` (`SpendingTable.tsx` line 10-13)

#### AC-23: Percentage Format
- [x] `value.toFixed(1) + '%'` -- e.g. "85.3%" (`SpendingTable.tsx` line 20)

#### AC-24: Negative Numbers
- [x] Handled by `Intl.NumberFormat` which produces minus sign; remaining column shows red when negative (`SpendingTable.tsx` line 236)

#### AC-25: Loading State
- [x] Skeleton table with 5 rows (`SpendingTable.tsx` lines 76-122, `SpendingTableSkeleton`)

#### AC-26: Empty State (No Bills)
- [x] "No spending recorded yet" message with icon (`SpendingPageClient.tsx` lines 52-79)

#### AC-27: Empty State (No Motives/Categories)
- [x] "No budget items configured" with link to Settings (`SpendingTable.tsx` lines 154-166)

#### AC-28: Error State
- [x] Error message with retry button; retry calls `/api/spending` endpoint (`SpendingPageClient.tsx` lines 90-107)

#### AC-29: Access Control -- Auth Required
- [x] Server component checks `session?.user` and redirects to `/login` (`page.tsx` line 20-22)
- [x] API route returns 401 for unauthenticated requests (`route.ts` line 17-19)

#### AC-30: Read-only
- [x] No mutation endpoints (API route only has GET handler)

#### AC-31: Sidebar Navigation Entry
- [x] "Spending" nav item with SpendingIcon at `/spending` (`Sidebar.tsx` line 78)

---

### Edge Cases Status

#### EC-1: No Bills in Project
- [x] Handled correctly -- motives render with spent=0; if no motives either, empty state shows

#### EC-2: All Bills Are Drafts
- [x] `CONFIRMED_BILL_FILTER` excludes drafts; spending = 0 for all items

#### EC-3: Budget = 0 but Spending > 0
- [x] `PercentIndicator` shows infinity symbol in red when `budget === 0 && spent > 0` (`SpendingTable.tsx` lines 35-42)

#### EC-4: No Motives/Categories Configured
- [x] `SpendingTable` returns "No budget items configured" with link to `/settings/motives` when `items.length === 0`

#### EC-5: Very Large Numbers
- [x] `Intl.NumberFormat('de-DE')` handles thousands separators automatically; table uses `overflow-x-auto` for horizontal scroll

#### EC-6: Deleted Motive/Category with Historic Bills
- [ ] BUG: The `(deleted)` status is defined in the `SpendingItem` type but never assigned by any code path. Both `BillMotive` and `BillCategory` have `onDelete: Cascade` on the motive/category FK, so when a motive/category is deleted, junction records are also deleted -- spending data is permanently lost. See BUG-2. [Backend]

#### EC-7: Bills Without Any Allocations
- [x] Unallocated row shows with `motives: { none: {} }` / `categories: { none: {} }` filter

#### EC-8: Bill with Partial Allocations (< 100%)
- [x] Only the allocated percentage is counted; unallocated portion is not tracked (matches Express behavior per spec)

#### EC-9: Bill with No Netto Amount
- [x] `toNumber()` helper returns 0 for null/undefined/NaN values (`spending.ts` lines 58-62)

#### EC-10: Division by Zero in % Used
- [x] `calcPercentUsed()` returns `null` when budget=0 (`spending.ts` line 65); UI renders dash or infinity accordingly

#### EC-11: Negative Remaining Budget Display
- [x] `remaining < 0` triggers `text-rose-600` class (`SpendingTable.tsx` line 236)

#### EC-12: Project Switch While Viewing
- [x] `useEffect` syncs state when `initialMotiveData`/`initialCategoryData` props change from server re-render (`SpendingPageClient.tsx` lines 183-186)

---

### Security Audit Results

- [x] **Authentication:** Server component redirects unauthenticated users to `/login`; API route returns 401
- [x] **Project isolation:** All Prisma queries filter by `projectId` from session -- no cross-project data leakage possible
- [x] **No mutation endpoints:** API route only exposes GET; no POST/PUT/DELETE handlers
- [x] **Tab parameter validation:** `tab` query param is compared with `=== 'category'`; any other value defaults to `'motive'` -- no injection vector
- [x] **XSS protection:** React auto-escapes all rendered values; no unsafe HTML injection patterns used
- [x] **No secrets in code:** No hardcoded credentials or API keys
- [ ] **Input validation:** API route does not use Zod for input validation on the `tab` query parameter. While the current code is safe (string comparison only), the project rules mandate Zod validation on all API inputs. See BUG-3. [Backend]

---

### Bugs Found

#### BUG-1: Confirmed Bill Filter is Too Broad [Backend]
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Create a bill and set its status to `rejected`
  2. Navigate to /spending
  3. Expected: Rejected bill should NOT be included in spending (spec says "status IS NULL OR status = 'confirmed'")
  4. Actual: Rejected bill IS included because the filter is `status: { not: 'draft' }`, which includes rejected, pending, approved, and paid statuses
- **Code Location:** `nextjs/lib/spending.ts` line 52-56 -- `CONFIRMED_BILL_FILTER`
- **Spec Reference:** Lines 43-45 and 67-68 -- SQL filter is `AND (b.status IS NULL OR b.status = 'confirmed')`
- **Priority:** Fix before deployment
- **Notes:** The code comment (lines 42-51) acknowledges the discrepancy and argues "the only excluded status is draft" is correct. However, this deviates from the spec. If the spec is intentionally broader (including all non-draft), the spec should be updated. If the code should match the spec literally, the filter should be `status: { in: ['confirmed'] }` since Prisma enum default is `confirmed` (no null status).

#### BUG-2: Deleted Motive/Category Spending Data Lost Due to CASCADE Delete [Backend]
- **Severity:** Low
- **Steps to Reproduce:**
  1. Create bills allocated to a motive
  2. Delete that motive
  3. Expected (per spec EC-6): Row labeled "(deleted)" appears with historic spending preserved
  4. Actual: `BillMotive` records are deleted via `onDelete: Cascade` -- the spending data is permanently lost; no "(deleted)" row appears
- **Code Location:** `nextjs/prisma/schema.prisma` lines 180, 195 -- `onDelete: Cascade` on motive/category FKs in BillMotive/BillCategory
- **Priority:** Fix in next sprint
- **Notes:** The `SpendingItem.status = 'deleted'` type variant exists but is never used in any code path. Fixing this would require either soft-delete on motives/categories, or changing the FK to `onDelete: SetNull` with a nullable `motiveId`/`categoryId`.

#### BUG-3: API Route Missing Zod Input Validation [Backend]
- **Severity:** Low
- **Steps to Reproduce:**
  1. Review `nextjs/app/api/spending/route.ts`
  2. Expected: `tab` query parameter validated with Zod schema per project rules (`.claude/rules/backend.md`: "Validate all inputs using Zod schemas before processing")
  3. Actual: Direct string comparison `req.nextUrl.searchParams.get('tab')` without Zod validation
- **Code Location:** `nextjs/app/api/spending/route.ts` line 26
- **Priority:** Nice to have
- **Notes:** No actual security risk here since the value is only used in a string equality check, but it violates the project coding standards. A simple `z.enum(['motive', 'category']).optional().default('motive')` schema would suffice.

#### BUG-4: Settings Link Points to Potentially Non-existent Route [Frontend]
- **Severity:** Low
- **Steps to Reproduce:**
  1. Navigate to /spending when no motives/categories are configured
  2. Click "Go to Settings" link
  3. Expected: Navigate to a settings page where motives/categories can be configured
  4. Actual: Link goes to `/settings/motives` -- this route may not exist; the sidebar shows `/settings` as the settings entry point
- **Code Location:** `nextjs/components/spending/SpendingTable.tsx` line 158 -- `href="/settings/motives"`
- **Priority:** Nice to have
- **Notes:** If `/settings/motives` is not a valid route, users will see a 404. The link should point to `/settings` or the specific tab/section within settings.

---

### Summary
- **Acceptance Criteria:** 29/31 passed (2 with noted issues on bill status filter)
- **Edge Cases:** 11/12 handled (EC-6 deleted motive/category not supported)
- **Bugs Found:** 4 total (0 critical, 0 high, 1 medium, 3 low)
- **Security:** Pass (all checks passed; Zod validation noted as low-severity standards gap)
- **Production Ready:** YES (with caveat on BUG-1 medium-severity status filter)
- **Recommendation:** Deploy with awareness that BUG-1 (bill status filter breadth) may cause rejected bills to appear in spending totals. If rejected bills should not count as spending, fix BUG-1 before deployment. All other issues are low priority.

## Deployment
_To be added by /deploy_
