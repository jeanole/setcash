# Backend Implementation Plan

## Feature
PROJ-17: Super-Admin Panel
Spec: `features/PROJ-17-super-admin.md`

## Context Summary

### Existing Database Schema (Prisma)
- **User model**: Has `isSuperAdmin` boolean flag
- **ProjectRole enum**: Currently only `user`, `admin` — **NEEDS `owner` ADDED**
- **ProjectMember model**: Links users to projects with role and optional position
- **ProjectPosition model**: Project-specific positions with "Misc" protection

### Existing API Patterns
- Use `auth()` from `@/auth` for session
- Check `session.user.role === 'superadmin'` for super-admin access
- Prisma client imported from `@/lib/db`
- Return `NextResponse.json()` with appropriate status codes

### Express Implementation to Port
- `routes/superadmin.js` (352 lines) - All super-admin API logic
- `routes/members.js` (lines 141-206) - User CRUD with super-admin check

## User Decisions

1. **Permission Model**: Super-admin bypasses all project-level checks
   - Super-admin can view/manage ANY project without being a member
   - Super-admin can change owner roles (bypass normal restrictions)
   - Super-admin can delete any project

2. **Role Enum**: Add `owner` to ProjectRole enum
   - Required for proper role management
   - Migration needed for existing data

3. **Self-Delete Protection**: API level only
   - Cannot delete your own account
   - CAN revoke your own super-admin status

4. **Password Reset**: Generate random 12-char password with mixed case + digits
   - Return plain password once in response
   - Hash with bcrypt (12 rounds)

5. **Cascade Deletes**:
   - Delete project: Cascade to all related records (bills, motives, etc.)
   - Delete user: Remove memberships, preserve bills (with email reference)

## Open Bug Reports to Address
None for PROJ-17.

## Database Changes Required

### 1. Add `owner` to ProjectRole Enum
**File:** `nextjs/prisma/schema.prisma`

```prisma
enum ProjectRole {
  user
  admin
  owner  // ADD THIS
}
```

**Migration:** Create and run migration to add owner variant

### 2. No New Tables Needed
All required tables exist:
- `User` - for global user management
- `Project` - for project listing
- `ProjectMember` - for membership management
- `ProjectPosition` - for position management
- `Notification` - for member invite notifications

## API Endpoints to Implement

### Projects Management

#### GET /api/admin/projects
- **Auth**: Super-admin only (`session.user.isSuperAdmin`)
- **Response**: `[{ id, name, subtitle, createdAt, memberCount }]`
- **Logic**: List all projects with member count aggregation
- **Sort**: By createdAt ascending (oldest first)

#### DELETE /api/admin/projects/[id]
- **Auth**: Super-admin only
- **Logic**: 
  - Delete all bills, motives, categories, vgeld, editlog, budget_matrix for project
  - Delete project (cascade handles members, positions, settings)
- **Response**: `{ ok: true }` or 404

### Users Management

#### GET /api/admin/users
- **Auth**: Super-admin only
- **Response**: `[{ id, email, isSuperAdmin, projectCount }]`
- **Logic**: List all users with project count aggregation
- **Sort**: By email ascending (A-Z)

#### POST /api/admin/users
- **Auth**: Super-admin only
- **Body**: `{ email, password, isSuperAdmin? }`
- **Validation**:
  - Email required, valid format
  - Password required, 8+ chars, uppercase + lowercase + digit
  - Email must be unique
- **Logic**: Hash password with bcrypt (12 rounds), create user
- **Response**: `{ ok: true, id }`

#### PUT /api/admin/users/[email]
- **Auth**: Super-admin only
- **Body**: `{ password?, isSuperAdmin? }` (at least one)
- **Validation**: 
  - If password: validate strength, hash
  - If isSuperAdmin: boolean
- **Logic**: Update user fields
- **Response**: `{ ok: true }` or 404

#### DELETE /api/admin/users/[email]
- **Auth**: Super-admin only
- **Validation**: Cannot delete self (email matches session user)
- **Logic**: 
  - Delete user's project_members entries (cascade)
  - Delete user
- **Response**: `{ ok: true }` or 404 or 400 (self-delete)

### Project Members (Sub-modal)

#### GET /api/admin/projects/[id]/members
- **Auth**: Super-admin only
- **Response**: `[{ id, email, projectRole, positionId, positionName }]`
- **Logic**: List members with position name (COALESCE to 'Misc')

#### POST /api/admin/projects/[id]/members
- **Auth**: Super-admin only
- **Body**: `{ email, projectRole?, positionId? }`
- **Validation**:
  - Email required
  - User must exist
  - Role must be valid enum value
- **Logic**: 
  - Create membership
  - Create notification for invited user
- **Error**: 400 if already member (UNIQUE constraint)
- **Response**: `{ ok: true, id }`

#### PUT /api/admin/projects/[id]/members/[memberId]
- **Auth**: Super-admin only
- **Body**: `{ projectRole?, positionId? }` (at least one)
- **Logic**: Update member role and/or position
- **Response**: `{ ok: true }` or 404

