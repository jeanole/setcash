# Frontend Implementation Plan — PROJ-5

## Feature
PROJ-5: NextAuth.js Authentication
Spec: `features/PROJ-5-nextauth-authentication.md`

## Context Summary
- PROJ-4 scaffold is complete: Next.js 14, Tailwind v4, Prisma, PostgreSQL, Docker
- Design system established: indigo primary (`indigo-600`), slate grays, soft radial gradient body background
- Existing layout components: `AppShell`, `Sidebar`, `Header` (all stubs, desktop-only sidebar)
- Existing pages: login stub, dashboard stub, protected layout stub
- `bcryptjs` already installed; `next-auth` NOT yet installed
- `lib/env.ts` exists with `DATABASE_URL` validation — will extend with `NEXTAUTH_SECRET`
- Tech design in spec is comprehensive — no architectural ambiguity
- Branch: `to_nextjs`

## User Decisions
- Login page: centered card on fullscreen background with logo — creative design, film-set feel
- Google button: standard Google branding (white, "G" logo)
- Transition/animation: "film set being built" — sequential elements animate in like props being placed on a stage
- Accessibility: WCAG 2.1 AA defaults (focus rings, labels, ARIA)
- Error UX: inline error message below the form (not toast)

## Open Bug Reports to Address
None

## Existing Components to Reuse
- `nextjs/app/globals.css` — CSS vars, focus ring, scrollbar styles (no changes needed)
- `nextjs/components/layout/Header.tsx` — modify to show user avatar with initials + SignOutButton
- `nextjs/app/(protected)/layout.tsx` — modify to add session guard + SessionProvider
- `nextjs/app/layout.tsx` — modify to wrap with SessionProvider
- `nextjs/lib/env.ts` — extend with NEXTAUTH_SECRET

## New Components to Build

### 1. `nextjs/auth.ts` — NextAuth v5 configuration
- Providers: CredentialsProvider (email + bcrypt), GoogleProvider
- JWT callbacks: embed `id`, `email`, `role`, `currentProjectId` in token
- Session callback: forward token fields to session object
- Error handling: throw on missing NEXTAUTH_SECRET at startup

### 2. `nextjs/middleware.ts` — Edge middleware
- Protects all routes under `/(protected)/`
- Redirects unauthenticated requests to `/login`
- Allows `/login`, `/api/auth/**`, and static assets through without auth check

### 3. `nextjs/app/api/auth/[...nextauth]/route.ts` — NextAuth HTTP handler
- Mounts GET and POST handlers from `auth.ts`

### 4. `nextjs/components/auth/LoginForm.tsx` — Client Component
**Props:** none (self-contained, uses `signIn()`)
**States:**
- Idle: email + password fields, Sign In button, Google button
- Loading: button shows spinner, fields disabled
- Error: inline red error message below the form ("Invalid email or password" / "Use Google login" / "Account not active")
**Responsive:** full-width on mobile, max-w-sm on all viewports (card constrains width)
**Animation:** each form element fades+slides in with staggered delay (see Design Specifications)

### 5. `nextjs/components/auth/SignOutButton.tsx` — Client Component
**Props:** none
**Behaviour:** calls `signOut({ callbackUrl: '/login' })` on click
**States:** idle text "Sign out"; loading spinner while signing out
**Responsive:** text button, fits inline in Header

### 6. `nextjs/lib/auth/session.ts` — Server helper
- `getCurrentUser()` — wraps `getServerSession(authConfig)`
- Returns `{ id, email, role, currentProjectId }` or `null`
- Used in server components and API route guards

## Pages / Routes to Create or Modify

### `/login` — `nextjs/app/(public)/login/page.tsx` [MODIFY]
**Route:** `/login`
**Components:** LoginForm
**Data source:** NextAuth (client-side `signIn()`)
**Design:** full-screen dark cinematic background, centered card with vBudget logo

### `/app/(protected)/layout.tsx` [MODIFY]
**Changes:**
- Import `getCurrentUser()` from `lib/auth/session.ts`
- Server-side session check → redirect to `/login` if null
- Wrap children with `SessionProvider` (makes session available to client components)

### `/app/layout.tsx` [MODIFY]
**Changes:**
- Import and render `SessionProvider` to make session context available globally to client components

### `nextjs/components/layout/Header.tsx` [MODIFY]
**Changes:**
- Import `getCurrentUser()` (server-side call)
- Replace `?` avatar with user initials derived from email (first letter, uppercase, indigo-600 bg)
- Add user email displayed below/beside avatar (hidden on mobile)
- Mount `SignOutButton` inline in the header's right side

## Data Connection
- **CredentialsProvider:** calls Prisma to find user by email, `bcrypt.compare()` for password
- **GoogleProvider:** standard OAuth flow via NextAuth, creates user on first Google login
- **JWT strategy:** no DB session table; token signed with `NEXTAUTH_SECRET`
- **Role derivation:** resolved in `jwt` callback — queries `ProjectMember` for active project
- **Loading states:** `LoginForm` manages its own loading state via React state
- **Error states:** NextAuth error codes mapped to user-friendly messages in `LoginForm`

