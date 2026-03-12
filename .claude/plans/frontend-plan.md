# Frontend Implementation Plan — CR-11 (Merge Landing + Login Page)

## Feature
CR-11: Merge Landing Page and Login Page into One
Feature: PROJ-5 (NextAuth.js Authentication)
Spec: `features/PROJ-5-nextauth-authentication.md` → Change Requests → CR-11

## Context Summary
- Current `app/page.tsx` is a scaffold/migration-notice placeholder — not useful
- Current `app/(public)/login/page.tsx` is a standalone dark login page with `LoginForm`
- `LoginForm` component at `components/auth/LoginForm.tsx` is self-contained with logo, form, Google button
- Middleware at `middleware.ts` has `/login` in the public route list
- Design tokens in `globals.css`: indigo accent `#6366f1`, slate-50 content bg, Inter font
- Login page uses dark cinematic bg: `slate-950` with indigo/emerald radial gradients

## User Decisions
- **Layout:** Full landing page with product info + embedded login form (option B)
- **Responsive:** Split two-column on desktop (≥1024px), stacked single-column on mobile (≤768px)
- **Priority:** Medium
- **Style:** Keep the dark cinematic background from the existing login page

## Open Bug Reports to Address
None

## Existing Components to Reuse
- `LoginForm` (`components/auth/LoginForm.tsx`) — reuse as-is, embedded in the new page
- Design tokens from `globals.css`

## Implementation Plan

### Step 1: Rewrite `app/page.tsx`
Replace the scaffold page with a combined landing+login page:

**Desktop layout (lg+):**
```
┌──────────────────────────────────────────────┐
│  LEFT (60%)              │  RIGHT (40%)       │
│                          │                    │
│  vBudget logo (large)    │  ┌──────────────┐  │
│  Tagline                 │  │  LoginForm    │  │
│  3 feature highlights    │  │  (frosted     │  │
│  (icons + text)          │  │   glass card) │  │
│                          │  └──────────────┘  │
│  "v2.0" footer           │                    │
└──────────────────────────────────────────────┘
```

**Mobile layout (<lg):**
```
┌─────────────────────┐
│  vBudget logo       │
│  Tagline            │
│  ┌───────────────┐  │
│  │  LoginForm    │  │
│  │  (card)       │  │
│  └───────────────┘  │
│  Feature highlights │
│  (compact)          │
└─────────────────────┘
```

**Background:** Dark cinematic (`slate-950` with radial gradients from existing login page)

**Left column content:**
- Large "vBudget" wordmark (text-4xl+ bold, white)
- Tagline: "Track expenses. Manage budgets. Simplify reimbursements."
- 3 feature cards/highlights:
  - Receipt scanning with AI analysis
  - Multi-project budget tracking
  - Team expense management
- Each with a simple icon and 1-line description
- All text white/slate-300 against dark bg

**Right column:**
- Frosted glass card (`bg-white/95 backdrop-blur-sm rounded-2xl`)
- Contains `<LoginForm />` directly (no changes to LoginForm needed)

**Auth redirect:** Add server-side auth check — if user is already authenticated, redirect to `/dashboard`

### Step 2: Update `app/(public)/login/page.tsx`
Redirect to `/` since the root page now handles login.

```tsx
import { redirect } from 'next/navigation';
export default function LoginPage() {
  redirect('/');
}
```

### Step 3: Update middleware
Add `/` to the public route list in `middleware.ts`:
```ts
const isPublicRoute =
  nextUrl.pathname === '/' ||
  nextUrl.pathname === '/login' ||
  ...
```

### Step 4: Update auth redirect
In `middleware.ts`, the redirect for unauthenticated users currently goes to `/login`. Change to `/`:
```ts
const loginUrl = new URL('/', nextUrl.origin);
```

## Design Specifications
- **Background:** `#020617` (slate-950) with radial gradients: indigo at top-left, emerald at bottom-right
- **Left text:** White (`text-white`) for headings, `text-slate-300` for body, `text-slate-500` for footer
- **Feature icons:** `text-indigo-400` with `bg-white/10` icon containers
- **Right card:** `bg-white/95 backdrop-blur-sm rounded-2xl` with `--vb-shadow-xl`
- **Responsive breakpoint:** `lg:` (1024px) for split → stacked transition
- **Font:** Inter (already loaded)

## Checklist
- [ ] `app/page.tsx` rewritten as combined landing+login
- [ ] Left column: branding, tagline, feature highlights
- [ ] Right column: LoginForm embedded in frosted card
- [ ] Responsive: stacked on mobile, split on desktop
- [ ] `app/(public)/login/page.tsx` redirects to `/`
- [ ] Middleware updated: `/` added to public routes
- [ ] Middleware updated: unauthenticated redirect goes to `/` instead of `/login`
- [ ] Authenticated users visiting `/` redirected to `/dashboard`
- [ ] Dark cinematic background preserved
- [ ] No changes to LoginForm component itself
