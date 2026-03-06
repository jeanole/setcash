# PROJ-9: Categories & Motives Admin Pages

## Status: Complete
**Created:** 2026-03-01
**Last Updated:** 2026-03-06

## Overview
Admin-only management pages for project-level Motives (primary budget axis) and Categories (secondary budget axis). These pages allow project admins to define the allocation structure used when categorizing bills and tracking spending against budgets.

## Dependencies
- Requires: PROJ-5 (auth — admin-only pages)
- Requires: PROJ-6 (PostgreSQL data)
- Requires: PROJ-8 (Settings Layout — for sidebar navigation structure)

## Background

### Current Express Implementation
The legacy Express app provides CRUD APIs for motives and categories with the following characteristics:

**Categories (`routes/categories.js`):**
- GET /api/categories — List all categories for current project (ordered by id)
- POST /api/admin/category — Create with name + budget (requires admin)
- PUT /api/admin/category/:id — Update name and/or budget (requires admin)
- DELETE /api/admin/category/:id — Delete category (requires admin)

**Motives (`routes/motives.js`):**
- GET /api/motives — List all motives for current project (ordered by id)
- POST /api/admin/motive — Create with name + budget (requires admin)
- PUT /api/admin/motive/:id — Update name and/or budget (requires admin)
- DELETE /api/admin/motive/:id — Delete motive (requires admin)

### Protected Defaults
Per `specification.md` Section 5, certain entities are protected system defaults:
- **Motive: "Default"** — Cannot be renamed or deleted. Automatically receives remainder allocation when motive percentages don't sum to 100%.
- **Category: "Uncategorized"** — Cannot be renamed or deleted. Serves as fallback for unallocated spending.

### Database Schema (Prisma)
```
model Motive {
  id        String  @id @default(uuid())
  projectId String
  name      String
  budget    Decimal @default(0)
  billMotives  BillMotive[]
  budgetMatrix BudgetMatrix[]
}

model Category {
  id        String  @id @default(uuid())
  projectId String
  name      String
  budget    Decimal @default(0)
  billCategories BillCategory[]
  budgetMatrix   BudgetMatrix[]
}
```

## User Stories

### Admin User Stories
- As a project admin, I want to view all motives for my project so I can understand the current budget allocation structure.
- As a project admin, I want to create new motives with a name and optional budget so I can track spending against specific budget areas.
- As a project admin, I want to rename existing motives so I can keep terminology aligned with project needs.
- As a project admin, I want to update motive budgets so I can adjust planning as project requirements change.
- As a project admin, I want to delete motives that are no longer needed so the list remains clean and relevant.
- As a project admin, I want to manage categories with the same capabilities as motives for secondary budget tracking.

### Protection & Safety Stories
- As a project admin, I want the "Default" motive to be protected from deletion so the system always has a fallback allocation target.
- As a project admin, I want the "Uncategorized" category to be protected from deletion so unallocated bills can always be categorized.
- As a project admin, I want clear visual indication of protected defaults so I understand which items cannot be modified.
- As a project admin, I want to understand the impact of deleting a motive/category that has bill allocations so I can make informed decisions.

### User Impact Stories
- As a user uploading a bill, I want to see an up-to-date list of motives and categories in the allocation widget so I can correctly categorize expenses.
- As a user viewing spending reports, I want motive and category data to be consistent with what admins have configured.

## Acceptance Criteria

### Page Structure & Access Control

**AC1: Admin-Only Access**
- [ ] Routes `/settings/motives` and `/settings/categories` are accessible only to users with `admin` or `owner` role in the current project
- [ ] Non-admin users receive 403 Forbidden or are redirected to settings overview
- [ ] Page renders within the protected settings layout with sidebar navigation

**AC2: Navigation Integration**
- [ ] Both pages appear in the Settings sidebar under an "Allocation Axes" or "Budget Structure" section
- [ ] Active page is highlighted in navigation
- [ ] Breadcrumb shows: Settings > Motives (or Settings > Categories)

