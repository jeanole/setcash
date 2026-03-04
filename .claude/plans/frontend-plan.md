# Frontend Implementation Plan

## Feature
PROJ-10: Members, Projects & Settings
Spec: `/mnt/c/Users/jensmoeller/code/vbudget/features/PROJ-10-members-projects-settings.md`

## Context Summary

**Existing Components to Reuse:**
- `DataTable` — For members, positions, and projects lists
- `RoleBadge` — Already supports user/admin/owner/superadmin roles
- `ConfirmationDialog` — For destructive actions
- `SuperAdminModal` — Pattern for modal with tabs
- `AppShell`, `Sidebar`, `Header` — Layout components
- Bill feature patterns — Form validation, modal patterns, hooks

**Existing API Routes (Admin):**
- `/api/admin/projects/*` — Project CRUD
- `/api/admin/projects/[id]/members/*` — Member management
- `/api/admin/projects/[id]/positions/*` — Position management
- `/api/admin/users/*` — User management

**New API Routes Needed (Project-scoped):**
- Project-scoped members, positions, settings endpoints

**Current Project State:**
- Next.js 14 + TypeScript + Tailwind + shadcn/ui
- NextAuth v5 for authentication
- Prisma + PostgreSQL for data
- No settings pages exist yet (`/settings/*` folder missing)

## User Decisions

| Question | Answer |
|----------|--------|
| Visual style | Same pattern: dark sidebar (slate-900), indigo accents, light content |
| Settings tabs | Horizontal tabs under page title |
| Icons | No preference — use Lucide icons |
| Responsive | Mobile-first |
| Role changes | Immediate auto-save with confirmation for owner changes |
| Position editing | Inline edit (click → input, save on Enter/blur) |
| Accessibility | WCAG 2.1 AA defaults |
| Animations | Developer discretion |

## Open Bug Reports to Address
None

## New Components to Build

### 1. Settings Layout Components

**SettingsTabs** (`components/settings/SettingsTabs.tsx`)
- Horizontal tab navigation
- Props: `activeTab: string`, `userRole: string`
- Role-gated tab visibility
- Mobile: scrollable tabs, Desktop: full width
- Uses URL-based tab state (`/settings`, `/settings/members`, etc.)

**SettingsSection** (`components/settings/SettingsSection.tsx`)
- Consistent card container for settings content
- Props: `title: string`, `description?: string`, `children`
- White background, rounded corners, subtle shadow

### 2. General Settings Tab

**ProjectIdentityForm** (`components/settings/ProjectIdentityForm.tsx`)
- Project title input (required, max 100)
- Project subtitle input (optional, max 200)
- Save button with loading state
- On save: update header/sidebar via session refresh

### 3. Members Tab Components

**MembersTable** (`components/settings/MembersTable.tsx`)
- Reuses `DataTable` component
- Columns: Email, Role (dropdown), Position (dropdown), Actions
- Role dropdown: auto-save on change
- Position dropdown: auto-save on change
- Remove button with confirmation

**InviteMemberModal** (`components/settings/InviteMemberModal.tsx`)
- Email input with validation
- Role dropdown (owner hidden for non-owners)
- Position dropdown (existing positions + "None")
- Submit/Cancel buttons

### 4. Positions Tab Components

**PositionsList** (`components/settings/PositionsList.tsx`)
- List/table of positions
- Inline editable name (click → input)
- Delete button (hidden for "Misc")
- Add position inline form at bottom

**PositionRow** (`components/settings/PositionRow.tsx`)
- Props: `position`, `isProtected`, `onRename`, `onDelete`
- Inline editing state
- Enter to save, Escape to cancel

### 5. Projects Tab Components

**ProjectsList** (`components/settings/ProjectsList.tsx`)
- Cards/table showing user's projects
- Columns: Name+Subtitle, Your Role, Member Count, Actions
- Actions: Switch, Resign, Delete (owner only)
- Current project highlighted

**NewProjectModal** (`components/settings/NewProjectModal.tsx`)
- Name input (required)
- Subtitle input (optional)
- Create button
- On success: auto-switch to new project

### 6. Shared Components

**RoleSelect** (`components/ui/RoleSelect.tsx`)
- Dropdown for role selection
- Props: `value`, `onChange`, `disabledOptions[]`, `currentUserRole`
- Disabled states for unauthorized role changes

**PositionSelect** (`components/ui/PositionSelect.tsx`)
- Dropdown for position selection
- Props: `positions[]`, `value`, `onChange`, `includeNone`

## Pages / Routes to Create

| Route | Components Used | Description |
|-------|-----------------|-------------|
| `/app/(protected)/settings/page.tsx` | SettingsTabs, ProjectIdentityForm | General settings (default tab) |
| `/app/(protected)/settings/members/page.tsx` | SettingsTabs, MembersTable, InviteMemberModal | Member management |
| `/app/(protected)/settings/positions/page.tsx` | SettingsTabs, PositionsList | Position management |
| `/app/(protected)/settings/projects/page.tsx` | SettingsTabs, ProjectsList, NewProjectModal | Project switcher + create |
| `/app/(protected)/settings/layout.tsx` | SettingsTabs (shared layout) | Settings layout wrapper |

## Data Connection

### Server Actions to Create

