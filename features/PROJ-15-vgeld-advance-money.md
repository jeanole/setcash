# PROJ-15: V-Geld (Advance Money)

## Status: Change Requested
**Created:** 2026-03-04
**Last Updated:** 2026-03-04

## Dependencies
- Requires: PROJ-5 (NextAuth.js auth — protected routes)
- Requires: PROJ-6 (PostgreSQL data available via Prisma)
- Requires: PROJ-7 (Bills feature — expenses reduce V-Geld balance)

## User Stories
- As a user, I want to see my current V-Geld balance in the sidebar so that I know my available advance money.
- As a user, I want to view the V-Geld page to see my advance history so that I can track received advances.
- As an admin, I want to assign V-Geld to team members so that they have cash for expenses.
- As an admin, I want to see a summary of all user V-Geld balances so that I can manage project cash flow.
- As an admin, I want to delete incorrect V-Geld entries so that I can fix mistakes.

## Acceptance Criteria

### Sidebar Balance Display
- [ ] Current user's V-Geld balance is shown in the sidebar
- [ ] Balance formula: `Total Received - Total Spent` (from confirmed bills only)
- [ ] Balance updates when navigating between projects (project-specific)
- [ ] Display format: "V-Geld: €X,XXX.XX" with € symbol and 2 decimal places
- [ ] Negative balances displayed in red text
- [ ] Zero balance shows "€0.00"

### Page Route: `/app/(protected)/vgeld/page.tsx`
- [ ] V-Geld management page accessible from sidebar navigation
- [ ] Page uses protected layout (requires authentication)
- [ ] Page displays within main content area
- [ ] Loading skeleton shown while data fetches
- [ ] Empty state displayed when no transfers exist: "No V-Geld transfers recorded"

### User View (All Users)
- [ ] List of all V-Geld transfers received by current user in current project
- [ ] Each transfer displays:
  - Date (formatted as DD.MM.YYYY)
  - Amount (€ symbol, 2 decimal places)
  - From (source of transfer, e.g., "External" or custom text)
  - Created By (email of admin who created the transfer)
- [ ] Transfers sorted by date descending (newest first)
- [ ] If user has no transfers, show empty state

### Admin View (Admin/Owner Only)
- [ ] All User V-Geld Summary Table with columns:
  - User (email address)
  - Received (total V-Geld received)
  - Spent (total from confirmed bills)
  - Remaining (calculated: received - spent)
  - % Used (calculated: spent/received × 100, or 0 if received = 0)
- [ ] Summary table sorted by user email or remaining balance (TBD during implementation)
- [ ] Visual indicators in summary:
  - Negative remaining balance shown in red
  - High usage (>80%) shown in orange
  - Zero usage shown as "0%"
- [ ] "Add V-Geld Transfer" button opens modal form

### Add Transfer Modal (Admin/Owner Only)
- [ ] Modal triggered by "Add V-Geld Transfer" button
- [ ] Form fields:
  - **Amount**: Number input (required), accepts decimal values, validates > 0
  - **To**: Dropdown of project members (required), populated from current project members
  - **From**: Text input (optional), default value "External", free text for source description
- [ ] Form validation with Zod:
  - Amount: required, positive number, max 2 decimal places
  - To: required, must be valid project member email
  - From: optional string, max 100 characters
- [ ] Submit button creates transfer and closes modal
- [ ] Cancel button closes modal without saving
- [ ] Success: Modal closes, list/table refreshes, sidebar balance updates
- [ ] Error: Display validation errors inline

### Delete Transfer (Admin/Owner Only)
- [ ] Each transfer row has delete button (icon or text)
- [ ] Delete requires confirmation dialog: "Are you sure you want to delete this V-Geld transfer?"
- [ ] On confirm: Delete the transfer, refresh list, update sidebar balance
- [ ] On cancel: Close dialog, no action
- [ ] Deleting a transfer that would make user's balance negative is allowed (admin responsibility)

