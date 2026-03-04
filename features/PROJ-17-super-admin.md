# PROJ-17: Super-Admin

## Status: Planned
**Created:** 2026-03-04
**Last Updated:** 2026-03-04

## Dependencies
- Requires: PROJ-5 (NextAuth.js auth — protected routes with super-admin role)
- Requires: PROJ-6 (PostgreSQL data available via Prisma)
- Requires: PROJ-10 (Members management — for per-project member UI)

## User Stories
- As a super-admin, I want to access a super-admin panel from the sidebar so that I can manage the system.
- As a super-admin, I want to see all projects in the system so that I can monitor them.
- As a super-admin, I want to delete projects so that I can remove abandoned/test projects.
- As a super-admin, I want to see all users in the system so that I can manage accounts.
- As a super-admin, I want to grant/revoke super-admin status so that I can delegate system administration.
- As a super-admin, I want to reset user passwords so that I can help locked-out users.
- As a super-admin, I want to delete user accounts so that I can remove inactive accounts.
- As a super-admin, I want to manage project members for any project so that I can assist project owners.

## Acceptance Criteria

### Sidebar Access
- [ ] **AC-1.1**: "Super Admin" button visible in sidebar only to users with `isSuperAdmin = true`
- [ ] **AC-1.2**: Button appears in the "SETTINGS" section of the sidebar, below "System"
- [ ] **AC-1.3**: Button has a shield/admin icon to distinguish it from regular settings
- [ ] **AC-1.4**: Clicking the button opens the fullscreen super-admin modal