**Members:**
- `getProjectMembers(projectId: string)` → `ProjectMember[]`
- `inviteMember(data: InviteMemberData)` → `Member`
- `updateMemberRole(memberId: string, role: ProjectRole)` → `void`
- `updateMemberPosition(memberId: string, positionId: string | null)` → `void`
- `removeMember(memberId: string)` → `void`

**Positions:**
- `getProjectPositions(projectId: string)` → `ProjectPosition[]`
- `createPosition(projectId: string, name: string)` → `ProjectPosition`
- `updatePosition(positionId: string, name: string)` → `void`
- `deletePosition(positionId: string)` → `void`

**Projects:**
- `getUserProjects()` → `ProjectWithRole[]`
- `createProject(data: CreateProjectData)` → `Project`
- `updateProject(projectId: string, data: UpdateProjectData)` → `void`
- `deleteProject(projectId: string)` → `void`
- `resignFromProject(projectId: string)` → `void`
- `switchProject(projectId: string)` → `void`

**Settings:**
- `getProjectSettings(projectId: string)` → `ProjectSettings`

### Custom Hooks

**useMembers** (`lib/hooks/useMembers.ts`)
- Fetch, invite, update role, update position, remove
- Loading and error states
- Optimistic updates for role/position changes

**usePositions** (`lib/hooks/usePositions.ts`)
- Fetch, create, rename, delete
- Loading and error states

**useProjects** (`lib/hooks/useProjects.ts`)
- Fetch user's projects, create, update, delete, resign, switch
- Loading and error states

## Design Specifications

### Colors (following existing pattern)
```
Primary: indigo-600 (buttons, active states)
Sidebar: slate-900 (background), slate-800 (hover)
Text: slate-900 (headings), slate-600 (body), slate-400 (muted)
Borders: slate-200
Cards: white background, rounded-lg, shadow-sm
Error: rose-600 / rose-50 background
Success: green-600 / green-50 background
```

### Role Badge Colors
```
User: slate-100 / slate-700
Admin: blue-50 / blue-700
Owner: purple-50 / purple-700
Superadmin: amber-50 / amber-700
```

### Layout
- Mobile-first responsive design
- Max-width container: max-w-6xl mx-auto
- Page padding: px-4 sm:px-6 lg:px-8 py-6
- Card padding: p-6

### Animations (developer discretion)
- Tab transitions: subtle fade or slide
- Modal open: scale + fade
- Loading states: shimmer or spinner
- Success feedback: subtle checkmark animation

### Responsive Breakpoints
- Mobile: < 640px (stacked layout, scrollable tabs)
- Tablet: 640px - 1024px (adapted tables)
- Desktop: > 1024px (full sidebar, tables)

## Checklist

### Before Implementation
- [x] Read feature spec and Tech Design
- [x] Check existing components for reuse
- [x] Ask clarifying questions
- [x] Document design decisions

### Component Implementation
- [ ] Create settings layout with tabs
- [ ] Build General tab (ProjectIdentityForm)
- [ ] Build Members tab (MembersTable, InviteMemberModal)
- [ ] Build Positions tab (PositionsList with inline edit)
- [ ] Build Projects tab (ProjectsList, NewProjectModal)
- [ ] Create shared components (RoleSelect, PositionSelect)
- [ ] Create custom hooks (useMembers, usePositions, useProjects)

### Integration
- [ ] Connect to Server Actions
- [ ] Add role guards (403 for unauthorized access)
- [ ] Wire up to Sidebar navigation
- [ ] Update Header with project context
- [ ] Add loading states
- [ ] Add error handling
- [ ] Add toast notifications

### Polish
- [ ] Mobile responsiveness
- [ ] Accessibility checks (keyboard nav, ARIA)
- [ ] Animation polish
- [ ] Test all CRUD operations
- [ ] Test role-based access

### Testing Scenarios
- [ ] User can view General settings
- [ ] Admin can access Members, Positions tabs
- [ ] Owner can promote/demote owners
- [ ] Non-owner cannot access admin tabs
- [ ] Invite member flow works
- [ ] Role changes auto-save
- [ ] Position inline edit works
- [ ] Project switch updates session
- [ ] Create project initializes defaults
- [ ] Delete project with confirmation
- [ ] Resign from project works

## Files to Create/Modify

### New Files
```
components/settings/SettingsTabs.tsx
components/settings/SettingsSection.tsx
components/settings/ProjectIdentityForm.tsx
components/settings/MembersTable.tsx
components/settings/InviteMemberModal.tsx
components/settings/PositionsList.tsx
components/settings/PositionRow.tsx
components/settings/ProjectsList.tsx
components/settings/NewProjectModal.tsx
components/ui/RoleSelect.tsx
components/ui/PositionSelect.tsx
lib/hooks/useMembers.ts
lib/hooks/usePositions.ts
lib/hooks/useProjects.ts
app/(protected)/settings/page.tsx
app/(protected)/settings/members/page.tsx
app/(protected)/settings/positions/page.tsx
app/(protected)/settings/projects/page.tsx
app/(protected)/settings/layout.tsx
```

### Modified Files
```
components/layout/Sidebar.tsx — Add Settings link highlighting
```

## Implementation Order
1. Settings layout + tabs structure
2. General tab (simplest — just project name/subtitle)
3. Members tab (complex CRUD)
4. Positions tab (inline editing)
5. Projects tab (switch, resign, delete)
6. Polish, animations, responsive
7. Integration testing