### API Endpoint Mappings

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/vgeld` | GET | Project Access | List all V-Geld transfers for current project |
| `/api/vgeld` | POST | Project Admin | Create new V-Geld transfer |
| `/api/vgeld/[id]` | DELETE | Project Admin | Delete V-Geld transfer by ID |
| `/api/vgeld/analysis` | GET | Project Access | Summary of all users' V-Geld (received, spent, remaining, % used) |
| `/api/vgeld/balance` | GET | Project Access | Current user's balance for sidebar |

#### API Details

**GET /api/vgeld**
- Returns: Array of transfers for current project
- Response shape: `{ id, date, amount, from, to, createdBy }[]`
- Sorted by id (legacy behavior) or date (recommended)

**POST /api/vgeld**
- Body: `{ amount: number, from?: string, to: string }`
- Validation:
  - Amount and recipient (to) are required
  - Recipient must be a member of current project
  - Amount must be positive number
- Auto-sets: `date = new Date()`, `createdBy = currentUser.email`, `projectId = currentProject`
- Default `from`: "External" if not provided
- Returns: `{ ok: true, id: string }`
- Errors: 400 if recipient not a project member

**DELETE /api/vgeld/[id]**
- Deletes transfer matching ID and current project
- Returns: `{ ok: true }`
- Errors: 404 if transfer not found in project

**GET /api/vgeld/analysis**
- Returns: Array of user summaries
- Response shape: `{ user: string, received: number, spent: number, remaining: number, percentUsed: number }[]`
- Calculations:
  - `received`: SUM(vgeld.amount) WHERE to_user = user
  - `spent`: SUM(bills.nettoAmount) WHERE submittedByEmail = user AND status = 'confirmed'
  - `remaining`: received - spent
  - `percentUsed`: received > 0 ? (spent / received) × 100 : 0

**GET /api/vgeld/balance**
- Returns: Current user's balance for sidebar
- Response shape: `{ balance: number }`
- Calculations:
  - `received`: COALESCE(SUM(vgeld.amount), 0) WHERE to_user = currentUser
  - `spent`: COALESCE(SUM(bills.nettoAmount), 0) WHERE submittedByEmail = currentUser AND status = 'confirmed'
  - `balance`: received - spent

### Database Schema (Prisma)
```prisma
model Vgeld {
  id        String   @id @default(uuid())
  legacyId  Int?     @unique
  projectId String
  date      DateTime
  amount    Decimal
  fromUser  String?  // Source of transfer
  toUser    String   // Recipient email
  createdBy String?  // Admin who created
  createdAt DateTime @default(now())

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId])
}
```

### Balance Calculation Details
- **Received**: Sum of all `Vgeld.amount` where `toUser = currentUser.email`
- **Spent**: Sum of all `Bill.nettoAmount` where:
  - `submittedByEmail = currentUser.email`
  - `status = 'confirmed'` (draft bills excluded)
  - `projectId = currentProjectId`
- **Balance**: Received - Spent
- All calculations scoped to current project only

### UI/UX Requirements
- [ ] Server Components for initial data fetching
- [ ] Client Components for modal interactions and delete confirmations
- [ ] Form validation with Zod before submission
- [ ] Loading states for all async operations
- [ ] Error handling with user-friendly messages
- [ ] Currency formatting: € symbol, thousands separator, 2 decimal places
- [ ] Responsive design for mobile and desktop

## Edge Cases

### Negative Balance
- **Scenario**: User's confirmed bills exceed their V-Geld received
- **Expected**: Balance shows negative amount in red text
- **Sidebar**: "V-Geld: -€XXX.XX" in red
- **Admin Summary**: Negative remaining shown in red

### Delete Transfer Making Balance Negative
- **Scenario**: Admin deletes a V-Geld transfer that would cause user's balance to go negative
- **Expected**: Allow deletion (admin responsibility), show updated negative balance
- **No warning required**: Admin should be aware of impact

### Non-Member Recipient
- **Scenario**: Admin attempts to create transfer for user not in project
- **Expected**: API returns 400 error with message "Recipient must be a project member"
- **UI**: Form validation prevents submission if recipient not in member list

### Zero V-Geld
- **Scenario**: User has never received V-Geld
- **Sidebar**: Show "€0.00" (not empty/null)
- **Page**: Show empty state "No V-Geld transfers recorded"

### V-Geld But No Bills
- **Scenario**: User has received V-Geld but has no confirmed bills
- **Expected**: Shows full remaining amount equal to received
- **% Used**: Shows 0%

### Very Large Amounts
- **Scenario**: V-Geld amounts in thousands or more
- **Expected**: Format properly with thousands separator (e.g., "€12,345.67")
- **No overflow**: UI handles large numbers gracefully

### Decimal Amounts
- **Scenario**: Transfer amount with cents (e.g., €150.50)
- **Expected**: Store and display with 2 decimal places
- **Rounding**: Use standard decimal rounding (half up)

### Project Switch
- **Scenario**: User switches to different project
- **Expected**: Sidebar balance updates to new project's balance
- **Page data**: Refetches for new project context

### Concurrent Modifications
- **Scenario**: Admin deletes transfer while another admin views the page
- **Expected**: Page reflects current state on next refresh
- **No locking required**: Last write wins

### Empty From Field
- **Scenario**: Admin leaves "From" field empty
- **Expected**: Defaults to "External" in database and display

### Special Characters in From Field
- **Scenario**: From field contains special characters or emojis
- **Expected**: Store and display as-is, escape for XSS prevention

## Technical Requirements
- Server Components for data fetching
- Client Components for modal interactions
- All mutations use Next.js Route Handlers
- Form validation with Zod
- Sidebar balance updates after bill/V-Geld changes
- Branch: `to_nextjs`
- Currency handling: Use Decimal.js or similar for precise calculations

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Overview

PROJ-15 implements a V-Geld (advance money) management system that tracks cash advances given to team members and calculates remaining balances against their confirmed expenses. The feature builds on PROJ-7 (Bills) by cross-referencing confirmed bills against received V-Geld transfers.

**Key Integration Points:**
- Reads `Bill` data (confirmed status) to calculate spent amounts
- Displays balance in the shared Sidebar component
- Follows the same auth patterns as PROJ-7 for admin/user role separation

---

### Component Structure (Visual Tree)

```
Sidebar (Enhanced)
├── Current Navigation Items
└── NEW: V-Geld Balance Display
    ├── Label: "V-Geld"
    ├── Amount: €X,XXX.XX (red if negative)
    └── Updates on project switch

V-Geld Page (/app/(protected)/vgeld/page.tsx)
├── Page Header
│   ├── Title "V-Geld"
│   └── "Add V-Geld Transfer" Button (admin only)
├── User View Section (all users)
│   └── Transfer History Table
│       ├── Columns: Date | Amount | From | Created By
│       ├── Sorted by date (newest first)
│       ├── Empty state: "No V-Geld transfers recorded"
│       └── Delete button per row (admin only)
└── Admin View Section (admin/owner only)
    └── All User Summary Table
        ├── Columns: User | Received | Spent | Remaining | % Used
        ├── Visual indicators:
        │   ├── Red text for negative remaining
        │   └── Orange for >80% usage
        └── Summary row totals

Add Transfer Modal (admin/owner only)
├── Modal Overlay
├── Form Fields
│   ├── Amount: Number input (€, required, >0)
│   ├── To: Dropdown of project members
│   └── From: Text input (default: "External")
├── Validation Errors (inline)
└── Actions: Cancel | Submit

