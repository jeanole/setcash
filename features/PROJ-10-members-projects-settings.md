# PROJ-10: Members, Projects & Settings

## Status: Planned
**Created:** 2026-03-01
**Last Updated:** 2026-03-04

## Dependencies
- Requires: PROJ-5 (NextAuth.js Authentication) - for session and role management
- Requires: PROJ-6 (PostgreSQL Data Migration) - for User, Project, ProjectMember models

## User Stories

### Settings & Project Management
- As any project member, I want to view the Settings page with tabs relevant to my role so that I can access configuration options I have permission to use.
- As a project admin or owner, I want to edit the project title and subtitle so that the project is properly identified in the UI.
- As a project member, I want to switch between projects I'm a member of so that I can work on different productions.
- As any authenticated user, I want to create a new project so that I can start tracking expenses for a new production.
- As a non-owner project member, I want to resign from a project so that I can leave a production I'm no longer involved with.
- As a project owner, I want to delete a project that has no other members so that I can clean up abandoned projects.

### Members Management
- As a project admin or owner, I want to invite users by email to join my project so that they can submit bills and participate.
- As a project admin or owner, I want to assign roles (user/admin/owner) to project members so that I can control their permissions.
- As a project owner, I want to promote/demote members to/from owner role so that I can transfer project ownership.
- As a project admin or owner, I want to remove members from the project so that former team members lose access.
- As a project admin or owner, I want to assign positions to members so that they are properly identified in filters and reports.

### Position Management
- As a project admin or owner, I want to create custom positions for my project so that I can organize team members by their role (e.g., "Gaffer", "Producer").
- As a project admin or owner, I want to rename positions so that I can correct typos or update role titles.
- As a project admin or owner, I want to delete positions I no longer need so that the position list stays clean.

### Super Admin
- As a superadmin, I want to list all projects in the system so that I can monitor platform usage.
- As a superadmin, I want to delete any project so that I can clean up abandoned or problematic projects.
- As a superadmin, I want to list all users and change their global superadmin status so that I can manage platform administrators.
- As a superadmin, I want to create new users directly so that I can provision accounts without going through registration.

## Acceptance Criteria

### Settings Page Structure (`/app/(protected)/settings/page.tsx`)

#### Settings Tabs (Role-Gated Access)
The Settings page displays tabs based on the user's current project role:

| Tab | User | Admin | Owner | Superadmin |
|-----|------|-------|-------|------------|
| General | ✓ | ✓ | ✓ | ✓ |
| Members | - | ✓ | ✓ | ✓* |
| Positions | - | ✓ | ✓ | ✓* |
| Projects | ✓ | ✓ | ✓ | ✓ |
| Export | - | ✓ | ✓ | ✓ |
| Telegram | - | ✓ | ✓ | ✓ |
| OCR/AI | - | ✓ | ✓ | ✓ |
| Super Admin | - | - | - | ✓ |

*Superadmin can access via dedicated Super Admin modal, not project settings

#### General Settings Tab
- **Route:** `/app/(protected)/settings/page.tsx` (default tab)
- **Fields:**
  - Project Title (text input, required, max 100 chars)
  - Project Subtitle (text input, optional, max 200 chars)
- **Behavior:**
  - Form pre-populated with current project values on load
  - Save button updates project via Server Action
  - On save success: update header bar and sidebar title immediately
  - Validation: Title cannot be empty
  - Error handling: Display inline validation errors

### Members Management (`/app/(protected)/settings/members/page.tsx`)