## Design Specifications

### Login Page — Full-Screen Film Set

**Background (the "stage before the set is built"):**
- Dark: `bg-slate-950` base
- Layered radial gradients: deep indigo glow top-left, soft emerald glow bottom-right — like two stage spotlights warming up
- Subtle noise texture via `bg-[url(...)]` or CSS `background-blend-mode` for cinematic grain
- Background fades in first (opacity 0 → 1, 400ms ease-out)

**Card (the main "set piece" arriving on stage):**
- `bg-white/95 backdrop-blur-sm` — frosted glass feel on the dark stage
- `rounded-2xl`, `shadow-xl` (using `--vb-shadow-xl`)
- `max-w-sm w-full p-8`
- Animates in: slides up from below (`translateY(40px) → 0`) + fades in, 500ms ease-out, 200ms delay after background

**Logo area (the "marquee lights" turning on):**
- Centered `vB` monogram in a indigo-600 circle (`w-12 h-12 rounded-full bg-indigo-600`) — appears with a pop (scale 0.6→1 + opacity, 300ms ease-out, 100ms after card)
- `vBudget` text in `text-2xl font-bold text-slate-800`, below the monogram, delay 150ms after monogram
- Subtitle `text-sm text-slate-500 "Expense Tracker"`, delay 50ms after title

**Form elements (props being placed, one after another):**
- Email field: fades+slides up, delay 0ms after logo complete (~700ms total from page load)
- Password field: same, +80ms stagger
- Submit button: +80ms more
- Divider + Google button: +80ms more

**Animation keyframe (used for all elements):**
```css
@keyframes vb-rise {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
```
Each element uses `animation: vb-rise Xms ease-out both;` with incrementing delays.
Add this keyframe to `globals.css`.

**Form fields:**
- `input` — `w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:bg-white` + `box-shadow: var(--vb-ring)` on focus
- Label: `text-sm font-medium text-slate-700` above each input

**Submit button:**
- `w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-2.5 text-sm font-semibold transition-colors`
- Loading: `opacity-60 cursor-not-allowed` + inline spinner (SVG `animate-spin`)

**Divider:**
- `<hr>` with centered "or" text in `text-xs text-slate-400`

**Google button:**
- White bg, border `border-slate-200`, hover `bg-slate-50`
- Google "G" SVG logo (standard) inline left
- Text: "Sign in with Google"

**Inline error:**
- `text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-2`
- Appears with `vb-rise` animation (no stagger, immediate)

### Header — Updated
- User initials: first character of email, uppercase, `bg-indigo-600 text-white rounded-full w-8 h-8`
- Email: `text-xs text-slate-500` truncated, hidden on mobile
- SignOutButton: `text-xs text-slate-500 hover:text-slate-700` button, beside or below avatar

### Typography
- Font: system-ui (inherited from Tailwind v4 default — no Google Fonts CDN)
- Heading: `text-2xl font-bold text-slate-800`
- Body: `text-sm text-slate-600`
- Errors: `text-sm text-red-600`

## Installation Step
Before implementing, the subagent must run:
```bash
cd nextjs && npm install next-auth@beta
```

## Env Vars to Add to `lib/env.ts`
Add `NEXTAUTH_SECRET` to `REQUIRED_ENV_VARS` — throw if missing.

## Checklist
- [ ] `next-auth@beta` installed
- [ ] `nextjs/auth.ts` created — CredentialsProvider + GoogleProvider + JWT callbacks
- [ ] `nextjs/middleware.ts` created — protects `/(protected)/` routes
- [ ] `nextjs/app/api/auth/[...nextauth]/route.ts` created
- [ ] `nextjs/components/auth/LoginForm.tsx` created — all states: idle, loading, error
- [ ] `nextjs/components/auth/SignOutButton.tsx` created
- [ ] `nextjs/lib/auth/session.ts` created — `getCurrentUser()` helper
- [ ] `nextjs/app/(public)/login/page.tsx` updated — full design, film-set animation
- [ ] `nextjs/app/(protected)/layout.tsx` updated — session guard + SessionProvider
- [ ] `nextjs/app/layout.tsx` updated — SessionProvider wrapper
- [ ] `nextjs/components/layout/Header.tsx` updated — initials avatar + email + SignOutButton
- [ ] `nextjs/lib/env.ts` updated — NEXTAUTH_SECRET added to required vars
- [ ] `@keyframes vb-rise` added to `globals.css`
- [ ] `nextjs/.env.test.example` verified to include all auth env vars
- [ ] No TypeScript errors (next build passes)
- [ ] Responsive: 375px, 768px, 1440px
- [ ] Accessibility: ARIA labels on form, focus rings working, semantic HTML
- [ ] Error messages cover: invalid credentials, Google-only account, inactive account
- [ ] Code committed: `feat(PROJ-5): Implement NextAuth.js authentication UI`
- [ ] `features/INDEX.md` status updated
