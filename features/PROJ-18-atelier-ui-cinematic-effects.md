# PROJ-18: Atelier UI + Cinematic Effects

## Status: Planned
**Created:** 2026-03-06
**Last Updated:** 2026-03-06

## Dependencies
- PROJ-4 (Next.js Scaffold) — all changes live inside `nextjs/`
- PROJ-7 (Bills Feature) — CinematicButton applied to bill submit; ClapperboardToast hooks into bill success flow

## Overview
Two-part visual redesign of the vBudget Next.js frontend targeting a creative audience:

**Part 1 — Atelier Design System:** Replace the generic Tailwind/indigo aesthetic with a warm, editorial "Atelier" design language. Distinctive typography, warmer palette, precise financial data presentation.

**Part 2 — Cinematic Easter Eggs:** Three probabilistic, non-intrusive cinematic effects (particle burst, film-roll nav, clapperboard toast) that trigger randomly to delight users. All effects respect `prefers-reduced-motion` and never block interaction.

No backend changes. No API changes. `nextjs/` only.

---

## User Stories

### Design System
- As a creative user, I want the app to feel crafted and distinctive so that using a budget tool doesn't feel like using generic corporate software.
- As a user, I want financial numbers (amounts, dates, totals) to be visually distinct from labels so that I can scan data faster without reading every character.
- As a user, I want the sidebar to contrast clearly with the content area so that navigation and content feel spatially separated.
- As a user on a wide monitor, I want content to stay readable and not stretch to fill the full width so that lines of data don't become too long to scan.
- As a mobile user, I want the header and sidebar to feel as polished as desktop so that the app feels intentional on any device.

### Cinematic Effects
- As a creative user, I want occasional surprising moments in the UI so that the app has personality and rewards attention.
- As a user who submitted a bill successfully, I want a memorable confirmation moment (not just a toast) so that the action feels significant.
- As a user who prefers reduced motion, I want all cinematic effects to be silently skipped so that the app remains accessible.
- As a user, I want cinematic effects to never block or delay my workflow so that they are delightful, not disruptive.

---

## Acceptance Criteria

### Part 1 — Atelier Design System

#### Typography
- [ ] `Bricolage Grotesque` loaded via `next/font/google` and applied as the default body font across the entire app
- [ ] `DM Mono` loaded via `next/font/google` and applied to all currency amounts, bill numbers, dates, and budget matrix cells
- [ ] All amounts use `font-variant-numeric: tabular-nums` so columns align correctly

#### Color & Palette
- [ ] Body background changed to warm cream `#F8F7F4` (not pure white or slate-50)
- [ ] Primary action color changed from `indigo-600` to `#7C6AF6` throughout all buttons and interactive elements
- [ ] All `indigo-*` Tailwind references in layout and shared components replaced with the new accent
- [ ] CSS variables for the full Atelier palette added to `globals.css`

#### Sidebar
- [ ] Sidebar background is warm `zinc-900` (`#18181B`) — not slate-900
- [ ] Active nav item shows a 2px left border in `#7C6AF6`, no filled background pill
- [ ] Inactive nav item: `text-zinc-400`, hover: `text-zinc-50 bg-white/6`
- [ ] Active nav item: `text-zinc-50 bg-white/10` with accent border
- [ ] Border is always present (transparent when inactive) — no layout shift on activation
- [ ] Section labels: 10px, uppercase, `tracking-[0.12em]`, `text-zinc-500`
- [ ] Logo/project name renders in Bricolage Grotesque bold, `text-zinc-50`

#### Header
- [ ] Header is `sticky top-0 z-[1000]`
- [ ] Header background: `bg-[rgba(248,247,244,0.85)] backdrop-blur-md`
- [ ] Header border: `border-b border-zinc-900/8` (warm, subtle)
- [ ] User avatar background: `#7C6AF6`

#### Cards
- [ ] Card border: `border border-zinc-900/8` (warm, barely-visible)
- [ ] Card padding: `p-5 md:p-6` (responsive)
- [ ] Card background: white `#FFFFFF`

#### Main Content
- [ ] Content area background matches body: warm cream `#F8F7F4`
- [ ] Content max-width: `max-w-7xl mx-auto`
- [ ] Content padding: `px-4 md:px-6 pb-8`