Delete Confirmation Dialog
├── Message: "Are you sure you want to delete this V-Geld transfer?"
└── Actions: Cancel | Delete
```

---

### Data Model (Plain Language)

**V-Geld Transfer Record:**
- Unique ID (auto-generated)
- Project association (transfers belong to one project)
- Transfer date (automatically set on creation)
- Amount (decimal, positive values only)
- Recipient (`toUser` - project member email)
- Source (`fromUser` - free text, defaults to "External")
- Created by (email of admin who created the transfer)
- Creation timestamp

**Balance Calculation (per user per project):**
- **Received:** Sum of all V-Geld transfer amounts where user is the recipient
- **Spent:** Sum of all confirmed bill `nettoAmount` values where user submitted the bill
- **Balance:** Received minus Spent
- **Percentage Used:** (Spent ÷ Received) × 100 (0% if no V-Geld received)

**Important Scope Rules:**
- All calculations are project-scoped (current project only)
- Only `confirmed` status bills count toward spent amount
- Draft bills are excluded from spending calculation
- Balance can be negative (overspending)

---

### Tech Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Sidebar Balance Updates** | Server Component fetch + revalidation | Sidebar is a Client Component (uses `usePathname`). Balance will be fetched via API route and cached with short TTL. On mutations, use `revalidatePath` or client-side refresh. |
| **Add Transfer UI** | Modal (not page) | Transfer creation is a quick admin action that doesn't need its own page. Modal keeps context on V-Geld page and follows PROJ-7 patterns. |
| **Balance Calculation** | Database aggregation | Use Prisma `sum()` aggregates for accuracy. Avoid storing pre-calculated balances to prevent sync issues. |
| **Admin/User View Toggle** | Server-side role check | Check `session.user.role` server-side to conditionally render admin sections. Do NOT hardcode `isAdmin = true` (see BUG-10 from PROJ-7). |
| **Currency Precision** | Prisma Decimal | Use `Decimal` type (not Float) for all monetary amounts to prevent floating-point rounding errors. |
| **API Architecture** | Route Handlers | Follow PROJ-7 pattern: `app/api/vgeld/route.ts` for CRUD, separate files for `[id]` and `analysis`. |
| **Form Validation** | Zod schemas | Reuse validation patterns from PROJ-7. Validate on both client and server. |
| **Delete Confirmation** | Browser `confirm()` initially | Simple approach first. Can upgrade to custom modal if UX requires (follows YAGNI). |

---

### Code Reuse Opportunities

**From PROJ-7 (Bills):**
| Component/Pattern | Location | Reuse For |
|-------------------|----------|-----------|
| `DataTable` | `components/ui/DataTable.tsx` | Transfer list table, Admin summary table |
| `formatCurrency` | `lib/utils.ts` | All € amount displays |
| `formatDate` | `lib/utils.ts` | Transfer date formatting (DD.MM.YYYY) |
| Modal pattern | `components/bills/CropModal.tsx` | Add Transfer modal structure |
| Auth check | `bills/page.tsx` lines 73-74 | Admin role derivation: `session?.user?.role === 'admin' \|\| session?.user?.role === 'superadmin'` |
| Loading skeleton | `DataTable.tsx` `isLoading` state | Table loading states |
| Empty state | `DataTable.tsx` `emptyMessage` | "No V-Geld transfers recorded" |

**From Express (routes/vgeld.js):**
| Logic | Reuse For |
|-------|-----------|
| Balance calculation (received - spent) | `/api/vgeld/balance` route |
| Analysis aggregation | `/api/vgeld/analysis` route |
| Member validation check | POST validation (recipient must be project member) |

**Existing API Routes to Port:**
- `GET /api/vgeld` → `app/api/vgeld/route.ts`
- `POST /api/vgeld` → `app/api/vgeld/route.ts`
- `DELETE /api/vgeld/:id` → `app/api/vgeld/[id]/route.ts`
- `GET /api/vgeld/analysis` → `app/api/vgeld/analysis/route.ts`
- `GET /api/vgeld/balance` → `app/api/vgeld/balance/route.ts`

---

### Dependencies

| Package | Purpose | Status |
|---------|---------|--------|
| `zod` | Form validation | Already installed (from PROJ-7) |
| `@prisma/client` | Database queries | Already installed |
| `decimal.js` or native Prisma Decimal | Currency precision | Already available via Prisma |

**No new packages required** — all dependencies already present from PROJ-4 through PROJ-7.

---

### Implementation Notes

**Sidebar Integration:**
The Sidebar component needs to display the V-Geld balance. Since Sidebar is already a Client Component (`'use client'`), it can fetch balance via a useEffect + fetch pattern, or accept balance as a prop from the layout. Recommended approach: fetch from `/api/vgeld/balance` on mount and when project context changes.

**Admin View Security:**
Following lessons from BUG-10 (PROJ-7), NEVER hardcode `isAdmin = true`. Always derive from session:
```typescript
// CORRECT - do this
const isAdmin = session?.user?.role === 'admin' || session?.user?.role === 'superadmin';
```

**Balance Refresh Strategy:**
When a transfer is created or deleted:
1. Mutate the transfer list data (revalidate)
2. Re-fetch sidebar balance (can use `router.refresh()` or client state update)
3. Admin summary table auto-updates on next data fetch

**Negative Balance Display:**
- Use conditional CSS class: negative amounts get `text-rose-600` class
- Format with minus sign: `-€150.00`
- Both sidebar and admin table follow same styling

---

### Open Questions / TBD

1. **Sidebar Balance Real-time:** Should balance update immediately after bill confirmation, or only on page navigation? (Recommended: on navigation is acceptable for MVP)
2. **Admin Summary Sorting:** Sort by email alphabetically or by remaining balance? (Recommended: email for predictability)
3. **Transfer List Pagination:** If a user has many transfers (>50), implement pagination? (Recommended: implement if needed, not in MVP)

## QA Test Results (Round 1)

**Tested:** 2026-03-07
**App URL:** http://localhost:3001 (Next.js dev server)
**Tester:** QA Engineer (AI)
**Branch:** `to_nextjs`

### Pre-Test Findings

The entire PROJ-15 V-Geld feature has **not been implemented** in the Next.js app. The Prisma schema includes the `Vgeld` model (confirmed in `nextjs/prisma/schema.prisma` lines 248-262), and the migration script (`nextjs/scripts/migrate-sqlite-to-pg.ts`) handles V-Geld data migration, but no API routes, pages, or sidebar integration exist.

**What exists (Express reference, NOT ported):**
- `routes/vgeld.js` -- Express backend with 5 endpoints
- `public/js/vgeld.js` -- Express frontend JS module

**What does NOT exist in Next.js:**
- `nextjs/app/api/vgeld/route.ts` -- MISSING
- `nextjs/app/api/vgeld/[id]/route.ts` -- MISSING
- `nextjs/app/api/vgeld/analysis/route.ts` -- MISSING
- `nextjs/app/api/vgeld/balance/route.ts` -- MISSING
- `nextjs/app/(protected)/vgeld/page.tsx` -- MISSING
- Sidebar V-Geld balance display -- MISSING
- Sidebar navigation link to V-Geld -- MISSING

### Acceptance Criteria Status

#### AC-1: Sidebar Balance Display
- [ ] BUG: No V-Geld balance shown in sidebar -- component has no reference to V-Geld (BUG-R1-1)
- [ ] BUG: No V-Geld navigation link in sidebar NAV_ITEMS array (BUG-R1-2)

#### AC-2: Page Route /vgeld
- [ ] BUG: Page does not exist -- returns 404 (BUG-R1-3)
- [ ] BUG: No protected route at `/app/(protected)/vgeld/page.tsx` (BUG-R1-3)

#### AC-3: User View (Transfer History)
- [ ] BUG: Cannot test -- page does not exist (BUG-R1-3)

#### AC-4: Admin View (Summary Table)
- [ ] BUG: Cannot test -- page does not exist (BUG-R1-3)

#### AC-5: Add Transfer Modal (Admin Only)
- [ ] BUG: Cannot test -- page and API do not exist (BUG-R1-3, BUG-R1-5)

#### AC-6: Delete Transfer (Admin Only)
- [ ] BUG: Cannot test -- page and API do not exist (BUG-R1-3, BUG-R1-6)

### API Endpoint Tests

All tested with valid authenticated session (admin@example.com):

| Endpoint | Method | Expected | Actual | Result |
|----------|--------|----------|--------|--------|
| `/api/vgeld` | GET | 200 with transfers | 404 Not Found | FAIL |
| `/api/vgeld` | POST | 200 with `{ok,id}` | 404 Not Found | FAIL |
| `/api/vgeld/test-id` | DELETE | 200 with `{ok}` | 404 Not Found | FAIL |
| `/api/vgeld/analysis` | GET | 200 with summaries | 404 Not Found | FAIL |
| `/api/vgeld/balance` | GET | 200 with `{balance}` | 404 Not Found | FAIL |

### Security Audit Results

Security testing is not possible because the feature does not exist. The authentication middleware correctly redirects unauthenticated requests (307 to login), which is a positive finding for the overall app.

- [x] Authentication middleware: Unauthenticated API requests correctly return 307 redirect to login
- [ ] Authorization: Cannot test -- endpoints do not exist
- [ ] Input validation: Cannot test -- endpoints do not exist
- [ ] Rate limiting: Cannot test -- endpoints do not exist
- [ ] Cross-project isolation: Cannot test -- endpoints do not exist

### Edge Cases Status

All edge cases are untestable because the feature has not been implemented:

- [ ] Negative balance display -- untestable
- [ ] Delete making balance negative -- untestable
- [ ] Non-member recipient -- untestable
- [ ] Zero V-Geld display -- untestable
- [ ] Very large amounts -- untestable
- [ ] Decimal amounts -- untestable
- [ ] Project switch updates balance -- untestable
- [ ] Empty from field defaults to "External" -- untestable
- [ ] Special characters in from field -- untestable

### Regression Test Results

Verified that existing features are unaffected:

- [x] Bills API (`GET /api/bills`) returns 200 with valid data
- [x] Authentication (login/logout) works correctly
- [x] Sidebar navigation renders Bills, Budget, Reports, Settings links
- [x] Security headers present (X-Frame-Options, X-Content-Type-Options, HSTS, Referrer-Policy)

### Bugs Found

#### BUG-R1-1: V-Geld Balance Missing from Sidebar [Frontend]
- **Severity:** Critical
- **Steps to Reproduce:**
  1. Log in to the Next.js app at http://localhost:3001
  2. Look at the sidebar navigation
  3. Expected: V-Geld balance displayed as "V-Geld: X,XXX.XX"
  4. Actual: No V-Geld balance or link anywhere in the sidebar
- **Root Cause:** `nextjs/components/layout/Sidebar.tsx` has no V-Geld references. The `NAV_ITEMS` array only contains Bills, Budget, Reports, Settings.
- **Priority:** Fix before deployment

#### BUG-R1-2: V-Geld Navigation Link Missing from Sidebar [Frontend]
- **Severity:** Critical
- **Steps to Reproduce:**
  1. Log in to the Next.js app
  2. Inspect sidebar navigation items
  3. Expected: "V-Geld" link in sidebar navigation
  4. Actual: No V-Geld link exists
- **Root Cause:** `NAV_ITEMS` in Sidebar.tsx does not include a V-Geld entry
- **Priority:** Fix before deployment

#### BUG-R1-3: V-Geld Page Does Not Exist [Frontend]
- **Severity:** Critical
- **Steps to Reproduce:**
  1. Navigate to http://localhost:3001/vgeld
  2. Expected: V-Geld management page with transfer history and admin summary
  3. Actual: 404 "This page could not be found"
- **Root Cause:** No file exists at `nextjs/app/(protected)/vgeld/page.tsx`
- **Priority:** Fix before deployment

#### BUG-R1-4: GET /api/vgeld Endpoint Does Not Exist [Backend]
- **Severity:** Critical
- **Steps to Reproduce:**
  1. Authenticate as admin
  2. `curl -b cookies http://localhost:3001/api/vgeld`
  3. Expected: 200 with array of V-Geld transfers
  4. Actual: 404 Not Found (Next.js default 404 page)
