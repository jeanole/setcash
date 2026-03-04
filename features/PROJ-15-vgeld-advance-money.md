# PROJ-15: V-Geld (Advance Money)

## Status: Planned
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

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
