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


## QA Test Results (Round 3 -- Final)

**Tested:** 2026-03-11
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)
**Method:** Code-only review (source file inspection of all implementation files)
**Purpose:** Verify fixes for 4 bugs found in Round 2, re-check critical acceptance criteria, check for regressions

**Files reviewed:**
- `nextjs/lib/spending.ts` -- data fetching module (318 lines)
- `nextjs/app/(protected)/spending/page.tsx` -- server component page (87 lines)
- `nextjs/app/api/spending/route.ts` -- API endpoint (49 lines)
- `nextjs/components/spending/SpendingPageClient.tsx` -- client component with tabs (240 lines)
- `nextjs/components/spending/SpendingTable.tsx` -- table display component (293 lines)
- `nextjs/components/layout/Sidebar.tsx` -- sidebar navigation (325 lines)

---

### Round 2 Bug Fix Verification

#### BUG-1 (Round 2): Confirmed Bill Filter is Too Broad [Backend]
- **Status:** FIXED
- **Verification:** `CONFIRMED_BILL_FILTER` in `spending.ts` line 52-53 now uses `status: BillStatus.confirmed` (exact match). Previously it used `status: { not: BillStatus.draft }` which was over-inclusive. The comment at lines 42-51 now correctly explains why `status IS NULL` from the spec cannot occur (Prisma BillStatus enum is non-nullable, default `confirmed`), so matching only `confirmed` is spec-compliant.
- **Regression check:** No regressions. The filter is applied consistently to all 4 query sites: motive spending (line 122), category spending (line 220), motive unallocated (line 164), category unallocated (line 270).

#### BUG-2 (Round 2): Deleted Motive/Category Spending Data Lost Due to CASCADE Delete [Backend]
- **Status:** KNOWN LIMITATION (unchanged, as expected)
- **Notes:** This was tagged "Fix in next sprint" (Low severity). The `onDelete: Cascade` behavior in the Prisma schema is unchanged. The `SpendingItem.status = 'deleted'` type variant still exists but is never assigned. This remains a known limitation -- not a blocker for deployment.

#### BUG-3 (Round 2): API Route Missing Zod Input Validation [Backend]
- **Status:** FIXED
- **Verification:** `route.ts` line 15 now defines `const TabSchema = z.enum(['motive', 'category']).default('motive');` and lines 29-32 use `TabSchema.safeParse()` with proper error response (400 status) on validation failure. This satisfies the project rule requiring Zod validation on all API inputs.
- **Regression check:** No regressions. The `safeParse` pattern handles both valid values and invalid/missing values gracefully. Default value `'motive'` is preserved.

#### BUG-4 (Round 2): Settings Link Points to Potentially Non-existent Route [Frontend]
- **Status:** RESOLVED (was a false positive)
- **Verification:** The link at `SpendingTable.tsx` line 157 points to `/settings/motives`. Confirmed that `nextjs/app/(protected)/settings/motives/` directory exists as a valid route. The route is valid and the link will work correctly.

---

### Critical Acceptance Criteria Re-check

#### AC-5/AC-6: Bill Status Filtering (Previously Failed)
- [x] `CONFIRMED_BILL_FILTER` now uses `status: BillStatus.confirmed` -- only confirmed bills are included in spending calculations (`spending.ts` line 52-53)
- [x] Draft, rejected, pending, approved, and paid bills are all correctly excluded
- [x] Filter applied to all 4 query paths (motive spending, category spending, motive unallocated, category unallocated)

#### AC-11/AC-12/AC-13: Color Coding
- [x] Green (`bg-emerald-500`) for < 80% -- `SpendingTable.tsx` line 55
- [x] Orange (`bg-amber-500`) for >= 80% and < 100% -- `SpendingTable.tsx` line 53
- [x] Red (`bg-rose-500`) for >= 100% -- `SpendingTable.tsx` line 51

#### AC-15/AC-16/AC-17: Grand Totals Row
- [x] "TOTAL" label in bold -- `SpendingTable.tsx` line 262
- [x] Correct sum calculations via `getSpendingTotals()` -- `spending.ts` lines 299-317
- [x] Styled with `bg-zinc-50 border-t-2 border-zinc-200` -- `SpendingTable.tsx` line 261

#### AC-22: Currency Format
- [x] German locale `Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })` -- `SpendingTable.tsx` lines 10-13

#### AC-29: Access Control
- [x] Server component redirects unauthenticated users -- `page.tsx` lines 20-22
- [x] API route returns 401 for unauthenticated requests -- `route.ts` lines 20-21
- [x] API route returns 400 for missing project -- `route.ts` lines 24-26

---

### Regression Check

- [x] **Sidebar navigation:** "Spending" entry at `/spending` with SpendingIcon intact (`Sidebar.tsx` line 78). All other nav items (Bills, Budget, Reports, V-Geld, Settings) unchanged.
- [x] **Server component data flow:** Both motive and category data fetched in parallel (`page.tsx` lines 41-44), passed to client component. No changes to the data pipeline.
- [x] **Client-side tab switching:** `router.replace()` with URL query param still works correctly (`SpendingPageClient.tsx` line 153). No regressions from Zod fix.
- [x] **Error/retry flow:** Refetch calls `/api/spending` which now validates with Zod. Invalid tab params will get 400 response. The client always sends valid tab values (`?tab=motive` or `?tab=category`) so no functional regression.
- [x] **Empty states:** Both "No spending recorded yet" and "No budget items configured" states unchanged.
- [x] **Zod import:** `z` imported from `zod` at `route.ts` line 7. No unused imports or missing dependencies.

---

### Security Audit Results (Re-verified)

- [x] **Authentication:** Server component redirects unauthenticated users to `/login`; API route returns 401
- [x] **Project isolation:** All Prisma queries filter by `projectId` from session -- no cross-project data leakage
- [x] **No mutation endpoints:** API route only exposes GET handler
- [x] **Input validation:** API route now uses Zod schema (`TabSchema`) for `tab` query parameter with `safeParse` and 400 error response
- [x] **XSS protection:** React auto-escapes all rendered values; no `dangerouslySetInnerHTML` usage
- [x] **No secrets in code:** No hardcoded credentials or API keys

---

### Remaining Known Issues

#### KNOWN-1: Deleted Motive/Category Spending Data Lost Due to CASCADE Delete [Backend]
- **Severity:** Low
- **Status:** Deferred to next sprint (carried from Round 2 BUG-2)
- **Impact:** When a motive/category is deleted, `BillMotive`/`BillCategory` junction records are cascade-deleted, losing historic spending data. The `SpendingItem.status = 'deleted'` type variant exists but is never populated.
- **Notes:** Not a deployment blocker. Requires schema-level change (soft-delete or `onDelete: SetNull`) which is out of scope for PROJ-14.

---

### Summary
- **Acceptance Criteria:** 31/31 passed (all criteria now satisfied after BUG-1 fix)
- **Edge Cases:** 11/12 handled (EC-6 remains a known limitation, deferred)
- **Round 2 Bugs Resolved:** 3 of 4 fixed (BUG-1 fixed, BUG-3 fixed, BUG-4 resolved as false positive; BUG-2 deferred by design)
- **New Bugs Found:** 0
- **Security:** Pass (all checks passed including Zod validation)
- **Regressions:** None detected
- **Production Ready:** YES
- **Recommendation:** Ship it. All critical and medium-severity bugs are resolved. The only remaining issue (KNOWN-1: cascade delete on motive/category) is low severity and deferred to a future sprint.

## Deployment
_To be added by /deploy_
