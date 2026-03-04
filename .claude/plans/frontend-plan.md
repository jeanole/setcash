# Frontend Implementation Plan

## Feature
PROJ-17: Super-Admin Panel
Spec: `features/PROJ-17-super-admin.md`

## Context Summary

### Existing Components to Reuse
1. **DataTable** (`nextjs/components/ui/DataTable.tsx`) - Reusable table with loading, empty states, sorting
2. **CropModal** (`nextjs/components/bills/CropModal.tsx`) - Modal pattern with z-50, backdrop, header, close button
3. **Sidebar** (`nextjs/components/layout/Sidebar.tsx`) - Current sidebar structure (needs Super Admin button added)
4. **BillStatusBadge** (`nextjs/components/bills/BillStatusBadge.tsx`) - Badge pattern for role display

### Design Patterns from Existing Code
- **Modal styling**: `z-50`, `bg-black/70` backdrop, `rounded-2xl` container, `shadow-xl`
- **Table styling**: `bg-white`, `rounded-xl`, `border border-slate-200`, `shadow-sm`
- **Button styling**: `bg-indigo-600`, `hover:bg-indigo-700`, `rounded-lg`
- **Color scheme**: Slate grays, Indigo primary, White backgrounds
- **Icons**: Lucide icons (already used in codebase)

### Existing API Routes (to reference)
- `nextjs/app/api/categories/route.ts` - CRUD pattern with Prisma
- `nextjs/app/api/motives/route.ts` - Similar CRUD pattern

### Express Implementation to Port
- `routes/superadmin.js` - All business logic exists here, needs translation to Next.js

## User Decisions

Based on the existing codebase patterns:

1. **Design Style**: Follow existing vBudget design system (already established)
   - Slate/indigo color palette
   - Rounded corners (`rounded-xl`, `rounded-2xl`)
   - Shadow levels (`shadow-sm`, `shadow-xl`)

2. **Mobile/Responsive**: Desktop-first (existing app pattern), but tables should scroll horizontally on mobile

3. **Interactions**:
   - Escape key closes modals
   - Click outside modal to close
   - Loading states with pulse animation
   - Toast notifications for success/error

4. **Accessibility**: Use existing patterns from DataTable (aria-labels, focus rings)

## Open Bug Reports to Address
None for PROJ-17.

## New Components to Build

### 1. SuperAdminButton (Sidebar Integration)
**Location:** Modify `nextjs/components/layout/Sidebar.tsx`
- Add "Super Admin" button in SETTINGS section
- Only visible if `session.user.isSuperAdmin === true`
- Shield icon (Lucide: `Shield`)
- Opens SuperAdminModal on click

### 2. SuperAdminModal (Main Container)
**Location:** `nextjs/components/superadmin/SuperAdminModal.tsx`
- Fullscreen modal (`z-50`, `bg-black/70` backdrop)
- Fixed positioning, full width/height
- Header with title "Super Admin", close button (X)
- Two-tab navigation: Projects | Users
- State: activeTab ('projects' | 'users')
- Escape key handler to close

### 3. ProjectsTab
**Location:** `nextjs/components/superadmin/ProjectsTab.tsx`
- DataTable with columns: Name, Subtitle, Created, Members, Actions
- Actions: Members button, Delete button
- Delete confirmation dialog
- Empty state: "No projects found"
- Opens MembersSubModal on "Members" click

### 4. UsersTab
**Location:** `nextjs/components/superadmin/UsersTab.tsx`
- DataTable with columns: Email, Super Admin (badge), Projects, Actions
- Actions: Toggle Admin, Reset Password, Delete
- Self-delete protection (disable delete for current user)
- Empty state: "No users found"
- Opens PasswordResetModal on "Reset Password"

### 5. MembersSubModal (Nested)
**Location:** `nextjs/components/superadmin/MembersSubModal.tsx`
- Modal within modal (`z-[60]`)
- Header: "Members: {projectName}"
- Two sections:
  - Members List (table with Email, Role, Position, Actions)
  - Position Management (list with Add/Rename/Delete)
- "Add Member" form (inline or modal)
- Role badges: User (gray), Admin (blue), Owner (purple)
- "Misc" position protection (no edit/delete)

### 6. PasswordResetModal
**Location:** `nextjs/components/superadmin/PasswordResetModal.tsx`
- Two-step modal:
  - Step 1: Confirm reset
  - Step 2: Display generated password with Copy button
- Warning: "Copy this password now. It will not be shown again."
- Read-only password field
- Copy to clipboard functionality

### 7. ConfirmationDialog (Reusable)
**Location:** `nextjs/components/ui/ConfirmationDialog.tsx`
- Generic confirmation component
- Props: isOpen, title, message, onConfirm, onCancel, confirmText, cancelText, isDestructive
- Destructive styling for delete actions (red buttons)