#### Tables
- [ ] Table header cells: `text-[10.5px] font-semibold uppercase tracking-[0.1em] text-zinc-400`
- [ ] Table row hover: `bg-violet-50/40` (subtle violet tint)
- [ ] Draft rows: `bg-rose-50/40`
- [ ] Table border: `border border-zinc-900/8`

#### Buttons
- [ ] Primary button: `bg-[#7C6AF6] hover:bg-[#6C5CE7] text-white`
- [ ] Primary button press: `active:scale-[0.97] transition-all`

---

### Part 2 — Cinematic Easter Eggs

#### CinematicButton (`nextjs/components/cinematic/CinematicButton.tsx`)
- [ ] Component wraps any child button/element without altering its layout or functionality
- [ ] On click, has exactly 1-in-4 probability of triggering the particle burst effect
- [ ] Particle burst: 12–16 small colored particles radiate outward from the click coordinates
- [ ] Particles fade out over ~600ms and are removed from DOM after animation completes
- [ ] Particles render in an absolutely-positioned overlay — never shift layout
- [ ] Effect is skipped entirely if `prefers-reduced-motion: reduce` is set
- [ ] Applied to: "New Bill" button on bills page, "Save" buttons, "Submit" button on new bill form
- [ ] Particle colors use the Atelier accent palette (violet, amber, rose variants)

#### FilmRollNav (`nextjs/components/cinematic/FilmRollNav.tsx`)
- [ ] On app/page load, has exactly 1-in-5 probability of replacing the normal nav fade-in
- [ ] Film roll animation: each nav item ticks in sequentially with a brief pause then snap (like a film sprocket advancing one frame)
- [ ] Each item: opacity 0 → 1 with a 2px upward translate snap, staggered 80ms per item
- [ ] If effect does NOT trigger, normal fade-in plays as usual
- [ ] Effect is skipped entirely if `prefers-reduced-motion: reduce` is set
- [ ] Sidebar remains fully interactive during and after the animation

#### ClapperboardToast (`nextjs/components/cinematic/ClapperboardToast.tsx`)
- [ ] On successful bill submission, has exactly 1-in-3 probability of showing instead of the normal success toast
- [ ] Animation: SVG clapperboard enters from top of viewport (slides down), clapper arm snaps shut with a brief hold (200ms), then whole element slides back up and exits
- [ ] Full animation duration: ~1200ms
- [ ] Clapperboard SVG is self-contained inline SVG — no external assets
- [ ] Shows text "Scene!" or "Action!" in DM Mono inside the clapperboard body
- [ ] Renders in a fixed overlay at top-center of screen, `z-[9000]`
- [ ] Never blocks any interactive elements (pointer-events: none on container)
- [ ] When effect does NOT trigger, normal success toast shows as usual
- [ ] Effect is skipped entirely if `prefers-reduced-motion: reduce` is set

#### General Cinematic Rules
- [ ] All three components live in `nextjs/components/cinematic/`
- [ ] `nextjs/components/cinematic/index.ts` exports all three
- [ ] No external animation libraries used — pure CSS keyframes + React state
- [ ] All probability rolls use `Math.random()` at runtime — not seeded
- [ ] All effects are purely decorative: `pointer-events: none`, `aria-hidden="true"`, `role="presentation"`

---

## Edge Cases

- **prefers-reduced-motion:** All three cinematic components check `window.matchMedia('(prefers-reduced-motion: reduce)').matches` on mount and skip the effect silently. The underlying button/toast/nav still functions normally.
- **Rapid clicking:** CinematicButton debounces: if a burst is already active, a second click cannot trigger another burst until the first completes.
- **SSR (server-side rendering):** `Math.random()` probability roll and `matchMedia` check both happen client-side only (inside `useEffect` or click handler). No hydration mismatch.
- **Slow connections:** FilmRollNav and normal nav fade-in both work without data — they animate elements already in the DOM.
- **Bill submit fails:** ClapperboardToast only triggers on confirmed success (HTTP 200/201 response). Errors always show the standard error message — no cinematic effect.
- **Mobile viewport:** ClapperboardToast is capped at `max-w-[280px]` centered — fits all mobile screen widths. Particles on CinematicButton are capped at `80px` radius so they stay on-screen even for edge buttons.
- **Multiple rapid page navigations:** FilmRollNav animation is cancelled (opacity reset) if the component unmounts before completion.
- **Font loading failure:** If Google Fonts fails to load, CSS `font-family` stack falls back to system sans-serif for UI text and `monospace` for numbers — no layout breaks.