#### DELETE /api/admin/projects/[id]/members/[memberId]
- **Auth**: Super-admin only
- **Logic**: Delete membership
- **Response**: `{ ok: true }` or 404

### Project Positions (Sub-modal)

#### GET /api/admin/projects/[id]/positions
- **Auth**: Super-admin only
- **Response**: `[{ id, name, memberCount? }]`
- **Logic**: List positions with optional member count

#### POST /api/admin/projects/[id]/positions
- **Auth**: Super-admin only
- **Body**: `{ name }`
- **Validation**: Name required, unique per project
- **Logic**: Create position
- **Error**: 400 if duplicate
- **Response**: `{ ok: true, id }`

#### PUT /api/admin/projects/[id]/positions/[posId]
- **Auth**: Super-admin only
- **Body**: `{ name }`
- **Validation**: 
  - Name required
  - Cannot rename "Misc" position
- **Logic**: Update position name
- **Response**: `{ ok: true }` or 404 or 400

#### DELETE /api/admin/projects/[id]/positions/[posId]
- **Auth**: Super-admin only
- **Validation**: Cannot delete "Misc" position
- **Logic**: 
  - Set members' position_id to NULL (becomes "Misc")
  - Delete position
- **Response**: `{ ok: true }` or 404 or 400

## Frontend Integration

### Components Needing API Connection

| Component | API Endpoints | Actions |
|-----------|--------------|---------|
| **ProjectsTab** | GET /api/admin/projects, DELETE /api/admin/projects/[id] | Load projects, delete project |
| **UsersTab** | GET /api/admin/users, PUT /api/admin/users/[email], DELETE /api/admin/users/[email] | Load users, toggle admin, reset password, delete user |
| **MembersSubModal** | GET /api/admin/projects/[id]/members, POST/PUT/DELETE members | Load, add, edit, remove members |
| **PositionManagement** | GET/POST/PUT/DELETE positions | CRUD positions |

### Replace Mock Data
All mock API calls in the frontend components need to be replaced with actual `fetch()` calls to these endpoints.

## Input Validation (Zod Schemas)

### CreateUserSchema
```typescript
{
  email: z.string().email(),
  password: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
  isSuperAdmin: z.boolean().optional()
}
```

### UpdateUserSchema
```typescript
{
  password: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).optional(),
  isSuperAdmin: z.boolean().optional()
}.refine(data => data.password || data.isSuperAdmin !== undefined, {
  message: "At least one field required"
})
```

### MemberSchema
```typescript
{
  email: z.string().email(),
  projectRole: z.enum(['user', 'admin', 'owner']).optional(),
  positionId: z.string().optional()
}
```

### PositionSchema
```typescript
{
  name: z.string().min(1).max(50)
}
```

## Security Considerations

1. **All routes verify `isSuperAdmin`** before any operation
2. **Self-delete check** on user deletion
3. **Case-insensitive email comparison** for user lookups
4. **Password strength validation** before hashing
5. **Transaction safety** for cascade operations where needed

## File Structure

```
nextjs/app/api/admin/
├── projects/
│   └── route.ts              # GET, POST (if needed)
├── projects/[id]/
│   └── route.ts              # DELETE
├── projects/[id]/members/
│   └── route.ts              # GET, POST
├── projects/[id]/members/[memberId]/
│   └── route.ts              # PUT, DELETE
├── projects/[id]/positions/
│   └── route.ts              # GET, POST
├── projects/[id]/positions/[posId]/
│   └── route.ts              # PUT, DELETE
└── users/
    └── route.ts              # GET, POST
└── users/[email]/
    └── route.ts              # PUT, DELETE
```

## Checklist

### Database
- [ ] Add `owner` to ProjectRole enum in schema.prisma
- [ ] Create and run migration
- [ ] Verify existing data compatibility

### API Routes
- [ ] GET /api/admin/projects
- [ ] DELETE /api/admin/projects/[id]
- [ ] GET /api/admin/users
- [ ] POST /api/admin/users
- [ ] PUT /api/admin/users/[email]
- [ ] DELETE /api/admin/users/[email]
- [ ] GET /api/admin/projects/[id]/members
- [ ] POST /api/admin/projects/[id]/members
- [ ] PUT /api/admin/projects/[id]/members/[memberId]
- [ ] DELETE /api/admin/projects/[id]/members/[memberId]
- [ ] GET /api/admin/projects/[id]/positions
- [ ] POST /api/admin/projects/[id]/positions
- [ ] PUT /api/admin/projects/[id]/positions/[posId]
- [ ] DELETE /api/admin/projects/[id]/positions/[posId]

### Frontend Integration
- [ ] Connect ProjectsTab to projects API
- [ ] Connect UsersTab to users API
- [ ] Connect MembersSubModal to members API
- [ ] Connect PositionManagement to positions API
- [ ] Add toast notifications for success/error
- [ ] Handle loading states

### Testing
- [ ] Test super-admin access control
- [ ] Test self-delete protection
- [ ] Test project deletion cascade
- [ ] Test member CRUD
- [ ] Test position "Misc" protection
- [ ] Test password reset generation