### List Display

**AC3: Motives List Page (`/settings/motives`)**
- [ ] Displays all motives for the current project in a table format
- [ ] Columns: Name, Budget, Actions (Edit, Delete)
- [ ] List is ordered by creation date (oldest first) to maintain stable ordering
- [ ] "Default" motive always appears at the top of the list regardless of creation order
- [ ] Shows budget formatted as currency (2 decimal places)
- [ ] Empty state message when only "Default" exists: "No custom motives. Add your first motive above."

**AC4: Categories List Page (`/settings/categories`)**
- [ ] Displays all categories for the current project in a table format
- [ ] Columns: Name, Budget, Actions (Edit, Delete)
- [ ] List is ordered by creation date (oldest first) to maintain stable ordering
- [ ] "Uncategorized" category always appears at the top of the list regardless of creation order
- [ ] Shows budget formatted as currency (2 decimal places)
- [ ] Empty state message when only "Uncategorized" exists: "No custom categories. Add your first category above."

### Create Operations

**AC5: Add New Motive Form**
- [ ] Form positioned at top of the motives list
- [ ] Input fields:
  - Name (required, text input, max 100 characters)
  - Budget (optional, number input, default 0, min 0, 2 decimal places)
- [ ] Submit button labeled "Add Motive"
- [ ] On successful creation:
  - New motive appears in list immediately (optimistic update or revalidate)
  - Form fields reset to empty/default values
  - Success toast/notification appears
- [ ] Validation:
  - Name is required → error: "Motive name is required"
  - Name must be unique within project (case-insensitive) → error: "A motive with this name already exists"
  - Name trimmed of whitespace before validation
  - Empty name after trimming → error: "Name cannot be empty"
  - Budget must be ≥ 0 → error: "Budget cannot be negative"

**AC6: Add New Category Form**
- [ ] Same structure as motives form with "Category" terminology
- [ ] Input fields:
  - Name (required, text input, max 100 characters)
  - Budget (optional, number input, default 0, min 0, 2 decimal places)
- [ ] Same validation rules as motives (adapted for categories)

### Edit Operations

**AC7: Inline Rename for Motives**
- [ ] Clicking motive name transforms row into edit mode
- [ ] Name becomes text input with current value pre-filled
- [ ] Edit controls: Save (checkmark icon) and Cancel (X icon)
- [ ] Save triggers on:
  - Enter key press
  - Blur event (if value changed)
  - Clicking Save button
- [ ] Cancel reverts to original value
- [ ] On successful save:
  - Row returns to display mode with new name
  - Name updates in list immediately
  - Success toast appears
- [ ] Validation (same as create):
  - Empty after trim → error, revert to original
  - Duplicate name → error displayed inline, stay in edit mode

**AC8: Inline Rename for Categories**
- [ ] Same behavior as motives rename

**AC9: Budget Editing**
- [ ] Clicking budget amount transforms into number input
- [ ] Input pre-filled with current budget value
- [ ] Save on Enter or blur (if changed)
- [ ] Cancel on Escape or clicking outside without change
- [ ] Validation: Budget ≥ 0 → error if negative

### Protected Defaults Behavior

**AC10: "Default" Motive Protection**
- [ ] "Default" motive row displays a lock icon next to name
- [ ] Hovering lock shows tooltip: "Default motive — cannot be renamed or deleted"
- [ ] Edit button is disabled for "Default" motive
- [ ] Delete button is disabled for "Default" motive
- [ ] Clicking name on "Default" motive does NOT enter edit mode
- [ ] Attempting to update "Default" via API returns 400 error: "Cannot edit Default motive"
- [ ] Attempting to delete "Default" via API returns 400 error: "Cannot delete Default motive"

**AC11: "Uncategorized" Category Protection**
- [ ] Same protection rules as "Default" motive
- [ ] Tooltip: "Default category — cannot be renamed or deleted"
- [ ] API errors: "Cannot edit Uncategorized category" / "Cannot delete Uncategorized category"