#### Members List
- **Access:** Admin/Owner only (403 for others)
- **Display:** Table with columns:
  - Email (user's email address)
  - Role (User / Admin / Owner badge)
  - Position (dropdown or displayed value)
  - Actions (edit role, remove)
- **Sort:** Alphabetically by email
- **Empty state:** "No members yet" message with invite CTA

#### Invite Member Flow
- **Button:** "Invite Member" opens modal or inline form
- **Form fields:**
  - Email (text input, required, email validation)
  - Role (dropdown: User / Admin / Owner - Owner only visible to owners/superadmins)
  - Position (dropdown: existing project positions + "None")
- **Validation:**
  - Email must exist in users table (error: "User not found — they must register first")
  - Cannot invite email already in project (error: "Already a member")
- **On success:**
  - Member added to project_members table
  - Notification created for invited user (type: "project_invite")
  - Modal closes, list refreshes
  - Success toast: "[email] invited as [role]"

#### Edit Member Role
- **Control:** Role dropdown in each member row
- **Options:**
  - User → Admin (admin/owner can change)
  - Admin → User (admin/owner can change)
  - User/Admin → Owner (owner/superadmin only)
  - Owner → User/Admin (owner/superadmin only)
- **Behavior:**
  - Dropdown disabled if user lacks permission for target role
  - Change saved immediately on select (auto-save) or via explicit "Save" button
  - Confirmation dialog for owner role changes: "Are you sure? Owners have full control including project deletion."

#### Remove Member
- **Button:** Trash icon or "Remove" in actions column
- **Confirmation:** Modal with text: "Remove [email] from project? They will lose all access."
- **Behavior:**
  - DELETE removes project_members record
  - List refreshes
  - Cannot remove yourself (use "Resign" in Projects tab instead)
  - Cannot remove last owner (validation error: "Cannot remove the last owner")

#### Change Member Position
- **Control:** Position dropdown in each member row
- **Options:** All project positions + "None" (null)
- **Behavior:**
  - Change saved immediately or via explicit save
  - "Misc" position shown as fallback for members without position

### Positions Management (`/app/(protected)/settings/positions/page.tsx`)

#### Positions List
- **Access:** Admin/Owner only
- **Display:** List/table of project-specific positions
- **Protected:** "Misc" position always exists, cannot be edited or deleted
- **Sort:** By creation order (id) or alphabetically

#### Add Position
- **Button:** "Add Position" opens inline form or modal
- **Field:** Name (text input, required, max 50 chars)
- **Validation:**
  - Unique within project (error: "Position already exists")
  - Cannot be "Misc" (case-insensitive, error: "'Misc' is reserved")
- **On success:** Position added to list, form clears

#### Rename Position
- **Control:** Inline edit (click name → input field) or edit button
- **Validation:**
  - Same as add (unique, not "Misc")
  - Cannot rename "Misc" (button hidden/disabled)
- **Behavior:** Save on blur or Enter key

#### Delete Position
- **Button:** Trash icon (hidden for "Misc")
- **Confirmation:** "Delete position '[name]'? Members assigned to this position will become unassigned."
- **Behavior:**
  - DELETE removes position record
  - Associated members' position_id set to NULL (unassigned)
  - List refreshes

### Projects Tab (`/app/(protected)/settings/projects/page.tsx`)

#### Project Switcher / List
- **Access:** All authenticated users
- **Display:** Table/cards showing:
  - Project name + subtitle
  - Your role in that project (User / Admin / Owner badge)
  - Member count
  - Actions: "Switch to Project" button, "Resign" button, "Delete" button (owner only)
- **Current project:** Highlighted row with "Current" badge
- **Sort:** By membership (current first), then alphabetically

#### Switch Project
- **Button:** "Switch" or click on project row
- **Behavior:**
  - POST to switch project endpoint
  - Update session with new currentProjectId, currentProjectRole, currentProjectName
  - Redirect to home page (or stay on settings)
  - Header bar updates immediately
  - Sidebar reloads with new project context

#### Create New Project
- **Button:** "+ New Project" (top of page or in sidebar)
- **Form fields:**
  - Project Name (text input, required)
  - Subtitle (text input, optional)
- **Behavior:**
  - POST creates project record
  - Creator added as owner in project_members
  - Project auto-selected as current
  - Default positions created (including "Misc")
  - Default settings initialized
  - Redirect to new project home

#### Resign from Project
- **Button:** "Resign" (non-owner members only)
- **Confirmation:** "Leave project '[name]'? You will lose access immediately."
- **Restrictions:**
  - Owners cannot resign (button hidden, error if attempted: "Owners cannot resign. Transfer ownership first.")
- **Behavior:**
  - DELETE removes project_members record for current user
  - If resigning from current project: clear session project context, redirect to project switcher
  - Success toast: "You have left [project name]"

#### Delete Project (Owner Only)
- **Button:** "Delete" (owner only, in project row)
- **Prerequisites:**
  - User must be owner of the project
  - Project must have no other members (member_count = 1)
- **Validation error:** "Remove all other members before deleting the project"
- **Confirmation:** Danger modal: "Permanently delete '[name]'? This cannot be undone. All bills, images, and data will be lost."
- **Behavior:**
  - DELETE cascades to all project data:
    - bills → bill_images, bill_motives, bill_categories
    - vgeld, motives, categories, budget_matrix
    - project_positions, project_members, project_settings
    - telegram_links, telegram_link_codes
    - ocr_logs, edit_logs
  - Bill image files deleted from storage
  - If deleting current project: clear session, redirect
  - Success toast, list refreshes

### Super Admin Section

#### Super Admin Modal/Page (`/app/(protected)/superadmin/page.tsx`)
- **Access:** Superadmin only (isSuperAdmin = true)
- **Entry:** "Super Admin" button in sidebar (superadmins only)
- **Tabs:**
  1. **Projects Tab**
     - List all projects in system
     - Columns: Name, Subtitle, Created, Member Count
     - Actions: Delete button (with confirmation), Members button (opens nested modal)
  2. **Users Tab**
     - List all users in system
     - Columns: Email, Superadmin badge, Project Count
     - Actions: Toggle superadmin, Reset password, Delete

#### Super Admin Project Members Modal
- **Trigger:** "Members" button on project row
- **Content:** Same member management as project settings but for any project
- **Additional:** Position management within the same modal

## Edge Cases

### Role Change Edge Cases
1. **Owner self-demotion:**
   - Owner tries to demote themselves to admin/user
   - Must confirm: "You will lose owner privileges including project deletion rights."
   - After confirmation: Check that at least one other owner remains
   - If no other owner: Error "Cannot demote — you are the only owner. Promote another member first."

2. **Promoting to owner:**
   - Only owners/superadmins can promote to owner
   - Dropdown option disabled with tooltip for non-owners
   - On promote: Show warning about new permissions

3. **Admin changing owner role:**
   - Admin (non-owner) attempts to change an owner's role
   - API returns 403 "Only owners can change owner role"
   - UI: Role dropdown disabled for owners if current user is not owner

4. **Last admin protection:**
   - Prevent removing the last admin from a project
   - API validation: Check admin count before allowing role change or removal
   - Note: Unlike owners, projects can technically have zero admins (users only)

### Invite Edge Cases
1. **Invite non-existent user:**
   - Email not found in users table
   - Error: "User not found — they must register first"
   - Option: "Copy invitation link" (if registration flow exists)

2. **Duplicate invite attempt:**
   - User already member of project
   - UNIQUE constraint violation caught
   - Error: "[email] is already a member of this project"

3. **Case-insensitive email matching:**
   - Invite "User@Example.com" when "user@example.com" exists
   - Should match and allow invite

### Position Edge Cases
1. **Protected "Misc" position:**
   - Cannot rename "Misc" (API returns 400, UI hides edit button)
   - Cannot delete "Misc" (API returns 400, UI hides delete button)
   - Members with NULL position_id display as "Misc"

2. **Deleting position with members:**
   - Position has associated project_members
   - On delete: Those members' position_id becomes NULL (unassigned/Misc)
   - No cascade delete on members

3. **Duplicate position names:**
   - Unique constraint on (project_id, name)
   - Case-sensitive or case-insensitive based on DB collation
   - Error: "Position '[name]' already exists"

### Project Deletion Edge Cases
1. **Deleting project with bills:**
   - All bills and associated data must be cleaned up
   - Bill images must be deleted from file storage
   - Cascading delete order matters (junction tables before bills)

2. **Deleting while project is active:**
   - User deletes project they currently have selected
   - Session cleared of project context
   - Redirect to project switcher or home

3. **Owner tries to delete with other members:**
   - API validation: member_count > 1
   - Error: "Remove all other members before deleting the project"
   - UI: Delete button disabled with tooltip explaining the constraint

### Project Switching Edge Cases
1. **Switch to project where user has different role:**
   - Session updated with new role
   - UI adapts immediately (admin features show/hide)

2. **Superadmin switches to any project:**
   - Even if not a member, superadmin can access
   - Role defaults to "admin" for access purposes
   - Should they be added as implicit member or just bypass checks?

3. **Project deleted while user viewing:**
   - WebSocket or polling scenario
   - On next action: 404 or "Project not found" error
   - Redirect to project switcher

### Settings Save Edge Cases
1. **Concurrent edit conflict:**
   - Two admins edit settings simultaneously
   - Last write wins (no optimistic locking in current design)
   - Consider: Show "Settings updated by another user" if version conflicts

2. **Empty title submission:**
   - Client-side validation prevents empty submit
   - Server validation: 400 error if empty
   - Inline error: "Project title is required"

### Notification Edge Cases
1. **Invited user is offline:**
   - Notification stored in DB
   - Appears in notification bell when user next logs in
   - Clicking notification should switch to relevant project

2. **Invite to deleted project:**
   - Project deleted before user sees notification
   - Notification click shows "Project not found"
   - Mark notification as read or show error state

## Technical Requirements

### API Endpoints (Server Actions)

```typescript
// Members
getProjectMembers(projectId: string) → ProjectMember[]
inviteMember(data: { email: string, role: ProjectRole, positionId?: string }) → Member
updateMemberRole(memberId: string, role: ProjectRole) → void
updateMemberPosition(memberId: string, positionId: string | null) → void
removeMember(memberId: string) → void

// Positions
getProjectPositions(projectId: string) → ProjectPosition[]
createPosition(projectId: string, name: string) → ProjectPosition
updatePosition(positionId: string, name: string) → void
deletePosition(positionId: string) → void

// Projects
createProject(data: { name: string, subtitle?: string }) → Project
updateProject(projectId: string, data: { name?: string, subtitle?: string }) → void
deleteProject(projectId: string) → void
resignFromProject(projectId: string) → void
switchProject(projectId: string) → void
getUserProjects() → ProjectWithRole[]

// Super Admin (only)
getAllProjects() → Project[]
getAllUsers() → User[]
createUser(data: { email: string, password: string }) → User
updateUserSuperAdmin(userId: string, isSuperAdmin: boolean) → void
deleteUser(userId: string) → void
```

### Role Guards

```typescript
// Middleware/Server Action wrappers
requireAuth() → User  // Any authenticated user
requireProjectAdmin(projectId: string) → User  // Admin or Owner
requireProjectOwner(projectId: string) → User  // Owner only
requireSuperAdmin() → User  // Superadmin only
```

### Database Models (Prisma)

```prisma
enum ProjectRole {
  user
  admin
  owner  // Note: schema currently only has user/admin - owner will need to be added
}

model ProjectMember {
  id         String       @id @default(uuid())
  projectId  String
  userEmail  String
  role       ProjectRole  @default(user)
  positionId String?
  project    Project      @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user       User         @relation(fields: [userEmail], references: [email], onDelete: Cascade)
  position   ProjectPosition? @relation(fields: [positionId], references: [id], onDelete: SetNull)
  @@unique([projectId, userEmail])
}

model ProjectPosition {
  id        String          @id @default(uuid())
  projectId String
  name      String
  project   Project         @relation(fields: [projectId], references: [id], onDelete: Cascade)
  members   ProjectMember[]
  @@unique([projectId, name])
}
```

### Security Requirements
- Route-level role guards via middleware
- Server Actions validate role on every call (don't trust client)
- Owner-only operations verified server-side
- Superadmin bypass only for superadmin-specific endpoints
- 403 pages for unauthorized access attempts

### UI/UX Requirements
- Loading states for all async operations
- Optimistic updates where appropriate (role changes, position CRUD)
- Confirmation dialogs for destructive actions (delete, remove member, resign)
- Toast notifications for success/error feedback
- Disabled states for unauthorized actions (don't hide, show why disabled)
- Responsive design for all settings pages

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### 1. Component Structure (Visual Tree)

```
Settings Layout (/app/(protected)/settings/)
├── SettingsTabs (role-gated horizontal navigation)
│   ├── General (all roles)
│   ├── Members (admin/owner only)
│   ├── Positions (admin/owner only)
│   ├── Projects (all roles)
│   ├── Export (admin/owner only)
│   ├── Telegram (admin/owner only)
│   ├── OCR/AI (admin/owner only)
│   └── Super Admin (superadmin only, sidebar entry)
│
├── General Tab
│   └── ProjectIdentityForm
│       ├── Project Title input
│       ├── Project Subtitle input
│       └── Save button (updates header/sidebar on success)
│
├── Members Tab (/settings/members)
│   ├── MembersHeader
│   │   ├── Title + member count
│   │   └── "Invite Member" button → opens InviteModal
│   ├── MembersTable (reuses DataTable component)
│   │   ├── Email column
│   │   ├── Role badge (dropdown for edit)
│   │   ├── Position dropdown
│   │   └── Actions (remove button)
│   ├── EmptyState ("No members yet" + CTA)
│   └── InviteModal
│       ├── Email input with validation
│       ├── Role dropdown (owner option hidden for non-owners)
│       ├── Position dropdown
│       └── Submit/Cancel buttons
│
├── Positions Tab (/settings/positions)
│   ├── PositionsHeader
│   │   ├── Title + count
│   │   └── "Add Position" button → inline form
│   ├── PositionsList
│   │   ├── PositionRow (inline editable)
│   │   │   ├── Name (click to edit)
│   │   │   └── Actions (delete, hidden for "Misc")
│   │   └── "Misc" row (protected, non-editable)
│   └── AddPositionForm (inline, collapsible)
│       └── Name input + Add button
│
├── Projects Tab (/settings/projects)
│   ├── ProjectsHeader
│   │   ├── Title
│   │   └── "+ New Project" button → NewProjectModal
│   ├── ProjectsList (table/cards)
│   │   ├── ProjectRow
│   │   │   ├── Name + Subtitle
│   │   │   ├── Your Role badge
│   │   │   ├── Member count
│   │   │   └── Actions
│   │   │       ├── "Switch" button (current project highlighted)
│   │   │       ├── "Resign" button (non-owners)
│   │   │       └── "Delete" button (owners, only when no other members)
│   └── NewProjectModal
│       ├── Name input (required)
│       ├── Subtitle input (optional)
│       └── Create button
│
└── Super Admin Page (/superadmin) — separate route
    ├── SuperAdminTabs
    │   ├── Projects Tab (all system projects)
    │   └── Users Tab (all system users)
    └── Nested Modals
        └── ProjectMembersModal (reuses member management UI)
```

### 2. Data Model (Plain Language)

**Project Membership**
- Every user-project connection is a "membership" record
- Each membership has exactly one role: `user`, `admin`, or `owner`
- Role inheritance: Owners can do everything admins can; admins can do everything users can
- A user can belong to multiple projects with different roles in each
- The "current project" is stored in the session for quick access

**Position System**
- Positions are project-specific (e.g., "Gaffer", "Producer" for a film project)
- Every project automatically gets a protected "Misc" position that cannot be renamed or deleted
- Members can have zero or one position; NULL means "Misc" for display purposes
- Position names must be unique within a project

**Settings Storage**
- Settings are stored as key-value pairs per project
- Keys include: project title, subtitle, export sheet ID, Telegram bot token, OCR provider settings
- Values are JSON-encoded for flexibility
- Project name/subtitle are also stored directly on the Project table (source of truth)

**Role Change Rules**
- Only owners can promote/demote owners
- Admins can manage users and other admins, but not owners
- A project must always have at least one owner (last owner cannot be removed or demoted)
- Owners cannot resign — they must transfer ownership first

**Project Deletion Safeguards**
- Only owners can delete projects
- Projects with multiple members cannot be deleted (prevents accidental data loss)
- Deleting a project cascades to all related data: bills, images, budget matrix, settings
- Bill images are also deleted from file storage

### 3. Tech Decisions

**Tab Accessibility Approach**
- Use URL-based tab navigation (`/settings`, `/settings/members`, `/settings/positions`, etc.)
- Each tab is a separate page with its own loading state
- Role gating happens at the layout level — unauthorized users see 403 or are redirected
- Active tab highlighted via Next.js pathname detection

**Invite Flow Design**
- Email lookup validates user exists before invite (security: prevents inviting random emails)
- Case-insensitive email matching ("User@Example.com" matches "user@example.com")
- On success, a notification record is created for the invited user
- Invited user sees notification in their bell icon; clicking switches to the project

**Role Change Protections**
- Owner promotion requires confirmation dialog warning about full control
- Owner demotion checks: "You will lose owner privileges" + "At least one other owner must exist"
- Dropdown options dynamically disabled based on current user's role
- All role changes validated server-side (never trust client)

**Project Deletion Safeguards**
- Delete button disabled with tooltip when other members exist
- Confirmation modal explicitly warns: "All bills, images, and data will be lost"
- If deleting current project: clear session project context and redirect to project switcher

**Real-Time Sidebar Updates**
- On project switch: session updates trigger sidebar re-render via NextAuth session refresh
- Header title updates via same mechanism
- Alternative: Optimistic UI update followed by server confirmation

### 4. Code Reuse Opportunities

**From Existing Express Routes:**
- Member CRUD logic (members.js): Role validation, notification creation on invite, last-owner checks
- Position management (positions.js): Protected "Misc" handling, unique name validation
- Settings patterns (settings.js): Key-value storage with JSON encoding/decoding
- Project operations (projects.js): Switch logic, resignation validation, deletion cascade order

**From Next.js Bill Feature:**
- `DataTable` component for members and positions lists
- `AppShell` layout pattern with sidebar
- `useBills` hook pattern → create `useMembers`, `usePositions`, `useProjects` hooks
- Form validation patterns from BillForm
- Modal/dialog patterns

**New Shared Components Needed:**
- `RoleBadge` — displays User/Admin/Owner with color coding
- `ConfirmDialog` — reusable destructive action confirmation
- `SettingsSection` — consistent card styling for settings tabs

### 5. Dependencies

No new packages required. The existing stack provides:
- **NextAuth.js v5** — session management with role info
- **Prisma** — database access with relations
- **shadcn/ui** (via existing components) — tabs, dialogs, dropdowns, forms
- **Tailwind CSS** — styling
- **@radix-ui/react-dialog** — modal primitives (already in use)
- **@radix-ui/react-dropdown-menu** — role/position dropdowns (already in use)

### 6. Database Migration Notes

The existing Prisma schema needs minor updates:
1. Add `owner` to `ProjectRole` enum (currently only `user`/`admin`)
2. Ensure `ProjectMember.positionId` allows NULL (already supports this)
3. Default positions (including "Misc") created when project is initialized

### 7. Security Considerations

- All role-gated operations re-validated in Server Actions (defense in depth)
- Project ID in Server Actions taken from session, never from client input
- Superadmin endpoints completely separate from project-scoped endpoints
- Owner-only operations check both session role AND server-side ownership
- Project deletion requires explicit confirmation with project name (opt-in safeguard)

## QA Test Results

**QA Date:** 2026-03-04  
**Test Environment:** Local Docker (http://localhost:3001)  
**Tester:** QA Engineer  
**Test Outcome:** BLOCKED - Critical environment issues prevent full testing

---

### Build-Blocking Bugs Found

#### BUG-001: Missing `sonner` dependency — **Critical** [Deploy]
- **Issue:** `sonner` toast library imported in multiple files but not in package.json
- **Files affected:** 
  - `components/settings/ProjectIdentityForm.tsx`
  - `lib/hooks/useMembers.ts`
  - `lib/hooks/usePositions.ts`
  - `lib/hooks/useProjects.ts`
- **Error:** `Module not found: Can't resolve 'sonner'`
- **Fix:** `npm install sonner` (applied)
- **Status:** RESOLVED

#### BUG-002: Incorrect relative import paths for auth — **Critical** [Backend]
- **Issue:** Multiple API routes use incorrect relative paths to import `auth`
- **Files affected:**
  - `app/api/projects/[id]/members/[memberId]/route.ts` - `../../../../../auth`
  - `app/api/projects/[id]/positions/route.ts` - `../../../../auth`
  - `app/api/projects/[id]/resign/route.ts` - `../../../../auth`
  - `app/api/projects/route.ts` - `../../../../auth`
- **Fix:** Use `@/auth` path alias instead (applied to all files)
- **Status:** RESOLVED

---

### Environment Issues Blocking Testing

#### ENV-001: Host disk critically full — **Critical**
- **Issue:** C: drive at 100% capacity (476GB used / 476GB total, only 87MB free)
- **Impact:** Cannot build Docker images, Next.js cannot compile, temp files fail
- **Error:** `ENOSPC: no space left on device`
- **Recommendation:** Free up disk space on host machine before testing can proceed

#### ENV-002: Missing AUTH_SECRET — **High**
- **Issue:** NextAuth requires `AUTH_SECRET` environment variable in production mode
- **Impact:** Login/authentication will fail
- **Fix:** Add `AUTH_SECRET` to `.env.test` or docker-compose.test.yml

---

### Code Review Findings (Static Analysis)

During investigation of build issues, the following code concerns were noted:

#### Security Issues

| ID | File | Issue | Severity | Skill Tag |
|----|------|-------|----------|-----------|
| BUG-003 | `app/(protected)/settings/members/page.tsx` | **Missing server-side role guard** — page is 'use client' with no SSR protection. Regular users can view (not just access via tab) the members management UI by directly accessing `/settings/members`. API correctly rejects actions, but UI should be protected too. | **High** | [Frontend] |
| BUG-004 | `app/(protected)/settings/positions/page.tsx` | **Missing server-side role guard** — same issue as members page. Direct URL access shows UI to unauthorized users. | **High** | [Frontend] |

#### Code Quality Issues (Fixed)

| File | Issue | Severity | Skill Tag |
|------|-------|----------|-----------|
| `app/api/projects/[id]/members/route.ts` | Uses `../../../../auth` instead of `@/auth` — **FIXED** | Low | [Backend] |
| `app/(protected)/settings/layout.tsx` | Uses `../../../auth` instead of `@/auth` — **FIXED** | Low | [Backend] |
| `app/(protected)/settings/page.tsx` | Uses `../../../auth` instead of `@/auth` — **FIXED** | Low | [Backend] |
| `app/api/projects/[id]/positions/[posId]/route.ts` | Uses `../../../../../auth` instead of `@/auth` — **FIXED** | Low | [Backend] |

---

### Recommended Next Steps

1. **Free up disk space** on host machine (minimum 5GB recommended)
2. **Add AUTH_SECRET** to test environment configuration
3. **Rebuild and restart** test environment
4. **Re-run full QA test plan** once environment is healthy

---

### Production-Ready Status: **NO**

**Blockers:**
- [ ] Critical environment issues prevent validation
- [ ] Build bugs were found and fixed (verification needed)
- [ ] Security audit not completed due to environment
- [ ] Manual acceptance criteria testing blocked

**Recommendation:** Fix environment issues and re-run complete QA test plan before deploying to production.

## Deployment
_To be added by /deploy_