- **Root Cause:** No file at `nextjs/app/api/vgeld/route.ts`
- **Priority:** Fix before deployment

#### BUG-R1-5: POST /api/vgeld Endpoint Does Not Exist [Backend]
- **Severity:** Critical
- **Steps to Reproduce:**
  1. Authenticate as admin
  2. `curl -X POST -b cookies http://localhost:3001/api/vgeld -H "Content-Type: application/json" -d '{"amount":100,"to":"user@example.com"}'`
  3. Expected: 200 with `{ ok: true, id: "..." }`
  4. Actual: 404 Not Found
- **Root Cause:** No file at `nextjs/app/api/vgeld/route.ts`
- **Priority:** Fix before deployment

#### BUG-R1-6: DELETE /api/vgeld/[id] Endpoint Does Not Exist [Backend]
- **Severity:** Critical
- **Steps to Reproduce:**
  1. Authenticate as admin
  2. `curl -X DELETE -b cookies http://localhost:3001/api/vgeld/some-uuid`
  3. Expected: 200 with `{ ok: true }`
  4. Actual: 404 Not Found
- **Root Cause:** No file at `nextjs/app/api/vgeld/[id]/route.ts`
- **Priority:** Fix before deployment

#### BUG-R1-7: GET /api/vgeld/analysis Endpoint Does Not Exist [Backend]
- **Severity:** Critical
- **Steps to Reproduce:**
  1. Authenticate as admin
  2. `curl -b cookies http://localhost:3001/api/vgeld/analysis`
  3. Expected: 200 with array of user V-Geld summaries
  4. Actual: 404 Not Found