### Delete Operations

**AC12: Delete Confirmation Flow**
- [ ] Delete button shows confirmation popover/modal before proceeding
- [ ] Confirmation message: "Delete '[name]'? This action cannot be undone."
- [ ] For items WITH bill allocations, additional warning: "This [motive/category] is used by N bill(s). Deleting will remove all allocations."
- [ ] Confirm button labeled "Delete" (red/danger styling)
- [ ] Cancel button dismisses confirmation
- [ ] On confirm:
  - Item removed from list immediately
  - Success toast: "'[name]' deleted successfully"
- [ ] On error (e.g., concurrent modification):
  - Error toast displayed
  - List refreshes to current state

**AC13: Cascade Delete Behavior**
- [ ] Deleting a motive removes all associated records:
  - All `bill_motives` junction records for this motive
  - All `budget_matrix` records for this motive
- [ ] Deleting a category removes all associated records:
  - All `bill_categories` junction records for this category
  - All `budget_matrix` records for this category
- [ ] Bills themselves are NOT deleted — only their allocation to the deleted motive/category

### Project Scoping

**AC14: Strict Project Isolation**
- [ ] All operations are scoped to current `projectId` from session
- [ ] Admin cannot view, edit, or delete motives/categories from other projects
- [ ] API returns 404 (not 403) if motive/category exists but belongs to different project (prevent ID enumeration)
- [ ] All database queries include `WHERE projectId = ?` condition

### Real-Time Updates

**AC15: Bill Form Synchronization**
- [ ] Changes to motives/categories are reflected in the bill upload form's allocation widget
- [ ] No full page reload required — use `revalidatePath` or optimistic updates
- [ ] If bill form is open during admin changes, new items appear in dropdown on next interaction

## Edge Cases

### Validation Edge Cases