---

## Technical Requirements

- **Scope:** `nextjs/` directory only — zero changes to `public/`, Express routes, or `db.js`
- **Fonts:** Loaded via `next/font/google` (not CDN link) for optimal performance and no FOUT
- **CSS:** Tailwind v4 utility classes + CSS variables in `globals.css`. No inline `style` props for design tokens.
- **Animation:** Pure CSS `@keyframes` + React `useState`/`useEffect`. No Framer Motion, GSAP, or other animation libraries.
- **Bundle impact:** All cinematic components are client components (`'use client'`). They must not increase the layout/sidebar bundle — use dynamic import with `next/dynamic` and `ssr: false`.
- **Accessibility:** All decorative animation elements carry `aria-hidden="true"` and `role="presentation"`. Focus management unchanged.
- **Browser support:** Chrome 90+, Firefox 88+, Safari 14+. `backdrop-filter` has graceful fallback to solid background.
- **Performance:** Particle DOM nodes are created and destroyed per-burst — no persistent particle pool in memory.

---

## Tech Design (Solution Architect)

### Overview
PROJ-18 is a **frontend-only** change. No database, no API routes, no server-side logic changes. Every change lives inside `nextjs/` and is purely visual — class names, CSS variables, font loading, and three new decorative animation components.

The work divides cleanly into two layers:
- **Layer 1 — Design System:** Update existing components and global styles to use the Atelier palette and typography.
- **Layer 2 — Cinematic Module:** Add a new `cinematic/` component folder with three self-contained Easter egg components that plug into existing interaction points.

---

### A) Component Structure

```
nextjs/
├── app/
│   ├── layout.tsx                         [MODIFY] — load Bricolage Grotesque + DM Mono fonts
│   ├── globals.css                        [MODIFY] — Atelier CSS variables, body bg, font-family
│   └── (protected)/
│       ├── bills/page.tsx                 [MODIFY] — wrap "New Bill" button with CinematicButton
│       ├── bills/new/page.tsx             [MODIFY] — wrap Submit button with CinematicButton
│       └── budget/page.tsx               [MODIFY] — card style tokens
│
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx                   [MODIFY] — warm bg, max-width container
│   │   ├── Sidebar.tsx                    [MODIFY] — zinc-900 warm, accent-bar nav, FilmRollNav
│   │   └── Header.tsx                     [MODIFY] — frosted glass, sticky, new accent
│   │
│   ├── bills/
│   │   ├── BillList.tsx                   [MODIFY] — table styles, DM Mono on amounts
│   │   ├── BillForm.tsx                   [MODIFY] — wrap Save/Submit with CinematicButton; hook ClapperboardToast on success
│   │   ├── BillDetailHeader.tsx           [MODIFY] — DM Mono on bill number/amount
│   │   └── BillStatusBadge.tsx            [MODIFY] — update accent color references
│   │
│   ├── budget/
│   │   ├── BudgetMatrixCell.tsx           [MODIFY] — DM Mono on cell input values
│   │   └── BudgetMatrixTable.tsx          [MODIFY] — table header editorial style
│   │
│   ├── ui/
│   │   ├── DataTable.tsx                  [MODIFY] — table header/row hover to Atelier style
│   │   └── RoleBadge.tsx                  [MODIFY] — update accent color references
│   │
│   └── cinematic/                         [NEW FOLDER]
│       ├── CinematicButton.tsx            [NEW] — particle burst wrapper
│       ├── FilmRollNav.tsx                [NEW] — film sprocket nav entrance
│       ├── ClapperboardToast.tsx          [NEW] — clapperboard success animation
│       └── index.ts                       [NEW] — barrel export
```

**Files modified:** ~14 existing files
**Files created:** 4 new files (all in `cinematic/`)

---

### B) Data & State Model

No new data is persisted. All state is temporary UI state:

**CinematicButton**
- Holds one boolean: "is a particle burst currently active?"
- When active, creates a small set of particle DOM elements (12–16 divs), animates them, then destroys them all. Nothing is stored after the animation ends.
- Probability roll (1-in-4): decided at click time using a random number — not stored anywhere.

**FilmRollNav**
- Holds one boolean: "should film-roll mode play this session?"
- Decided once on component mount using a random number (1-in-5). Stored only in React component memory for the lifetime of the sidebar — resets on full page reload.

