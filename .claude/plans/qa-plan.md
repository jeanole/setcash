# QA Test Plan — PROJ-10: Members, Projects & Settings

## Feature
PROJ-10: Members, Projects & Settings
Spec: features/PROJ-10-members-projects-settings.md

## Context Summary
- App URL: http://localhost:3001
- Admin: admin@example.com / admin123
- Previous QA (2026-03-04) was BLOCKED by disk full + missing AUTH_SECRET
- BUG-13 (project switching not updating session) was found and fixed since last QA
- SSR role guards JUST added to /settings/members and /settings/positions pages — primary focus
- All API routes fully implemented with Zod validation and Prisma
- Session uses JWT strategy; project context stored in JWT token

## Test Accounts
- admin@example.com / admin123 (seed default — superadmin)
- Create a regular user via registration: user@example.com / user123

## Acceptance Criteria to Test

### General Settings Tab
- AC-GEN-1: Page loads at /settings with project title and subtitle inputs
- AC-GEN-2: Save updates project name
- AC-GEN-3: Empty title shows validation error
- AC-GEN-4: Subtitle can be cleared

### Members Tab SSR Role Guard (NEWLY ADDED — primary focus)
- AC-MEM-0: Regular user accessing /settings/members directly → redirected to /settings
- AC-MEM-1: Admin/owner can access /settings/members normally

### Members Management
- AC-MEM-2: Members table shows email, role badge, position, actions
- AC-MEM-3: Invite Member opens modal with email/role/position fields
- AC-MEM-4: Invite existing user → creates membership + notification
- AC-MEM-5: Invite non-existent email → error "User not found"
- AC-MEM-6: Invite already-member → error "already a member"
- AC-MEM-7: Role dropdown updates member role
- AC-MEM-8: Only owners can promote to owner role
- AC-MEM-9: Admin cannot change owner's role
- AC-MEM-10: Cannot remove last owner
- AC-MEM-11: Remove member works with confirmation
- AC-MEM-12: Position dropdown updates member position

### Positions Tab SSR Role Guard (NEWLY ADDED — primary focus)
- AC-POS-0: Regular user accessing /settings/positions directly → redirected to /settings
- AC-POS-1: Admin/owner can access /settings/positions normally

### Positions Management
- AC-POS-2: Positions list shows all positions including protected "Misc"
- AC-POS-3: "Misc" has no edit/delete buttons
- AC-POS-4: Add new position
- AC-POS-5: Duplicate name → error
- AC-POS-6: Cannot create "misc" (case insensitive)
- AC-POS-7: Rename position inline
- AC-POS-8: Delete position → members become unassigned

### Projects Tab
- AC-PROJ-1: All projects listed with name, role, member count
- AC-PROJ-2: Current project highlighted
- AC-PROJ-3: Create new project → switches and redirects to dashboard
- AC-PROJ-4: Switch project → session + sidebar update (BUG-13 regression)
- AC-PROJ-5: Resign from project (non-owner)
- AC-PROJ-6: Owner cannot resign
- AC-PROJ-7: Delete project (owner, single member)
- AC-PROJ-8: Delete with multiple members → blocked

## Edge Cases
- EC-1: Owner self-demote as last owner → blocked
- EC-2: Unauthenticated direct URL to /settings/members → redirect to /login
- EC-3: Invite with owner role as admin → blocked
- EC-4: Delete current project → session cleared, redirect
- EC-5: Delete project with 2+ members → blocked

## Security Audit
1. Authorization bypass: GET /settings/members as regular user (direct URL) — now SSR-guarded
2. Authorization bypass: GET /settings/positions as regular user (direct URL) — now SSR-guarded
3. IDOR: Modify members of project user doesn't belong to (API level)
4. Role escalation: POST /api/projects/[id]/members with role=owner as admin
5. Role escalation: Try to remove last owner via DELETE
6. XSS: Inject script tag in project name or position name
7. Input validation: Project name > 100 chars, position name > 50 chars
8. Session check: After project switch, JWT correctly reflects new project role

## Regression Tests
- PROJ-5: Login/logout still works
- PROJ-7: Bills page still accessible for admin
- BUG-13: Project switch correctly updates session (critical regression)

## How to Test
Use curl for API tests, check page behavior via HTTP requests examining redirects.
For UI behavior, test via curl with session cookies and check response codes/redirects.
