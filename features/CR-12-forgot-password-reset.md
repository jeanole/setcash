# CR-12: Add Forgot Password / Self-Service Password Reset

**Feature:** [PROJ-5: NextAuth.js Authentication](PROJ-5-nextauth-authentication.md)
**Requested:** 2026-03-11 | **Priority:** Medium | **Status:** Pending Review

---

## Current Behavior

There is no "Forgot Password" link on the login page. Users who forget their password have no self-service recovery path — they must ask a super admin to use the "Reset Password" button in the Super Admin panel, which generates a new password and shows it once.

## Desired Behavior

A "Forgot password?" link on the login page opens a flow where the user enters their email address. If an account exists for that email, a password-reset link is emailed to them. The link expires after a short window (e.g. 1 hour). Clicking it opens a form where they can set a new password.

## Rationale

Standard SaaS expectation. Super-admin-mediated resets do not scale and are unavailable to users in most scenarios. Self-service reset improves UX and reduces admin burden.

## Email Infrastructure

Requires an outbound email sender. Recommended options (lowest to highest complexity):

| Option | Setup | Free tier | Recommended for |
|--------|-------|-----------|-----------------|
| **Resend** (`resend` npm package) | Add API key to `.env` | 3,000/month | Simplest, best DX |
| **Nodemailer + SMTP** (Mailgun, SendGrid, Postmark, Gmail) | SMTP creds in `.env` | Varies | SMTP compatibility |
| **Self-hosted (Postal, Mailu)** | Docker setup required | Unlimited | Full data sovereignty |

A new env var (e.g. `RESEND_API_KEY` or `SMTP_*`) must be documented in `.env.local.example`.

## Technical Approach

1. **Token generation:** On reset request, generate a cryptographically random token (`crypto.randomBytes(32)`), store a bcrypt hash of it in a new `PasswordResetToken` table (email, tokenHash, expiresAt), and email the raw token as a URL param.
2. **API routes:**
   - `POST /api/auth/forgot-password` — accepts email, creates token, sends email (rate-limited: 1 request per email per 5 min)
   - `POST /api/auth/reset-password` — accepts token + new password, validates token, updates `User.passwordHash`, deletes token
3. **Pages:**
   - `/forgot-password` — email input form (public route)
   - `/reset-password?token=...` — new password form (public route, validates token on load)
4. **Database:** New Prisma model `PasswordResetToken { id, email, tokenHash, expiresAt, createdAt }`
5. **Security:** Token is single-use (deleted on use), expires in 1 hour, hash stored (not raw token), rate-limited endpoint

## Proposed Acceptance Criteria

- [ ] "Forgot password?" link visible on the login page (below the sign-in button)
- [ ] `/forgot-password` page: email input, submit sends reset email, always shows success message regardless of whether email exists (prevents user enumeration)
- [ ] Reset email sent via configured provider with a link valid for 1 hour
- [ ] `/reset-password?token=...` page: validates token on load (shows error if expired/invalid), accepts new password + confirmation
- [ ] On successful reset: password updated, token deleted, user redirected to login with success message
- [ ] `PasswordResetToken` Prisma model + migration added
- [ ] Rate limiting on `POST /api/auth/forgot-password` (max 1 request per email per 5 minutes)
- [ ] Token stored as bcrypt/SHA-256 hash — raw token never persisted
- [ ] Email provider configurable via env vars; undocumented/missing provider causes clear startup warning (not crash)
- [ ] New env vars documented in `.env.local.example`
- [ ] Middleware updated: `/forgot-password` and `/reset-password` added to public routes

## Resolution

Pending