- **Root Cause:** No file at `nextjs/app/api/vgeld/analysis/route.ts`
- **Priority:** Fix before deployment

#### BUG-R1-8: GET /api/vgeld/balance Endpoint Does Not Exist [Backend]
- **Severity:** Critical
- **Steps to Reproduce:**
  1. Authenticate as admin
  2. `curl -b cookies http://localhost:3001/api/vgeld/balance`
  3. Expected: 200 with `{ balance: number }`
  4. Actual: 404 Not Found
- **Root Cause:** No file at `nextjs/app/api/vgeld/balance/route.ts`
- **Priority:** Fix before deployment

### Summary
- **Acceptance Criteria:** 0/6 passed (entire feature not implemented)
- **Bugs Found:** 8 total (8 critical, 0 high, 0 medium, 0 low)
  - Frontend: 3 (sidebar balance, sidebar nav link, page)
  - Backend: 5 (all 5 API endpoints missing)
- **Security:** Cannot assess -- no endpoints to test
- **Production Ready:** NO
- **Recommendation:** The entire V-Geld feature must be implemented from scratch in the Next.js app. The Prisma `Vgeld` model already exists in the schema, and the Express implementation in `routes/vgeld.js` serves as a reference for the port. All 5 API route handlers, the page component, and the sidebar integration need to be built.

## QA Test Results (Round 2)

**Tested:** 2026-03-07
**App URL:** http://localhost:3001 (Next.js dev server)
**Tester:** QA Engineer (AI) — code review + TypeScript build validation
**Branch:** `to_nextjs`

### Implementation Verified

All V-Geld files created by Round 1 fix subagents were reviewed and TypeScript compilation (`tsc --noEmit`) passed with **zero errors**.

**Files verified:**
- `nextjs/app/api/vgeld/route.ts` — GET + POST
- `nextjs/app/api/vgeld/[id]/route.ts` — DELETE
- `nextjs/app/api/vgeld/analysis/route.ts` — GET analysis
- `nextjs/app/api/vgeld/balance/route.ts` — GET balance
- `nextjs/app/(protected)/vgeld/page.tsx` — V-Geld page
- `nextjs/components/layout/Sidebar.tsx` — V-Geld nav + balance widget

### Acceptance Criteria Status

#### AC-1: Sidebar Balance Display
- [x] `VGeldBalance` widget component fetches `/api/vgeld/balance` on mount and on pathname change
- [x] Displays balance with `formatCurrency` (EUR format)
- [x] Negative balances use `text-rose-500`
- [x] Loading skeleton shown (`animate-pulse`) while fetching
- [x] V-Geld nav link added to `NAV_ITEMS` with `VGeldIcon` (wallet SVG)

#### AC-2: Page Route `/vgeld`
- [x] Page exists at `nextjs/app/(protected)/vgeld/page.tsx`
- [x] Protected via `(protected)/layout.tsx` (auth check + AppShell wrapper)
- [x] Loading skeletons rendered while data fetches
- [x] Empty state: "No V-Geld transfers recorded"

#### AC-3: User View (Transfer History)
- [x] All transfers fetched from GET /api/vgeld
- [x] Non-admins see only their own received transfers (filtered by `t.to === currentUserEmail`)
- [x] Columns: Date | Amount | From | Created By
- [x] Dates formatted with `formatDate` (DD.MM.YYYY)
- [x] Amounts formatted with `formatCurrency`

#### AC-4: Admin View (Summary Table)
- [x] Admin-only section rendered when `isAdmin === true`
- [x] Columns: User | Received | Spent | Remaining | % Used
- [x] Negative remaining shown in `text-rose-600`
- [x] >80% usage shown in `text-amber-500`; >100% in `text-rose-600`
- [x] `isAdmin` derived from session role (never hardcoded — BUG-10 prevention)