### 8. RoleBadge
**Location:** `nextjs/components/ui/RoleBadge.tsx`
- Display role with color coding
- User: gray/slate
- Admin: blue
- Owner: purple
- Small badge component

## Pages / Routes to Create or Modify

### Modify: Sidebar
**File:** `nextjs/components/layout/Sidebar.tsx`
- Add Super Admin button in SETTINGS section (below System if exists, or at bottom)
- Button only visible to super-admins
- Shield icon (Lucide)
- Opens SuperAdminModal (client-side state)

### New: Super Admin API Routes (for Backend Phase)
**Routes to create:**
- `GET /api/admin/projects` - List all projects with member count
- `DELETE /api/admin/projects/[id]` - Delete project
- `GET /api/admin/users` - List all users with project count
- `POST /api/admin/users` - Create user
- `PUT /api/admin/users/[email]` - Update user (toggle admin, reset password)
- `DELETE /api/admin/users/[email]` - Delete user
- `GET /api/admin/projects/[id]/members` - List project members
- `POST /api/admin/projects/[id]/members` - Add member
- `PUT /api/admin/projects/[id]/members/[memberId]` - Update member
- `DELETE /api/admin/projects/[id]/members/[memberId]` - Remove member
- `GET /api/admin/projects/[id]/positions` - List positions
- `POST /api/admin/projects/[id]/positions` - Create position
- `PUT /api/admin/projects/[id]/positions/[posId]` - Rename position
- `DELETE /api/admin/projects/[id]/positions/[posId]` - Delete position

## Data Connection

### API Endpoints to Connect (Frontend)
| Component | Endpoint | Method | Purpose |
|-----------|----------|--------|---------|
| ProjectsTab | /api/admin/projects | GET | Fetch all projects |
| ProjectsTab | /api/admin/projects/[id] | DELETE | Delete project |
| UsersTab | /api/admin/users | GET | Fetch all users |
| UsersTab | /api/admin/users/[email] | PUT | Toggle admin, reset password |
| UsersTab | /api/admin/users/[email] | DELETE | Delete user |
| MembersSubModal | /api/admin/projects/[id]/members | GET | List members |
| MembersSubModal | /api/admin/projects/[id]/members | POST | Add member |
| MembersSubModal | /api/admin/projects/[id]/members/[id] | PUT | Update member |
| MembersSubModal | /api/admin/projects/[id]/members/[id] | DELETE | Remove member |
| MembersSubModal | /api/admin/projects/[id]/positions | GET | List positions |
| MembersSubModal | /api/admin/projects/[id]/positions | POST | Create position |
| MembersSubModal | /api/admin/projects/[id]/positions/[id] | PUT | Rename position |
| MembersSubModal | /api/admin/projects/[id]/positions/[id] | DELETE | Delete position |

### Loading/Error State Handling
- Use DataTable's built-in `isLoading` prop for loading states
- Toast notifications for success/error (existing pattern in app)
- Form validation errors shown inline

## Design Specifications

### Colors
- **Primary**: Indigo (`bg-indigo-600`, `hover:bg-indigo-700`)
- **Danger**: Red (`bg-red-600`, `hover:bg-red-700`)
- **Neutral**: Slate (`bg-slate-50`, `bg-slate-100`, `text-slate-500`)
- **Success**: Green (for success toasts)

### Typography
- Headings: `text-lg font-semibold text-slate-800`
- Body: `text-sm text-slate-600`
- Table headers: `text-xs font-medium text-slate-500 uppercase tracking-wider`

### Spacing
- Modal padding: `p-4` on backdrop, `px-6 py-4` on header/footer
- Table padding: `px-3 py-3` on cells
- Component gaps: `gap-3` or `gap-4`

### Modal z-Index Stack
- Main SuperAdminModal: `z-50`
- Nested MembersSubModal/PasswordResetModal: `z-[60]`
- Backdrop: Same z-index with `bg-black/70`

## Checklist

### Components
- [ ] Add SuperAdminButton to Sidebar (conditional on isSuperAdmin)
- [ ] Create SuperAdminModal with tab navigation
- [ ] Create ProjectsTab with DataTable
- [ ] Create UsersTab with DataTable
- [ ] Create MembersSubModal (nested)
- [ ] Create PasswordResetModal (two-step)
- [ ] Create ConfirmationDialog (reusable)
- [ ] Create RoleBadge component

### Integration
- [ ] Sidebar shows Super Admin button only for super-admins
- [ ] Modal opens on button click
- [ ] Tab switching works
- [ ] All tables load data from APIs
- [ ] All actions trigger API calls
- [ ] Loading states shown
- [ ] Error states handled
- [ ] Toast notifications for feedback

### Testing
- [ ] Modal opens/closes correctly
- [ ] Escape key closes modals
- [ ] Click outside closes modals
- [ ] Nested modals stack properly
- [ ] Self-delete button is disabled
- [ ] Role badges show correct colors
