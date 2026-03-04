# QA Test Plan

## Feature
PROJ-17: Super-Admin Panel
Spec: `features/PROJ-17-super-admin.md`

## Context Summary

### Recently Implemented
- Frontend: 8 React components created in `nextjs/components/superadmin/`
- Backend: 14 API endpoints in `nextjs/app/api/admin/`
- Database: Added `owner` to ProjectRole enum
- Sidebar: Added Super Admin button (conditional on isSuperAdmin)

### Docker Setup
- Dockerfile located at `nextjs/Dockerfile`
- Multi-stage build with Prisma generate and migrations
- Port 3001 exposed
- Requires DATABASE_URL and other env vars at runtime

### Test Environment
- App URL: http://localhost:3001
- Need to set DATABASE_URL for PostgreSQL
- Admin credentials from .env: admin@example.com / admin123

## User Guidance

### Docker Rebuild Required
1. Build new Docker image with updated schema
2. Run migration for `owner` role
3. Test against running container

### Test Accounts Needed
- Super-admin user (isSuperAdmin = true)
- Regular user (isSuperAdmin = false)
- Test project with members

## Acceptance Criteria to Test

### AC-1: Sidebar Access (4 criteria)
- AC-1.1: Super Admin button visible only to super-admins
- AC-1.2: Button in SETTINGS section
- AC-1.3: Shield icon displayed
- AC-1.4: Click opens fullscreen modal

### AC-2: Modal Layout (5 criteria)
- AC-2.1: Fullscreen overlay
- AC-2.2: Header with title, close button, tabs
- AC-2.3: Projects | Users tabs
- AC-2.4: Tab state persists
- AC-2.5: Escape/click close works

### AC-3: Projects Tab (30 criteria)
- AC-3.1: Table columns (Name, Subtitle, Created, Members, Actions)
- AC-3.2: Members and Delete buttons per row
- AC-3.3: Sort by ID ascending
- AC-3.4: Empty state
- AC-3.5 to AC-3.8: Delete confirmation flow
- AC-3.9 to AC-3.30: Members sub-modal (list, add, edit, remove, positions)

### AC-4: Users Tab (18 criteria)
- AC-4.1: Table columns (Email, Super Admin badge, Projects, Actions)
- AC-4.2: Sort by email ascending
- AC-4.3: Toggle Admin, Reset Password, Delete buttons
- AC-4.4: Empty state
- AC-4.5 to AC-4.9: Toggle admin flow
- AC-4.10 to AC-4.14: Password reset flow
- AC-4.15 to AC-4.18: Delete user flow

### API-1 to API-14: All API endpoints

## Edge Cases to Test

### Self-Protection
- EC-1: Cannot delete self (UI + API)
- EC-2: Can revoke own super-admin

### Cascade Behavior
- EC-4: Delete project cascade
- EC-5: Delete user cascade

### Data Integrity
- EC-9: Add member with non-existent email
- EC-10: Duplicate position names
- EC-11: Edit/delete "Misc" position

### Concurrent Operations
- EC-7: User deleted while editing
- EC-8: Project deleted while managing members

## Security Audit Scope

### Authentication/Authorization
- All API routes require super-admin
- Non-super-admin gets 403
- Unauthenticated gets 401

### Input Validation
- SQL injection attempts
- XSS in email/name fields
- Password strength enforcement
- Email format validation

### Data Exposure
- API responses don't expose password hashes
- Cannot access other users' data without super-admin

## Regression Test Scope

### Related Features
- PROJ-5 (Authentication) - verify login still works
- PROJ-7 (Bills) - verify bill operations work
- PROJ-10 (Members) - verify project member management

## Responsive Testing
- Desktop (1440px): Full layout
- Tablet (768px): Adjusted layout
- Mobile (375px): Horizontal scroll on tables

## Test Execution Steps

1. **Docker Build**
   ```bash
   cd nextjs
   docker build -t vbudget:prod .
   ```

2. **Start Container with Env**
   ```bash
   docker run -p 3001:3001 \
     -e DATABASE_URL="postgresql://..." \
     -e NEXTAUTH_SECRET="..." \
     -e GOOGLE_CLIENT_ID="..." \
     -e GOOGLE_CLIENT_SECRET="..." \
     vbudget:prod
   ```

3. **Verify Migration Ran**
   - Check owner role added to enum

4. **Run All Tests**
   - Sidebar visibility
   - Modal functionality
   - Projects CRUD
   - Users CRUD
   - Members management
   - Positions management
   - Security tests

## Bug Report Template

```markdown
### BUG-N: [Title]
- **Severity:** Critical/High/Medium/Low
- **Skill Tag:** [Frontend]/[Backend]/[Architecture]
- **Steps to Reproduce:**
1. ...
2. ...
- **Expected:** ...
- **Actual:** ...
- **Fix Required:** ...
```