**EC1: Whitespace Handling**
- Name with only whitespace (spaces, tabs) → trimmed to empty → rejected with "Name cannot be empty"
- Name with leading/trailing whitespace → trimmed before save and validation
- Name with internal multiple spaces → preserved as-is (don't over-normalize)

**EC2: Case Sensitivity**
- Duplicate check is case-insensitive: "Equipment" and "equipment" are considered duplicates
- Storage preserves original casing of first creation
- Error message: "A motive with this name already exists" (or category equivalent)

**EC3: Special Characters**
- Names can contain any Unicode characters except control characters
- HTML special characters (<, >, &, ") are escaped in display
- Names up to 100 characters are accepted
- Empty string → rejected

**EC4: Budget Input Edge Cases**
- Budget field empty → treated as 0
- Budget with more than 2 decimal places → rounded or rejected (define behavior)
- Budget with leading zeros → normalized (e.g., "007" → "7")
- Budget with non-numeric characters → rejected with "Please enter a valid number"
- Very large budgets (e.g., > 999,999,999) → handle gracefully or set max limit

### Concurrency Edge Cases

**EC5: Simultaneous Edit Conflicts**
- Two admins edit the same motive name simultaneously:
  - Last write wins (standard behavior)
  - Both see success toast
  - No complex merge strategy required for MVP

**EC6: Concurrent Creation of Duplicate Names**
- Two admins submit "Equipment" at the same time:
  - Database unique constraint catches the conflict
  - Second request returns error: "A motive with this name already exists"
  - Second admin's form stays populated with their input

**EC7: Delete During Edit**
- Admin A starts editing motive name
- Admin B deletes that motive
- Admin A submits rename:
  - API returns 404 "Motive not found"
  - UI shows error toast and removes the row (it no longer exists)

### Data Integrity Edge Cases

**EC8: Deleting with Bill Allocations**
- Motive/category has 50+ bills allocated to it
- Admin deletes the motive/category
- All bill_motives/bill_categories records are cascade-deleted
- Bills remain in system but show no allocation for that axis
- Spending reports reflect the change immediately

**EC9: Single Allocated Bill**
- A bill has 100% allocation to Motive X
- Admin deletes Motive X
- Bill's motive allocation becomes empty (0% total)
- Bill upload form should handle empty allocations gracefully

**EC10: Last Custom Item Deletion**
- Project has only "Default" motive and one custom motive
- Admin deletes the custom motive
- List shows only "Default" with appropriate empty state message

### Protected Defaults Edge Cases

**EC11: Attempted Rename of Protected via API**
- Malicious/broken client attempts to PUT "Default" → name: "Hacked"
- API rejects with 400 "Cannot edit Default motive"
- Database remains unchanged
- Same for "Uncategorized" category

**EC12: Attempted Delete of Protected via API**
- DELETE request sent for "Default" motive ID
- API rejects with 400 "Cannot delete Default motive"
- Database remains unchanged
- Same for "Uncategorized" category

### Network/Error Edge Cases

**EC13: Network Failure During Create**
- Admin submits new motive
- Network fails (offline or server error)
- Show error toast: "Failed to create motive. Please try again."
- Keep form values populated for retry
- Don't optimistically add to list until confirmed

**EC14: Server Error During Delete**
- Admin confirms delete
- Server returns 500 error
- Show error toast: "Failed to delete motive. Please try again."
- Item remains in list
- Admin can retry

**EC15: Session Expiration**
- Admin is on motives page, session expires
- Attempts to create/edit/delete
- API returns 401 Unauthorized
- User redirected to login page with return URL

### UI/UX Edge Cases

**EC16: Very Long Names**
- Motive name with 100 characters
- Table cell handles overflow gracefully (truncate with ellipsis or wrap)
- Full name visible on hover via title attribute or tooltip

**EC17: Many Items in List**
- Project has 50+ motives
- List remains performant (no virtualization needed for this scale)
- Consider max-height with internal scroll or pagination for 100+ items

**EC18: Rapid Sequential Operations**
- Admin quickly creates 5 motives in succession
- Each creation completes successfully
- No race conditions or state corruption
- List updates smoothly without jarring jumps

## Technical Requirements

### API Design (Server Actions)

**Server Actions for Motives:**
```typescript
// app/(protected)/settings/motives/actions.ts
async function createMotive(projectId: string, data: { name: string; budget?: number }): Promise<Motive>
async function updateMotive(projectId: string, motiveId: string, data: { name?: string; budget?: number }): Promise<Motive>
async function deleteMotive(projectId: string, motiveId: string): Promise<void>
async function getMotives(projectId: string): Promise<Motive[]>
```

**Server Actions for Categories:**
```typescript
// app/(protected)/settings/categories/actions.ts
async function createCategory(projectId: string, data: { name: string; budget?: number }): Promise<Category>
async function updateCategory(projectId: string, categoryId: string, data: { name?: string; budget?: number }): Promise<Category>
async function deleteCategory(projectId: string, categoryId: string): Promise<void>
async function getCategories(projectId: string): Promise<Category[]>
```

### Authorization Requirements
- All Server Actions must verify current user has `admin` or `owner` role for the project
- Use existing auth middleware pattern from PROJ-5

### Caching & Revalidation
- Use `revalidatePath('/settings/motives')` after motive mutations
- Use `revalidatePath('/settings/categories')` after category mutations
- Consider `revalidatePath('/(protected)/upload')` or tag-based revalidation for bill form updates

### Validation Requirements
- Name uniqueness: Database unique constraint on `(projectId, name)` with case-insensitive comparison
- Budget: Decimal(10,2), non-negative
- Name: Trimmed, non-empty, max 100 chars

### Error Handling
- All validation errors return structured response with field-level errors
- Authorization errors return 403
- Not found errors return 404
- Protected default violations return 400 with descriptive message

## Migration Notes (from Express)

### Behavior Changes
| Aspect | Express (Legacy) | Next.js (New) |
|--------|-----------------|---------------|
| API Path | /api/admin/motive, /api/admin/category | Server Actions |
| Ordering | ORDER BY id | ORDER BY createdAt, with Default/Uncategorized first |
| Protected check | exact name === "Default"/"Uncategorized" | Same, but case-sensitive in code |
| Budget default | 0 | 0 (Prisma default) |
| Cascade delete | Manual DELETE queries | Prisma `onDelete: Cascade` |

### Data Migration
- Existing SQLite data will be migrated to PostgreSQL via migration scripts (handled in PROJ-6)
- `legacyId` fields preserve original IDs for reference
- Protected defaults ("Default", "Uncategorized") will have their names preserved during migration

## Open Questions

1. **Budget Editing UI**: Should budget editing be inline (like name) or in a separate modal/form?
2. **Maximum Items**: Should there be a limit on motives/categories per project (e.g., 100)?
3. **Reorder/Drag-Drop**: Should admins be able to reorder motives/categories via drag-and-drop?
4. **Color Coding**: Should motives/categories have optional color coding for visual distinction in reports?
5. **Import/Export**: Should there be bulk import/export for motives/categories?

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Overview
PROJ-9 creates admin-only management pages for Motives (primary budget axis) and Categories (secondary budget axis). These settings pages allow project admins to define the allocation structure used when categorizing bills and tracking spending against budgets.

**Key Challenge:** This feature requires both a settings layout structure (tabs/sidebar) and two nearly identical management interfaces. The "protected defaults" (Default motive, Uncategorized category) require special UI handling to communicate their immutable nature.

### Component Structure (Visual Tree)

```
Settings Layout (/settings/*)
├── Settings Sidebar
│   ├── Section: "Budget Structure"
│   │   ├── Nav Item: "Motives" → /settings/motives (active highlight)
│   │   └── Nav Item: "Categories" → /settings/categories (active highlight)
│   └── ... other settings sections
│
├── Motives Page (/settings/motives)
│   ├── Page Header
│   │   ├── Title "Motives"
│   │   └── Subtitle "Manage budget allocation motives"
│   ├── Add New Form (inline at top)
│   │   ├── Name input (required)
│   │   ├── Budget input (optional, default 0)
│   │   └── "Add Motive" button
│   └── Motives List (DataTable)
│       ├── Column: Name (click to edit inline)
│       ├── Column: Budget (click to edit inline)
│       ├── Column: Actions
│       │   ├── Edit button (disabled for "Default")
│       │   └── Delete button (disabled for "Default")
│       └── Row States:
│           ├── Protected "Default" row: lock icon, muted styling, disabled actions
│           └── Normal rows: editable, deletable with confirmation
│
└── Categories Page (/settings/categories)
    ├── Page Header
    │   ├── Title "Categories"
    │   └── Subtitle "Manage spending categories"
    ├── Add New Form (inline at top)
    │   ├── Name input (required)
    │   ├── Budget input (optional, default 0)
    │   └── "Add Category" button
    └── Categories List (DataTable)
        ├── Same structure as Motives list
        └── Protected "Uncategorized" row handled identically to "Default"

Delete Confirmation Modal
├── Warning message: "Delete '[name]'? This action cannot be undone."
├── Conditional warning (if has bills): "This [motive/category] is used by N bill(s)."
├── "Cancel" button (secondary)
└── "Delete" button (red/danger)

Inline Edit Mode (per row)
├── Name cell becomes text input
├── Budget cell becomes number input
├── Save control (checkmark icon)
└── Cancel control (X icon)
```

### Data Model (Plain Language)

**Motive Entity:**
- Each motive belongs to exactly one project (project-scoped)
- Has a display name (max 100 characters, unique within project)
- Has a budget amount (decimal, non-negative, default 0)
- Protected "Default" motive exists for every project (cannot rename or delete)
- Tracks creation time for stable list ordering

**Category Entity:**
- Identical structure to Motive
- Protected "Uncategorized" category exists for every project (cannot rename or delete)
- Same project-scoping and uniqueness rules apply

**Protected Defaults Logic:**
- System automatically creates "Default" motive and "Uncategorized" category when a project is created
- These items are identified by their exact names (case-sensitive)
- They appear at the top of lists regardless of creation date
- All editing actions are disabled in UI; API returns 400 if attempted

**Cascade Delete Behavior:**
- Deleting a motive/category removes all bill allocations to that item
- Bills themselves remain intact — only the allocation percentages are cleared
- Budget matrix entries for that motive/category are also removed
- This is irreversible (no soft delete)

### Tech Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Settings Layout** | Shared sidebar + tab content area | PROJ-8 establishes the settings shell; Motives/Categories appear under "Budget Structure" section |
| **List Display** | Reuse DataTable component | Already built for PROJ-7 bills list; supports sorting, empty states, and loading skeletons |
| **Add Form** | Inline at top of page | Faster than modal for single-field creation; pattern matches admin expectations |
| **Editing** | Inline (click to edit) | More efficient than modal for simple field updates; save on Enter/blur |
| **Budget Editing** | Same inline pattern as name | Consistency; both are simple scalar fields |
| **Delete Confirmation** | Modal dialog | Prevents accidental deletion; allows showing bill count warning |
| **Protected Items UI** | Disabled buttons + lock icon + tooltip | Clear visual communication; prevents user frustration from attempting blocked actions |
| **Optimistic Updates** | Yes for delete, no for create | Delete feels instant (user expects removal); create waits for server to get the new ID |
| **State Management** | React useState + Server Actions | No global state needed; each page manages its own data with revalidatePath |

### Code Reuse Opportunities

**From PROJ-7 (Bills Feature):**
- `DataTable` component — handles table rendering, sorting, empty states, loading skeletons
- `CropModal` pattern — can be adapted for delete confirmation (similar structure: header, content, actions)
- Server Actions pattern — auth checks, error handling, revalidation
- Toast notification system — for success/error feedback

**From Existing Express Routes:**
- Validation rules (name uniqueness, budget non-negative)
- Protected defaults check logic (name === "Default" or "Uncategorized")
- Project scoping patterns (WHERE projectId = ?)

**Shared Between Motives & Categories:**
- List item component (accepts props for name, budget, protected status)
- Inline edit input component (text input with save/cancel)
- Delete confirmation modal (accepts item name and bill count)
- Server Action error handling patterns

### Dependencies

No new packages required. Uses existing project dependencies:

| Package | Purpose |
|---------|---------|
| `next` | App Router, Server Actions, revalidatePath |
| `@prisma/client` | Database queries for Motive/Category models |
| `next-auth` | Session handling for admin authorization |
| `tailwindcss` | Styling (already has table, form, button styles) |
| `lucide-react` | Icons (Lock, Edit, Trash, Check, X) |

### API Design (Server Actions)

**Motives Actions:**
- `getMotives(projectId)` — Returns sorted list (Default first, then by createdAt)
- `createMotive(projectId, { name, budget })` — Validates uniqueness, returns new motive
- `updateMotive(projectId, motiveId, { name?, budget? })` — Rejects if protected
- `deleteMotive(projectId, motiveId)` — Cascade deletes allocations, rejects if protected

**Categories Actions:**
- Mirror of Motives actions with "category" terminology
- Same validation and protection rules

### Security Considerations

- All Server Actions verify `session.user.role` is `admin` or `owner`
- Project scoping enforced on every query (users cannot access other projects' data)
- Protected defaults enforced at API layer (not just UI)
- 404 returned for cross-project ID attempts (prevents enumeration)

### Migration Notes

- Existing SQLite data migrates via PROJ-6 scripts
- Protected defaults names preserved during migration
- Prisma schema already has Motive/Category models with correct relations

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