**ClapperboardToast**
- Holds one boolean: "is the clapperboard currently visible?"
- Triggered from outside (by BillForm) via a prop or callback. Visible for ~1.2 seconds, then self-dismisses. Nothing persisted.

**Design tokens** — all live in `globals.css` as CSS custom properties. No JavaScript configuration files, no theme context providers, no additional stores.

---

### C) Integration Points (how cinematic hooks into existing components)

| Effect | Where it plugs in | How |
|--------|-------------------|-----|
| CinematicButton | `BillForm.tsx` Save/Submit, `bills/page.tsx` "New Bill" | Wraps the existing `<button>` element — no changes to button logic |
| FilmRollNav | `Sidebar.tsx` nav list | Sidebar passes nav items into FilmRollNav instead of rendering them directly; FilmRollNav renders identical markup with optional animation |
| ClapperboardToast | `BillForm.tsx` success callback | After a successful bill POST, BillForm calls `showClapperboard()` (local state setter passed down); ClapperboardToast renders in a fixed portal above everything |

The cinematic components are **loaded lazily** using Next.js dynamic imports with `ssr: false`. This means they are never included in the initial server-rendered HTML — they only load in the browser after the page is interactive. This protects bundle size and prevents any server/client mismatch from the random number logic.

---

### D) Font Loading Strategy

Two fonts are loaded via Next.js's built-in font system (`next/font/google`):

- **Bricolage Grotesque** — applied to the entire app body as the default UI font, replacing the current system font stack
- **DM Mono** — exposed as a CSS variable (`--font-dm-mono`) so it can be applied selectively to number-bearing elements without affecting the rest of the layout

The fonts are declared once in `app/layout.tsx` and flow down through CSS variables. No component needs to import font configuration directly. If the fonts fail to load (no internet, CDN outage), the browser falls back gracefully to system sans-serif and monospace respectively — no layout breaks.

---

### E) Tech Decisions

**Why no animation library (Framer Motion, GSAP)?**
All three cinematic effects are simple enough to implement with CSS `@keyframes` and React's built-in state. Adding an animation library for three decorative Easter eggs would increase the JavaScript bundle by 30–100KB and add a dependency to maintain. Pure CSS animations also run on the GPU compositor thread — they cannot be blocked by JavaScript work.

**Why dynamic import for cinematic components?**
The cinematic folder is purely decorative. Using `next/dynamic` with `ssr: false` ensures these components are never included in the server-rendered page or the initial JavaScript bundle. They load asynchronously after the page is interactive — invisible to users and search engines.

**Why CSS custom properties for the design tokens?**
Tailwind utility classes are generated at build time. Design tokens (colours, shadows) that need to be referenced by both Tailwind classes and raw CSS (like the `backdrop-filter` frosted glass) must live in CSS variables. This also means a future dark mode toggle could swap all tokens in one `:root` override without touching any component files.

**Why keep the dark sidebar (zinc-900) instead of switching to white?**
The original plan proposed matching the Express app's white sidebar. The elevated Atelier direction keeps the dark sidebar because the warm zinc-900 vs. cream content contrast is the strongest visual signature of the new design — it immediately signals "this is different from generic SaaS." The dark sidebar with a left violet accent bar is also more common in tools that creative professionals use (Linear, Raycast, Vercel dashboard).

---

### F) Blast Radius (what could break)

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Bricolage Grotesque renders narrower/wider than current font, causing layout overflow | Low | Font is variable-weight grotesque — dimensions very similar to Inter. Check bills table and budget matrix after implementation. |
| `backdrop-filter` not supported in older browsers | Low | Safari 14+, Chrome 76+, Firefox 103+ all support it. Fallback: solid `#F8F7F4` background — visually fine. |
| CinematicButton `position: relative` wrapper changes button layout | Low | Wrapper uses `display: contents` or `inline-flex` matching the child — verified pattern. |
| Existing `indigo-*` Tailwind classes in components not covered by the plan | Medium | A grep pass for `indigo-` across `nextjs/` before implementation will catch any missed references. |
| FilmRollNav animation runs on every hot-reload in development | Low | Probability roll happens on mount — 1-in-5 chance means it's infrequent. Not worth suppressing in dev. |

---

### G) No Backend Work Required

Zero changes to:
- `server.js`, any `routes/` file, `db.js`, `middleware.js` (Express app untouched)
- Any `nextjs/app/api/` route
- Prisma schema or migrations
- Docker configuration

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
