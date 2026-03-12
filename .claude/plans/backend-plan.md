# Backend Implementation Plan — CR-12 (Forgot Password / Password Reset)

## Feature
CR-12: Add Forgot Password / Self-Service Password Reset
Spec: `features/CR-12-forgot-password-reset.md`
Parent: PROJ-5 (NextAuth.js Authentication)

## Context Summary
- **Auth:** NextAuth v5 with JWT sessions, bcryptjs for password hashing (`auth.ts`)
- **DB:** PostgreSQL via Prisma ORM (`prisma/schema.prisma`)
- **Rate limiting:** Upstash Redis with MockRatelimit fallback (`lib/ratelimit.ts`)
- **Middleware:** Edge middleware protects all non-public routes (`middleware.ts`)
- **Public routes:** `/`, `/login`, `/api/health`, `/api/auth/*`, `/_next/*`, `/favicon.ico`
- **Env example:** `.env.test.example` exists (no `.env.local.example`)
- **Login page:** Root `/` is combined landing+login page; `/login` redirects to `/`

## User Decisions
- Email provider: **Resend** via `resend` npm package + API key
- Token hash: SHA-256 (simpler than bcrypt for random tokens, equally secure)
- Token expiry: 1 hour
- Rate limit: 1 request per email per 5 minutes
- No user enumeration: always show generic success message

## Open Bug Reports to Address
None

## Database — New Prisma Model

### `PasswordResetToken`
| Column | Type | Notes |
|--------|------|-------|
| id | String @id @default(uuid()) | Primary key |
| email | String | User email |
| tokenHash | String @unique | SHA-256 hash of raw token |
| expiresAt | DateTime | Token expiry (now + 1 hour) |
| createdAt | DateTime @default(now()) | Creation timestamp |

**Indexes:** `@@index([email])`
**Note:** `tokenHash` has `@unique` which also creates an index.

## API Endpoints

### 1. `POST /api/auth/forgot-password`
- **Auth:** Public (no session required)
- **Input (Zod):** `{ email: z.string().email() }`
- **Logic:**
  1. Rate limit by email (1 per 5 min) — add `forgotPassword` config to `lib/ratelimit.ts`
  2. Look up user by email
  3. If user exists AND has a passwordHash (not empty = not Google-only):
     - Delete any existing tokens for this email
     - Generate 32-byte random token via `crypto.randomBytes(32)`
     - SHA-256 hash it, store in `PasswordResetToken` with 1-hour expiry
     - Send email via Nodemailer with reset link: `${APP_URL}/reset-password?token=${rawToken}`
  4. Always return 200 `{ message: "If an account exists with that email, a reset link has been sent." }`
- **Error cases:** Rate limited → 429, Invalid email → 400

### 2. `POST /api/auth/reset-password`
- **Auth:** Public (no session required)
- **Input (Zod):** `{ token: z.string().min(1), password: z.string().min(8) }`
- **Logic:**
  1. SHA-256 hash the incoming raw token
  2. Look up `PasswordResetToken` by `tokenHash` where `expiresAt > now()`
  3. If not found → 400 "Invalid or expired reset link"
  4. Look up user by email from the token record
  5. Hash new password with bcrypt (12 rounds, matching `auth.ts`)
  6. Update `User.passwordHash`
  7. Delete ALL tokens for this email (single-use + invalidate siblings)
  8. Return 200 `{ message: "Password has been reset successfully." }`
- **Error cases:** Invalid/expired token → 400, Password too short → 400

## New Files to Create

### 1. `lib/email.ts` — Resend client + send helper
```typescript
import { Resend } from 'resend';

// Instantiate Resend with RESEND_API_KEY env var
// Graceful fallback: if RESEND_API_KEY not configured, log warning + skip send

export async function sendPasswordResetEmail(email: string, resetUrl: string): Promise<void>
// HTML template with reset link and 1-hour expiry notice
// from: 'onboarding@resend.dev' (sandbox) or custom verified domain
```

### 2. `app/api/auth/forgot-password/route.ts`
### 3. `app/api/auth/reset-password/route.ts`
### 4. `app/(public)/forgot-password/page.tsx` — Email input form (client component)
### 5. `app/(public)/reset-password/page.tsx` — New password form (client component)
### 6. `prisma/migrations/[timestamp]_add_password_reset_token/migration.sql`

## Files to Modify

### 1. `prisma/schema.prisma` — Add PasswordResetToken model
### 2. `lib/ratelimit.ts` — Add forgotPassword limiter config + export
### 3. `middleware.ts` — Add `/forgot-password` and `/reset-password` to public routes
### 4. `.env.test.example` — Add SMTP env vars + NEXT_PUBLIC_APP_URL
### 5. `app/page.tsx` — Add "Forgot password?" link below sign-in button

## Dependencies to Install
```bash
npm install resend
```

## Environment Variables (add to `.env.test.example`)
```
RESEND_API_KEY=re_xxxxxxxxx
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Checklist
- [ ] Install `resend` package
- [ ] Add `PasswordResetToken` model to Prisma schema
- [ ] Create + apply Prisma migration
- [ ] Create `lib/email.ts` with Resend SDK
- [ ] Create `POST /api/auth/forgot-password` with rate limiting
- [ ] Create `POST /api/auth/reset-password` with token validation
- [ ] Create `/forgot-password` page with email form
- [ ] Create `/reset-password` page with password + confirm form
- [ ] Add "Forgot password?" link on login/landing page
- [ ] Update middleware for public routes
- [ ] Add `RESEND_API_KEY` + `NEXT_PUBLIC_APP_URL` to `.env.test.example`
- [ ] No user enumeration (generic success on forgot-password)
- [ ] Token stored as SHA-256 hash (raw token never persisted)
- [ ] Token is single-use (deleted on use)
- [ ] Token expires after 1 hour
- [ ] Graceful fallback if SMTP not configured (log warning, don't crash)
- [ ] Validate with `npx tsc --noEmit`