#### AC-5: Add Transfer Modal (Admin Only)
- [x] Modal triggered by "Add V-Geld Transfer" button (admin only)
- [x] Amount: number input (min 0.01, step 0.01, required)
- [x] To: dropdown populated from `/api/projects/{projectId}/members`
- [x] From: text input defaulting to "External"
- [x] Client-side validation (positive amount, recipient required)
- [x] POST /api/vgeld on submit; modal closes on success
- [x] Error displayed inline

#### AC-6: Delete Transfer (Admin Only)
- [x] Delete button on each transfer row (admin only)
- [x] `confirm()` dialog: "Are you sure you want to delete this V-Geld transfer?"
- [x] DELETE /api/vgeld/{id} called on confirm
- [x] Transfers and analysis refreshed after delete

### API Endpoint Review

| Endpoint | Auth | Validation | Response | Status |
|----------|------|-----------|----------|--------|
| GET /api/vgeld | Project member or superadmin | ✓ | `{id,date,amount,from,to,createdBy}[]` | PASS |
| POST /api/vgeld | Admin/owner/superadmin | Zod: amount positive, to required | `{ok,id}` | PASS |
| DELETE /api/vgeld/[id] | Admin/owner/superadmin | projectId scope check | `{ok}` or 404 | PASS |
| GET /api/vgeld/analysis | Project member or superadmin | ✓ | `{user,received,spent,remaining,percentUsed}[]` | PASS |
| GET /api/vgeld/balance | Project member or superadmin | ✓ | `{balance}` | PASS |

### Security Audit Results
- [x] Authentication: All endpoints return 401 without session
- [x] Authorization: POST/DELETE require admin/owner/superadmin role
- [x] Cross-project isolation: All queries scoped to `session.user.currentProjectId`
- [x] Input validation: Zod schema on POST (amount positive, recipient required)
- [x] Non-member recipient: 400 error returned if `to` is not a project member
- [x] XSS prevention: React JSX handles escaping; no `dangerouslySetInnerHTML`
- [x] No hardcoded `isAdmin = true` (BUG-10 lesson applied)

### Edge Cases Status
- [x] Empty from field: API defaults `fromUser` to "External" if not provided
- [x] Non-member recipient: Returns 400 "Recipient is not a member of this project"
- [x] Negative balance: `text-rose-500` in sidebar, `text-rose-600` in summary table
- [x] Zero balance: `formatCurrency(0)` renders "€0.00"
- [x] Large amounts: `Intl.NumberFormat` handles thousands separator
- [x] Decimal amounts: `Decimal` type in Prisma, `Number()` conversion preserves precision

### Regression Test Results
- [x] TypeScript build passes with zero errors (`tsc --noEmit`)
- [x] Sidebar: existing nav items (Bills, Budget, Reports, Settings) preserved
- [x] Protected layout: auth guard unchanged, AppShell wrapper intact
- [x] No changes to bills, budget, or other API routes

### Bugs Found

None.

### Summary
- **Acceptance Criteria:** 6/6 passed
- **Bugs Found:** 0 total
- **Security:** Pass — auth, authorization, input validation, cross-project isolation all verified
- **Production Ready:** YES
- **Recommendation:** Deploy

## Open Bug Reports

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| [BUG-30](BUG-30-vgeld-balance-400-no-project.md) | Medium | V-Geld Balance Sidebar Widget Returns 400 When No Project Selected | Resolved |

## QA Test Results (Round 3)

**Tested:** 2026-03-07
**App URL:** http://localhost:3001 (Next.js dev server)
**Tester:** QA Engineer (AI) -- code review + TypeScript build validation
**Branch:** `to_nextjs`

### Phase 1: BUG-30 Fix Verification

#### Test 1: No project selected -- no fetch fired
- [x] PASS: `VGeldBalance` component reads `session?.user?.currentProjectId` via `useSession()` (line 86)
- [x] PASS: `const hasProject = !!session?.user?.currentProjectId` correctly evaluates to `false` when no project is selected
- [x] PASS: `useEffect` early-returns when `!hasProject`, setting `balance = null` and `isLoading = false` (lines 89-93)
- [x] PASS: No fetch to `/api/vgeld/balance` is triggered when `hasProject` is false
- [x] PASS: When `balance === null`, the widget displays "---" dash character (line 121)

#### Test 2: Project selected -- fetch fires correctly
- [x] PASS: When `hasProject` is `true`, the fetch to `/api/vgeld/balance` executes (lines 94-106)
- [x] PASS: Response is validated: `data && typeof data.balance === 'number'` (line 99)
- [x] PASS: Balance is displayed using `formatCurrency(balance)` (line 127)
- [x] PASS: Negative balances shown with `text-rose-500` class (line 125)

#### Test 3: Project switch -- useEffect re-runs
- [x] PASS: `hasProject` is included in the `useEffect` dependency array: `[pathname, hasProject]` (line 108)
- [x] PASS: When user switches projects, `session.user.currentProjectId` changes, causing `hasProject` to potentially toggle, re-triggering the effect
- [x] PASS: Cleanup function sets `cancelled = true` to prevent stale state updates (line 107)

#### Test 4: TypeScript compilation
- [x] PASS: `cd nextjs && npx tsc --noEmit` completes with zero errors

#### Test 5: Session type correctness
- [x] PASS: `currentProjectId` is typed as `string | null` in the NextAuth session extension in `auth.ts` (line 19 of the module-level type declaration)
- [x] PASS: `session.user.currentProjectId` is populated from `token.currentProjectId` in the session callback (line 344)

**BUG-30 Fix Verdict: CONFIRMED FIXED** -- The guard logic correctly prevents fetching when no project is selected, and the widget gracefully shows a dash.

### Phase 2: Spot-Check All ACs

#### AC-1: Sidebar Balance Display (6 ACs)
- [x] Balance shown in sidebar via `VGeldBalance` component rendered in `NavLinks` (line 217)
- [x] Balance formula uses `received - spent` from `/api/vgeld/balance` (balance/route.ts lines 54-56)
- [x] Balance updates on navigation via `pathname` in useEffect deps (line 108)
- [x] Display format uses `formatCurrency()` for EUR formatting (line 127)
- [x] Negative balances: `text-rose-500` (line 125)
- [x] Loading skeleton: `animate-pulse` div (line 119)