### Fullscreen Modal Layout
- [ ] **AC-2.1**: Modal uses full-screen overlay (similar to existing app patterns)
- [ ] **AC-2.2**: Header contains: title "Super Admin", close button (X), and tab navigation
- [ ] **AC-2.3**: Two-tab layout using tab component: "Projects" | "Users"
- [ ] **AC-2.4**: Tab state persists during modal session (switching tabs doesn't lose state)
- [ ] **AC-2.5**: Press Escape or clicking close button closes the modal

### Tab 1 — Projects
- [ ] **AC-3.1**: Table displays all projects in the system with columns:
  - **Name**: Project name (primary identifier)
  - **Subtitle**: Project subtitle (nullable, show "—" if empty)
  - **Created**: Creation date (formatted as locale date)
  - **Members**: Member count (number of project_members entries)
- [ ] **AC-3.2**: Each row has action buttons: "Members" and "Delete"
- [ ] **AC-3.3**: Projects are sorted by ID ascending (oldest first)
- [ ] **AC-3.4**: Empty state: Show message "No projects found" if table is empty

#### Project Delete Action
- [ ] **AC-3.5**: Clicking "Delete" opens a confirmation dialog with:
  - Warning message: "Delete project '{name}'? This action cannot be undone."
  - "Cancel" and "Delete" buttons
- [ ] **AC-3.6**: Confirming deletion calls API and removes the project from the list
- [ ] **AC-3.7**: Success: Show toast "Project deleted"
- [ ] **AC-3.8**: Error: Show error toast with server message

#### Members Button (Sub-modal)
- [ ] **AC-3.9**: Clicking "Members" opens a nested modal for per-project member management
- [ ] **AC-3.10**: Sub-modal header shows: "Members: {project name}"
- [ ] **AC-3.11**: Sub-modal contains two sections: Members List and Position Management

**Members List Section:**
- [ ] **AC-3.12**: Table columns: Email, Role, Position
- [ ] **AC-3.13**: Role displayed as badge: "User", "Admin", or "Owner"
- [ ] **AC-3.14**: Position shows position name or "Misc" if null
- [ ] **AC-3.15**: Actions per member: Edit role/position, Remove
- [ ] **AC-3.16**: "Add Member" button opens a form with:
  - Email input (must be existing user)
  - Role dropdown: "user", "admin", "owner"
  - Position dropdown (optional, lists project positions)
- [ ] **AC-3.17**: Adding member validates: user must exist, email required
- [ ] **AC-3.18**: Error if user is already a member: "User is already a member"

**Edit Member:**
- [ ] **AC-3.19**: Clicking Edit opens inline or modal form to change role and position
- [ ] **AC-3.20**: Role change to/from "owner" is allowed (super-admin bypass)

**Remove Member:**
- [ ] **AC-3.21**: Clicking Remove shows confirmation: "Remove {email} from project?"
- [ ] **AC-3.22**: Confirm removes member and updates list

**Position Management Section:**
- [ ] **AC-3.23**: List of project positions with "Add Position" button
- [ ] **AC-3.24**: Each position shows: name, count of members using it
- [ ] **AC-3.25**: "Misc" position is always present and cannot be edited/deleted
- [ ] **AC-3.26**: Non-Misc positions can be renamed inline
- [ ] **AC-3.27**: Non-Misc positions can be deleted (members move to "Misc")
- [ ] **AC-3.28**: Adding position: input name, validate unique per project
- [ ] **AC-3.29**: Error on duplicate: "Position already exists"
- [ ] **AC-3.30**: Sub-modal has "Close" button to return to Projects tab

### Tab 2 — Users
- [ ] **AC-4.1**: Table displays all global users with columns:
  - **Email**: User's email address
  - **Super Admin**: Badge/shield icon shown only if `isSuperAdmin = true`
  - **Projects**: Count of projects the user is a member of
- [ ] **AC-4.2**: Users are sorted by email ascending (A-Z)
- [ ] **AC-4.3**: Each row has action buttons: "Toggle Admin", "Reset Password", "Delete"
- [ ] **AC-4.4**: Empty state: Show message "No users found" if table is empty

#### Toggle Super-Admin Action
- [ ] **AC-4.5**: "Toggle Admin" button shows current state:
  - If user is super-admin: button shows "Revoke Admin" (or icon with red indicator)
  - If user is not super-admin: button shows "Make Admin" (or icon with green indicator)
- [ ] **AC-4.6**: Clicking opens confirmation dialog:
  - For granting: "Grant super-admin privileges to {email}?"
  - For revoking: "Revoke super-admin privileges from {email}?"
- [ ] **AC-4.7**: Confirming calls API to toggle `isSuperAdmin` flag
- [ ] **AC-4.8**: Success: Update badge in table, show toast "Admin privileges updated"
- [ ] **AC-4.9**: User can revoke their own super-admin status (no special protection)

#### Reset Password Action
- [ ] **AC-4.10**: Clicking "Reset Password" opens confirmation: "Reset password for {email}?"
- [ ] **AC-4.11**: Confirming generates a secure random password (12+ characters, mixed case + digits)
- [ ] **AC-4.12**: Modal displays the new password ONCE with:
  - Warning: "Copy this password now. It will not be shown again."
  - Password in a read-only, selectable text field
  - "Copy to Clipboard" button
  - "Close" button
- [ ] **AC-4.13**: Password is hashed and stored server-side (not retrievable again)
- [ ] **AC-4.14**: User must be notified externally (out of scope for UI)

#### Delete User Action
- [ ] **AC-4.15**: Clicking "Delete" opens confirmation dialog:
  - Warning: "Delete user {email}? This cannot be undone."
  - "Cancel" and "Delete" buttons
- [ ] **AC-4.16**: Self-delete protection: If email matches current user, show error "Cannot delete yourself" and disable delete
- [ ] **AC-4.17**: Confirming deletes user and all their project memberships
- [ ] **AC-4.18**: Success: Remove user from table, show toast "User deleted"

### API Endpoints (Super-Admin Only)

All endpoints require `session.user.isSuperAdmin === true`.

**Projects:**
- [ ] **API-1**: `GET /api/admin/projects` — List all projects
  - Response: `[{ id, name, subtitle, createdAt, memberCount }]`
  - `memberCount` calculated from `project_members` count per project
  
- [ ] **API-2**: `DELETE /api/admin/projects/[id]` — Delete project
  - Cascade: Delete related records in `project_members`, `project_positions`, `project_settings`
  - Cleanup: Delete records in `bills`, `motives`, `categories`, `vgeld`, `editlog`, `budget_matrix` where `project_id = id`
  - Response: `{ ok: true }` or `{ error: "Not found" }` (404)

**Users:**
- [ ] **API-3**: `GET /api/admin/users` — List all users
  - Response: `[{ id, email, isSuperAdmin, projectCount }]`
  - `projectCount` calculated from `project_members` count per user
  
- [ ] **API-4**: `POST /api/admin/users` — Create new user
  - Body: `{ email, password, isSuperAdmin? }`
  - Validation: Email required, password required (8+ chars, uppercase + lowercase + digit)
  - Error: `{ error: "User already exists" }` (400) if email exists
  - Response: `{ ok: true, id }`
  
- [ ] **API-5**: `PUT /api/admin/users/[email]` — Update user
  - Body: `{ password?, isSuperAdmin? }` (at least one required)
  - Password: Validate strength, hash with bcrypt
  - Response: `{ ok: true }` or `{ error: "User not found" }` (404)
  
- [ ] **API-6**: `DELETE /api/admin/users/[email]` — Delete user
  - Protection: Return `{ error: "Cannot delete yourself" }` (400) if email matches session user
  - Cascade: Delete user's `project_members` entries
  - Response: `{ ok: true }` or `{ error: "User not found" }` (404)

**Project Members (for sub-modal):**
- [ ] **API-7**: `GET /api/admin/project/[id]/members` — List project members
  - Response: `[{ id, email, projectRole, positionId, positionName }]`
  
- [ ] **API-8**: `POST /api/admin/project/[id]/members` — Add member
  - Body: `{ email, projectRole?, positionId? }`
  - Validation: User must exist, email required
  - Default role: `"user"`
  - Error: `{ error: "User is already a member" }` (400) on duplicate
  - Side effect: Create notification for invited user
  - Response: `{ ok: true, id }`
  
- [ ] **API-9**: `PUT /api/admin/project/[id]/members/[memberId]` — Update member
  - Body: `{ projectRole?, positionId? }` (at least one required)
  - Response: `{ ok: true }` or `{ error: "Member not found" }` (404)
  
- [ ] **API-10**: `DELETE /api/admin/project/[id]/members/[memberId]` — Remove member
  - Response: `{ ok: true }` or `{ error: "Member not found" }` (404)

**Project Positions (for sub-modal):**
- [ ] **API-11**: `GET /api/admin/project/[id]/positions` — List project positions
  - Response: `[{ id, name, projectId }]`, sorted by ID
  
- [ ] **API-12**: `POST /api/admin/project/[id]/positions` — Create position
  - Body: `{ name }`
  - Validation: Name required
  - Error: `{ error: "Position already exists" }` (400) on duplicate
  - Response: `{ ok: true, id }`
  
- [ ] **API-13**: `PUT /api/admin/project/[id]/positions/[posId]` — Rename position
  - Body: `{ name }`
  - Protection: Return `{ error: "Cannot edit Misc position" }` (400) if name is "Misc"
  - Response: `{ ok: true }` or `{ error: "Not found" }` (404)
  
- [ ] **API-14**: `DELETE /api/admin/project/[id]/positions/[posId]` — Delete position
  - Protection: Return `{ error: "Cannot delete Misc position" }` (400) if name is "Misc"
  - Cascade: Update `project_members` with this `position_id` to `NULL` (becomes "Misc")
  - Response: `{ ok: true }` or `{ error: "Not found" }` (404)

### UI/UX Requirements
- [ ] **UX-1**: All tables support horizontal scroll on small screens
- [ ] **UX-2**: Loading states shown during API calls
- [ ] **UX-3**: Error states: inline error messages or toast notifications
- [ ] **UX-4**: Success confirmations: toast notifications
- [ ] **UX-5**: Confirmation dialogs for all destructive actions (delete, revoke admin)
- [ ] **UX-6**: Modal is dismissible via Escape key or close button
- [ ] **UX-7**: Nested sub-modal has its own close button and Escape handling
- [ ] **UX-8**: Form validation shows inline errors before submission
- [ ] **UX-9**: Password reset modal prevents accidental closure (confirm if unsaved)

### Legacy Compatibility
- [ ] **LEG-1**: Legacy `/superadmin` standalone page route is preserved
- [ ] **LEG-2**: Legacy page continues to work for backward compatibility
- [ ] **LEG-3**: New modal and legacy page share the same API endpoints

## Edge Cases

### Self-Protection
- **EC-1**: Super-admin cannot delete their own account via Delete User action
  - UI: Delete button disabled or shows error on attempt
  - API: Returns 400 with `{ error: "Cannot delete yourself" }`
  
- **EC-2**: Super-admin CAN revoke their own super-admin status
  - No special protection needed
  - Another super-admin can restore privileges if needed
  - If last super-admin revokes self, system has no super-admins (acceptable risk)

### Last Owner Protection
- **EC-3**: Deleting a user who is the last owner of projects
  - Currently: Allow deletion, projects become ownerless
  - Future consideration: Reassign ownership before deletion or block deletion
  - For now: Document that super-admin should check project memberships before deleting

### Cascade Deletes
- **EC-4**: Deleting a project
  - Related records deleted: `project_members`, `project_positions`, `project_settings` (DB CASCADE)
  - Related records cleaned up: `bills`, `motives`, `categories`, `vgeld`, `editlog`, `budget_matrix` (explicit delete)
  - Files in `data/uploads/` associated with bills are NOT deleted (intentional - may be referenced elsewhere)
  
- **EC-5**: Deleting a user
  - All `project_members` entries for that user are deleted (cascade)
  - User-created bills remain (with `email` preserved as reference)
  - User's notifications are deleted (optional, based on DB constraints)

### Concurrent Operations
- **EC-6**: Multiple super-admins editing simultaneously
  - Last-write-wins acceptable for this feature
  - No optimistic locking required
  
- **EC-7**: User deleted while being edited in modal
  - API returns 404, UI shows error and refreshes list
  
- **EC-8**: Project deleted while managing its members
  - Sub-modal shows error on save, closes and refreshes parent

### Data Integrity
- **EC-9**: Adding member with non-existent email
  - API returns 400: `{ error: "User not found" }`
  - UI shows inline error on email field
  
- **EC-10**: Duplicate project position names
  - API returns 400: `{ error: "Position already exists" }`
  - UI shows inline error
  
- **EC-11**: Editing/deleting "Misc" position
  - API returns 400 with appropriate error message
  - UI should ideally hide or disable edit/delete for "Misc"

### Large Lists
- **EC-12**: Very long project/user lists
  - Consider pagination or virtual scrolling for 100+ items
  - MVP: Scrollable table with fixed header
  - Future: Server-side pagination with search/filter

### Password Reset
- **EC-13**: Reset password for non-existent user
  - API returns 404 (user not found from email parameter)
  - UI should handle gracefully
  
- **EC-14**: Generated password requirements
  - Must be 12+ characters
  - Must include uppercase, lowercase, and digit
  - Must pass `validatePassword()` function
  - Consider using `crypto.randomBytes` or similar for generation

## Technical Requirements
- [ ] **TR-1**: Modal uses full-screen overlay with `z-50` or higher
- [ ] **TR-2**: Tab component uses existing UI library or custom implementation
- [ ] **TR-3**: Nested modals stack properly with increasing z-index
- [ ] **TR-4**: All API routes verify `session.user.isSuperAdmin` before processing
- [ ] **TR-5**: Password hashing uses bcrypt with 12 rounds
- [ ] **TR-6**: Email comparisons are case-insensitive (store as provided, compare lowercase)
- [ ] **TR-7**: All destructive actions require explicit confirmation
- [ ] **TR-8**: Toast notifications for success/error feedback
- [ ] **TR-9**: Form inputs use proper validation and error display
- [ ] **TR-10**: Branch: `to_nextjs`

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Component Structure (Visual Tree)

```
Sidebar (existing)
+-- Navigation Items (Bills, Budget, Reports, Settings)
+-- SETTINGS Section
    +-- System (existing)
    +-- Super Admin [NEW] (shield icon, visible only if isSuperAdmin)
        +-- Click opens: SuperAdminModal

SuperAdminModal (fullscreen modal, z-50)
+-- Modal Header
|   +-- Title: "Super Admin"
|   +-- Close Button (X)
|   +-- Tab Navigation: [Projects] [Users]
|
+-- Tab Content: ProjectsTab (default)
|   +-- DataTable
|       +-- Columns: Name | Subtitle | Created | Members | Actions
|       +-- Actions per row:
|           +-- "Members" button → opens MembersSubModal
|           +-- "Delete" button → opens ConfirmationDialog
|       +-- Empty State: "No projects found"
|
+-- Tab Content: UsersTab
|   +-- DataTable
|       +-- Columns: Email | Super Admin (badge) | Projects | Actions
|       +-- Actions per row:
|           +-- "Toggle Admin" button → ConfirmationDialog → API call
|           +-- "Reset Password" button → opens PasswordResetModal
|           +-- "Delete" button → ConfirmationDialog (disabled if self)
|       +-- Empty State: "No users found"

MembersSubModal (nested modal, z-[60])
+-- Modal Header
|   +-- Title: "Members: {project name}"
|   +-- Close Button
|
+-- Two Sections:
    +-- Members List Section
    |   +-- DataTable
    |       +-- Columns: Email | Role (badge) | Position | Actions
    |       +-- Actions: Edit (inline/modal), Remove (confirm)
    |   +-- "Add Member" Button → opens AddMemberForm (inline/modal)
    |       +-- Email input (existing user lookup)
    |       +-- Role dropdown: user/admin/owner
    |       +-- Position dropdown (optional)
    |
    +-- Position Management Section
        +-- Position List
        |   +-- Each: Name | Member Count | Actions
        |   +-- Actions: Rename (inline), Delete (confirm, except "Misc")
        +-- "Add Position" Button → inline input form

PasswordResetModal (nested modal, z-[60])
+-- Step 1: Confirmation
|   +-- Message: "Reset password for {email}?"
|   +-- Cancel / Confirm buttons
|
+-- Step 2: Display Generated Password
    +-- Warning: "Copy this password now. It will not be shown again."
    +-- Read-only password field (selectable)
    +-- "Copy to Clipboard" button
    +-- "Close" button

ConfirmationDialog (reusable component)
+-- Overlay with message
+-- Cancel / Confirm buttons
+-- Destructive styling for Confirm
```

### Data Model (Plain Language)

**Global User Accounts**
- Each user has an email (unique identifier) and a password hash
- Users have a boolean flag `isSuperAdmin` — when true, grants system-wide admin privileges
- Users can be members of multiple projects through `ProjectMember` records
- User accounts track creation date and active status

**Projects**
- Projects have a name, optional subtitle, and creation date
- Projects exist independently — super-admins can view/manage ALL projects regardless of membership
- Each project has associated members, positions, settings, and data (bills, categories, etc.)

**Project Memberships**
- Links users to projects with a specific role (user, admin, or owner)
- Optional position assignment (e.g., "Manager", "Developer")
- Super-admins can manage memberships for ANY project without being members themselves

**Project Positions**
- Custom labels for organizing members within a project (e.g., "Frontend Team", "QA")
- Each project has a default "Misc" position that cannot be edited or deleted
- When a position is deleted, members revert to "Misc"

**Password Reset Flow**
- Super-admin triggers password reset via API
- Server generates a secure random password (12+ characters with mixed case and digits)
- Password is hashed and stored (bcrypt, 12 rounds)
- Plain password is returned ONCE in the API response and displayed to super-admin
- Super-admin must communicate the password to the user externally (out of scope for UI)

**Cascade Behaviors**
- Deleting a project: Removes all related memberships, positions, settings, bills, etc.
- Deleting a user: Removes all their project memberships; bills they created remain (with email preserved)

### Tech Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Container** | Fullscreen Modal (not page route) | Keeps super-admin in app context; quick access without navigation; consistent with existing modal patterns (CropModal); Escape key to close |
| **Tab State** | In-memory React state | Tab state persists during modal session but resets on re-open; simple and sufficient for this use case |
| **Nested Members Modal** | Separate modal component with higher z-index | Avoids deep routing complexity; clean separation of concerns; easier to manage "close stack" (Esc closes members first, then main modal) |
| **Password Display** | One-time display with clipboard copy | Security best practice — passwords should never be retrievable after generation; clipboard integration for convenience |
| **Self-Delete Prevention** | UI disables button + API rejects | Defense in depth — prevents accidental self-lockout; clear visual indication in UI |
| **Role Badge Display** | Color-coded badges | Visual hierarchy: Owner (purple), Admin (blue), User (gray) — consistent with existing patterns |
| **Data Fetching** | SWR/React Query pattern (to be decided) | Caching and automatic revalidation for table data; optimistic updates for better UX |
| **Sorting** | Server-side default (ID for projects, email for users) | Predictable ordering without client complexity; pagination can be added later |

### Code Reuse Opportunities

| Feature | Existing Pattern | Reuse Strategy |
|---------|-----------------|----------------|
| **DataTable component** | `nextjs/components/ui/DataTable.tsx` | Extend to support action columns and row buttons |
| **Modal overlay & styling** | `nextjs/components/bills/CropModal.tsx` | Copy z-index pattern (`z-50`), backdrop (`bg-black/70`), header layout, close button |
| **API route structure** | `routes/superadmin.js` (Express) | Reference for Prisma queries and business logic; translate to Next.js App Router pattern |
| **Member management logic** | `routes/members.js` | Reuse validation patterns, role/position update flows |
| **Password generation** | Existing `crypto.randomBytes` usage in codebase | Same pattern for secure random password generation |
| **Session/super-admin check** | `nextjs/lib/auth/session.ts` | Use `getCurrentUser()` and check `role === 'superadmin'` |
| **Toast notifications** | Existing toast hook pattern | Reuse for success/error feedback |
| **Confirmation dialogs** | Pattern from existing features | Standard reusable confirmation component |

### Dependencies

No new packages required. Feature uses existing stack:

| Package | Purpose |
|---------|---------|
| `next-auth` | Session management (super-admin role check) |
| `@prisma/client` | Database queries for Users, Projects, ProjectMembers, ProjectPositions |
| `bcryptjs` | Password hashing (reset flow) |
| `crypto` (Node.js built-in) | Secure random password generation |
| `react` (useState, useEffect, useCallback) | Modal state, tab switching, form handling |
| Tailwind CSS | All styling (consistent with existing patterns) |

**Optional Future Additions:**
- `@headlessui/react` — if tab component needs accessibility enhancements (but native implementation preferred for simplicity)

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
