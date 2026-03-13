# Backend Implementation Plan — PROJ-20 User Profile Edit Panel

## Feature
PROJ-20: User Profile Edit Panel — `features/PROJ-20-user-profile-edit.md`

## Context Summary
- All app code in `nextjs/`
- Auth: NextAuth v5 with JWT sessions, bcryptjs for password hashing
- DB: PostgreSQL via Prisma ORM; client at `lib/db.ts`
- Session helper: `lib/auth/session.ts` — `getCurrentUser()` returns `{ id, email, role, currentProjectId }`
- Admin user routes exist at `app/api/admin/users/` — our new routes are separate self-service routes
- Password validation pattern: min 8 chars, regex `^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)` (from admin users route)
- Zod validation pattern used across all API routes
- User model fields: id, email, passwordHash, emailVerified, isSuperAdmin, isActive, createdAt, defaultProjectId, legacyId
- No `username`, `firstName`, `lastName`, `mobile` columns exist yet

## User Decisions
- Password change is inline (current password + new password), not email-based reset
- Username must be unique case-insensitively
- All new fields are optional/nullable
- No rate limiting needed for profile updates (already behind auth)

## Open Bug Reports to Address
None

## Database — Prisma Schema Change

Add 4 nullable columns to the `User` model:

| Field | Type | Constraint |
|-------|------|-----------|
| `username` | String? | `@unique` (case-insensitive enforced in code) |
| `firstName` | String? | None |
| `lastName` | String? | None |
| `mobile` | String? | None |

Migration: `npx prisma migrate dev --name add_user_profile_fields`

## API Endpoints

### 1. `GET /api/users/me`
- **Auth:** Authenticated user (use `getCurrentUser()`)
- **Logic:**
  1. Get session user via `getCurrentUser()`
  2. If no session → 401
  3. Fetch user from DB by `session.id`, select: `email, username, firstName, lastName, mobile`
  4. Return user fields
- **Response:** `{ email, username, firstName, lastName, mobile }`
- **Errors:** 401 unauthenticated, 500 internal

### 2. `PATCH /api/users/me`
- **Auth:** Authenticated user
- **Input (Zod):**
  ```
  {
    username: z.string().max(50).nullable().optional(),
    firstName: z.string().max(100).nullable().optional(),
    lastName: z.string().max(100).nullable().optional(),
    mobile: z.string().max(30).nullable().optional()
  }
  ```
- **Logic:**
  1. Get session user → 401 if missing
  2. Validate body with Zod → 400 if invalid
  3. If username provided and non-null: check uniqueness case-insensitively (exclude current user) → 409 if taken
  4. Update user record with provided fields
  5. Return updated fields
- **Response:** `{ email, username, firstName, lastName, mobile }`
- **Errors:** 401, 400, 409 (username taken), 500

### 3. `PATCH /api/users/me/password`
- **Auth:** Authenticated user
- **Input (Zod):**
  ```
  {
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
  }
  ```
- **Logic:**
  1. Get session user → 401 if missing
  2. Validate body → 400 if invalid
  3. Fetch user by ID, get `passwordHash`
  4. Compare `currentPassword` with `passwordHash` via `bcrypt.compare` → 401 if wrong
  5. Hash `newPassword` with bcrypt (12 rounds)
  6. Update `User.passwordHash`
  7. Return 200 `{ message: "Password updated successfully" }`
- **Errors:** 401 (unauthenticated or wrong password), 400 (validation), 500

## New Files to Create

1. `app/api/users/me/route.ts` — GET + PATCH handlers
2. `app/api/users/me/password/route.ts` — PATCH handler
3. Prisma migration (auto-generated)

## Files to Modify

1. `prisma/schema.prisma` — Add 4 fields to User model
2. `app/(protected)/layout.tsx` — Fetch profile fields from DB and pass to AppShell (the frontend plan already modified this but may need adjusting to actually query DB)

## Checklist
- [ ] Add `username`, `firstName`, `lastName`, `mobile` to Prisma User model
- [ ] Create + apply Prisma migration
- [ ] Create `GET /api/users/me` — returns profile fields for authenticated user
- [ ] Create `PATCH /api/users/me` — updates profile fields with Zod validation
- [ ] Username uniqueness check (case-insensitive, exclude self) → 409
- [ ] Create `PATCH /api/users/me/password` — validates current password, hashes + saves new
- [ ] All endpoints check auth via `getCurrentUser()`
- [ ] Max length validation on all string fields
- [ ] bcrypt compare for current password verification
- [ ] bcrypt hash (12 rounds) for new password
- [ ] Password regex matches signup pattern
- [ ] Ensure `app/(protected)/layout.tsx` fetches the new fields from DB
- [ ] Validate with `npx tsc --noEmit`