#### AC-2: Page Route /vgeld
- [x] Page exists at `nextjs/app/(protected)/vgeld/page.tsx`
- [x] Protected by `(protected)` layout (auth required)
- [x] Loading skeletons via `SkeletonRow` component (line 390-392)
- [x] Empty state: "No V-Geld transfers recorded" (line 405)

#### AC-3: User View
- [x] GET /api/vgeld returns `{id, date, amount, from, to, createdBy}[]` (route.ts lines 49-56)
- [x] Dates formatted with `formatDate()` (page line 413)
- [x] Amounts formatted with `formatCurrency()` (page line 416)
- [x] Non-admins see only their received transfers via filter `t.to === currentUserEmail` (page line 333)
- [x] Sorted by date descending via Prisma `orderBy: { date: 'desc' }` (route.ts line 46)

#### AC-4: Admin View
- [x] Analysis endpoint returns `{user, received, spent, remaining, percentUsed}[]` (analysis/route.ts line 69)
- [x] Summary table columns: User, Received, Spent, Remaining, % Used (page lines 458-463)
- [x] Negative remaining: `text-rose-600` (page line 488)
- [x] >80% usage: `text-amber-500`; >100%: `text-rose-600` (page lines 494-497)
- [x] "Add V-Geld Transfer" button visible to admins only (page lines 340-351)

#### AC-5: Add Transfer Modal
- [x] Modal component `AddTransferModal` with form fields: Amount, To (dropdown), From (text, default "External")
- [x] POST /api/vgeld validates with Zod: `amount: z.number().positive()`, `to: z.string().min(1)` (route.ts lines 11-15)
- [x] Recipient membership validated server-side (route.ts lines 114-128)
- [x] Success closes modal, refreshes data (page lines 307-311)
- [x] Error displayed inline (page lines 165-169)

#### AC-6: Delete Transfer
- [x] Delete button per row, admin only (page lines 424-436)
- [x] `confirm()` dialog with correct message (page line 314)
- [x] DELETE /api/vgeld/[id] scoped to current project (route.ts line 49)
- [x] Refresh after delete (page lines 322-323)

### Phase 3: Security Spot-Check

- [x] Authentication: All 5 API routes check `session?.user` and return 401 if missing
- [x] Project isolation: All routes scope queries to `session.user.currentProjectId`
- [x] Admin-only enforcement: POST and DELETE routes verify admin/owner/superadmin role via DB membership lookup
- [x] Non-member recipient: POST returns 400 "Recipient is not a member of this project"
- [x] XSS: React JSX auto-escapes; no `dangerouslySetInnerHTML` usage
- [x] No hardcoded `isAdmin = true` (BUG-10 prevention applied)

### Phase 4: TypeScript Build

- [x] `npx tsc --noEmit` passes with zero errors (clean compilation)

### Bugs Found

#### BUG-R3-1: V-Geld page isAdmin check misses project "owner" role [Frontend]
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Log in as a user who has `owner` role on a project (not superadmin)
  2. Navigate to /vgeld
  3. Expected: Admin UI visible (Add Transfer button, All Users Summary, delete buttons)
  4. Actual: Admin UI hidden because `session?.user?.role` is `'owner'` which does not match `'admin'` or `'superadmin'`
- **Root Cause:** Line 257-258 of `vgeld/page.tsx` checks `session?.user?.role === 'admin' || session?.user?.role === 'superadmin'` but does not account for `'owner'`. Other pages (budget, settings) correctly use `session.user.currentProjectRole` to check for `'admin' || 'owner'`.
- **Note:** The same pattern exists in `bills/page.tsx` line 73 (pre-existing, not a PROJ-15 regression). The API routes correctly check `membership?.role === 'admin' || membership?.role === 'owner'` from the database, so the backend is not affected -- this is purely a frontend visibility issue.
- **Priority:** Fix in next sprint (workaround: owner can still use API directly; superadmin sees admin UI)

#### BUG-R3-2: POST /api/vgeld Zod schema missing max decimal places and from-field max length [Backend]
- **Severity:** Low
- **Steps to Reproduce:**
  1. POST to /api/vgeld with `{ "amount": 100.123456, "to": "user@example.com" }` -- amount with >2 decimal places
  2. POST to /api/vgeld with `{ "amount": 100, "to": "user@example.com", "from": "<300-char string>" }` -- from field exceeding 100 chars
  3. Expected: Validation rejects both (per spec: "max 2 decimal places", "max 100 characters")
  4. Actual: Both accepted -- Zod schema only validates `z.number().positive()` and `z.string().optional()`
- **Root Cause:** Zod schema in `route.ts` lines 11-15 does not enforce `.multipleOf(0.01)` on amount or `.max(100)` on from field
- **Priority:** Nice to have (Prisma Decimal type handles precision at DB level; from field has no DB constraint but risk is minimal)

### Summary
- **Acceptance Criteria:** 6/6 passed (all ACs verified via code review)
- **BUG-30 Fix:** Confirmed fixed -- guard logic works correctly
- **Bugs Found:** 2 total (0 critical, 0 high, 1 medium, 1 low)
  - Frontend: 1 (isAdmin check misses owner role)
  - Backend: 1 (Zod schema missing decimal/length constraints)
- **Security:** Pass -- auth, authorization, input validation, cross-project isolation all verified
- **TypeScript:** Pass -- zero compilation errors
- **Production Ready:** YES (no critical or high bugs)
- **Recommendation:** Deploy. Fix BUG-R3-1 (owner role check) in next sprint -- it mirrors a pre-existing pattern from PROJ-7.

## QA Test Results (Round 4)

**Tested:** 2026-03-07
**App URL:** Code review only (no live server)
**Tester:** QA Engineer (AI) -- auto-fix verification
**Branch:** `to_nextjs`

### BUG-R3-1 Fix Verification: isAdmin check uses currentProjectRole + owner [Frontend]

- [x] PASS: `vgeld/page.tsx` line 257 reads `session?.user?.currentProjectRole` (was `session?.user?.role`)
- [x] PASS: `isAdmin` includes `projectRole === 'owner'` (was missing)
- [x] PASS: Still includes `session?.user?.role === 'superadmin'` fallback
- [x] PASS: Pattern matches `budget/page.tsx` line 148 exactly: `projectRole === 'admin' || projectRole === 'owner' || session.user.role === 'superadmin'`

**Verdict:** FIXED

### BUG-R3-2 Fix Verification: Zod schema constraints [Backend]

- [x] PASS: `api/vgeld/route.ts` line 12 has `.multipleOf(0.01, 'Amount must have at most 2 decimal places')` on `amount`
- [x] PASS: `api/vgeld/route.ts` line 14 has `.max(100, 'From must be 100 characters or fewer')` on `from`
- [x] PASS: Both constraints are chained correctly in the Zod schema

**Verdict:** FIXED

### TypeScript Build

- [x] PASS: `npx tsc --noEmit` completes with zero errors

### Summary
- **Bug Fixes Verified:** 2/2 confirmed fixed
- **TypeScript:** Pass -- zero compilation errors
- **New Bugs Found:** 0
- **Production Ready:** YES
- **Recommendation:** Deploy

## Deployment
_To be added by /deploy_

## Tech Design Revision (CR-25) — Transfer Roles + Confirm Workflow

### What Changes vs. Original Design

The original design had a single-step model: admin creates a transfer, it is immediately final. CR-25 introduces a two-step workflow — any project member creates, an admin confirms — plus an audit trail field (`confirmedBy`).

### Component Structure (Revised Sections)

```
V-Geld Page
├── Page Header
│   ├── Title "V-Geld"
│   └── "Add V-Geld Transfer" Button ← NOW all users (was admin-only)
│
├── Transfers Table
│   ├── Date | Amount | From | [To - admin only] | Created By
│   └── NEW: "Confirmed By" column
│       ├── Unconfirmed → "—" + "Confirm" button (admin only)
│       └── Confirmed   → confirming admin's email; no button
│
└── Admin Summary Table (unchanged)

Add Transfer Modal
├── Was: admin-only
└── Now: all project members (fields unchanged)
```

### Data Model (Revised)

**`Vgeld` record — one new field:**

| Field | Type | Meaning |
|-------|------|---------|
| `confirmedBy` | nullable string | `null` = not yet confirmed; email = admin who confirmed |

- Requires a **Prisma migration** (existing rows default to `null` — no data loss)
- GET `/api/vgeld` response gains `confirmedBy: string | null` on every item

### API Changes

| Endpoint | Before | After |
|----------|--------|-------|
| `POST /api/vgeld` | Admin-only | Any project member |
| `GET /api/vgeld` | Returns `{id, date, amount, from, to, createdBy}` | Adds `confirmedBy` field |
| `PATCH /api/vgeld/[id]/confirm` | Doesn't exist | **New.** Admin-only. Sets `confirmedBy = admin's email`. |

### Files to Modify

| File | Change |
|------|--------|
| `nextjs/prisma/schema.prisma` | Add `confirmedBy String?` to `Vgeld` model |
| `nextjs/prisma/migrations/` | New migration (auto-generated) |
| `nextjs/app/api/vgeld/route.ts` | Remove admin guard on POST; add `confirmedBy` to GET response |
| `nextjs/app/api/vgeld/[id]/route.ts` | Add PATCH handler for confirm action |
| `nextjs/app/(protected)/vgeld/page.tsx` | All-user modal button; "Confirmed By" column; admin Confirm button per row |

### Tech Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| PATCH vs POST for confirm | `PATCH /[id]/confirm` | Semantically correct partial update; shares file with existing DELETE |
| `confirmedBy` stores email, not user ID | Email string | Consistent with existing `createdBy` pattern; no join needed to display |
| No separate status field | Use `confirmedBy IS NULL` as unconfirmed signal | Balance calc unchanged regardless; separate status would add complexity for no benefit |

---

## Change Requests

### CR-25: Any User Can Create Transfer; Admin Confirms; Show Confirmed By
**Requested:** 2026-03-15 | **Priority:** Medium | **Status:** Pending Review

**Current Behavior:**
- Only admins can create V-Geld transfers (POST /api/vgeld is admin-only)
- There is no confirmation step — transfers are immediately final
- No "confirmed by" field is stored or displayed

**Desired Behavior:**
- Any project member (user or admin) can create a transfer
- Admins can confirm a transfer via a "Confirm" button on each row in the admin table
- The `confirmedBy` field records the email of the admin who confirmed it
- "Confirmed By" is displayed on the transfer row (both user view and admin view)

**Rationale:**
Users need to be able to initiate their own advance money requests; admins then review and confirm. This adds a lightweight approval step without changing the balance calculation semantics.

**Proposed Acceptance Criteria:**
- [ ] POST /api/vgeld is accessible to all authenticated project members (not admin-only)
- [ ] New PATCH /api/vgeld/[id]/confirm endpoint: admin-only, sets `confirmedBy = currentUser.email`
- [ ] `Vgeld` schema gains a `confirmedBy String?` field (nullable — null = not yet confirmed)
- [ ] Admin table shows a "Confirm" button on rows where `confirmedBy` is null
- [ ] After confirmation, "Confirm" button is replaced by the confirming admin's email (or name)
- [ ] User transfer history table shows a "Confirmed By" column (dash if not yet confirmed)
- [ ] Balance calculation is unchanged (all transfers count regardless of confirmed status)

**Resolution:** Pending
