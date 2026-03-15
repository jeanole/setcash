# Frontend Implementation Plan — PROJ-21: Full Brand Overhaul

## Feature
PROJ-21 CR-26: Replace indigo → yellow accent, apply dark theme tokens, zero border-radius
Spec: `features/PROJ-21-brand-design-system.md`

## Strategy
Three-layer approach (most cascade, least file touching):
1. **globals.css** — update `--vb-*` tokens to yellow + dark values; Tailwind radius override; body styles
2. **Sed bulk replace** — replace hardcoded hex `#6366f1`/`#4f46e5` with CSS variable references
3. **Manual fixes** — Tailwind `indigo-*` classes in layout components (Sidebar, Header, nav items)

## Context Summary
- 127 instances of `#6366f1` across 45+ files
- 23 instances of `#4f46e5` (hover) across 23+ files
- 416 `rounded-*` instances across many files
- Tailwind 4.0 CSS-first — use `@theme` block to override border-radius to 0
- `--vb-accent` is the main CSS variable used by components — updating it cascades widely

## Step 1: Update globals.css

### 1a. Update `--vb-*` accent tokens (in `:root` block)
Change:
```css
--vb-sidebar-hover: rgba(99,102,241,0.06);
--vb-sidebar-active: rgba(99,102,241,0.10);
--vb-sidebar-accent: #6366f1;
--vb-accent: #6366f1;
--vb-accent-hover: #4f46e5;
--vb-accent-light: rgba(99,102,241,0.08);
--vb-accent-ring: 0 0 0 3px rgba(99,102,241,0.22);
--vb-ring: 0 0 0 3px rgba(99,102,241,0.22);
```
To:
```css
--vb-sidebar-hover: rgba(250,204,21,0.08);
--vb-sidebar-active: rgba(250,204,21,0.12);
--vb-sidebar-accent: #FACC15;
--vb-accent: #FACC15;
--vb-accent-hover: #d4a800;
--vb-accent-light: rgba(250,204,21,0.08);
--vb-accent-ring: 0 0 0 3px rgba(250,204,21,0.30);
--vb-ring: 0 0 0 3px rgba(250,204,21,0.30);
```

Also add these to `:root` alongside `--accent`:
```css
--accent-hover: #d4a800;
```

### 1b. Update sidebar background/text tokens (in `:root` block)
Change to dark theme colors:
```css
--vb-sidebar-bg: #18181B;
--vb-sidebar-border: #27272A;
--vb-sidebar-text: #A1A1AA;
--vb-sidebar-text-active: #FAFAFA;
--vb-content-bg: #0F0F10;
--vb-card-bg: #18181B;
--vb-card-border: rgba(255,255,255,0.06);
--vb-header-bg: rgba(15,15,16,0.85);
--vb-text-primary: #FAFAFA;
--vb-text-secondary: #A1A1AA;
--vb-text-muted: #52525B;
```

### 1c. Update body styles
Remove the indigo/emerald radial gradient. Replace with:
```css
body {
  font-family: var(--font-inter), sans-serif;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background-color: var(--bg-primary);
  color: var(--text-primary);
}
```

### 1d. Add Tailwind 4 border-radius override (after `@import "tailwindcss"`)
```css
@theme {
  --radius-none: 0px;
  --radius-sm: 0px;
  --radius: 0px;
  --radius-md: 0px;
  --radius-lg: 0px;
  --radius-xl: 0px;
  --radius-2xl: 0px;
  --radius-3xl: 0px;
  --radius-full: 9999px; /* keep full/circle for avatars */
}
```
Note: Keep `--radius-full` at 9999px — avatar circles should stay round.

### 1e. Update body gradient references
Remove `rgba(99, 102, 241, 0.08)` indigo gradient from body.

## Step 2: Sed bulk replace — hardcoded hex colors

Run these replacements across all .tsx/.ts files in components/ and app/:

```bash
# Replace hardcoded indigo hex with CSS variable references
find nextjs/components nextjs/app nextjs/lib -name "*.tsx" -o -name "*.ts" | \
  xargs sed -i \
    -e 's/\[#6366f1\]/[var(--accent)]/g' \
    -e 's/#6366f1/var(--accent)/g' \
    -e 's/\[#4f46e5\]/[var(--accent-hover)]/g' \
    -e 's/#4f46e5/var(--accent-hover)/g'
```

IMPORTANT exceptions — do NOT replace in:
- `app/globals.css` (already handled in Step 1)
- Any file where `#6366f1` appears in a comment

After sed, manually check `lib/email.ts` — email templates use inline styles. These should stay as hex (email clients don't support CSS vars). Revert any changes to email.ts.

## Step 3: Fix Tailwind indigo classes in layout components

### Sidebar.tsx
Find and replace Tailwind indigo nav classes:
- Active state: `text-indigo-700 bg-indigo-50 border-indigo-500` → `text-[var(--accent)] bg-[rgba(250,204,21,0.08)] border-[var(--accent)]`
- Inactive text: keep as-is (zinc/slate text is fine)
- Background: `bg-white border-r border-slate-200` → `bg-[var(--vb-sidebar-bg)] border-r border-[var(--vb-sidebar-border)]`
- Mobile sidebar same background changes
- VGeld balance widget: `bg-slate-50 border border-slate-200` → `bg-[var(--bg-surface)] border border-[var(--border)]`

### Header.tsx
- Avatar: `bg-indigo-500` → `bg-[var(--accent)]`, `text-white` → `text-zinc-900` (yellow bg needs dark text)
- `hover:ring-indigo-400` and `focus:ring-indigo-400` → `hover:ring-[var(--accent)] focus:ring-[var(--accent)]`

### AppShell.tsx
- Footer: `border-t border-zinc-200 bg-zinc-50/60` → `border-t border-[var(--border)] bg-[var(--bg-surface)]`

## Step 4: Fix focus rings throughout
After sed replace, `focus:ring-[#6366f1]` → `focus:ring-[var(--accent)]` should be handled. Verify key forms still have visible focus states (yellow ring on dark bg is fine).

## Step 5: Fix text contrast for yellow accent
Yellow (`#FACC15`) on dark background is fine for accent text. But:
- Buttons with `bg-[var(--accent)] text-white` → change to `bg-[var(--accent)] text-zinc-900` (dark text on yellow button)
- This affects primary CTA buttons throughout. Search for patterns where text-white is paired with the accent background.

Pattern to fix:
- `bg-[var(--accent)] text-white` → `bg-[var(--accent)] text-zinc-900`
- `bg-[#6366f1] text-white` → already handled by sed, but check the text color
- After sed: `bg-[var(--accent)] text-white` patterns — run a second pass to fix text color

## Files to Change
- `nextjs/app/globals.css` — Step 1 (all token/body changes)
- All `.tsx` in `components/` and `app/` — Step 2 (sed)
- `nextjs/lib/email.ts` — REVERT after sed (email templates keep hex)
- `nextjs/components/layout/Sidebar.tsx` — Step 3
- `nextjs/components/layout/Header.tsx` — Step 3
- `nextjs/components/layout/AppShell.tsx` — Step 3

## Checklist
- [ ] `--vb-accent` updated to `#FACC15` in globals.css
- [ ] `--vb-accent-hover` updated to `#d4a800`
- [ ] All sidebar/content/card background tokens updated to dark values
- [ ] Body background uses `var(--bg-primary)`, no indigo gradient
- [ ] `@theme` border-radius override added (all → 0, except full)
- [ ] Sed replace run for `#6366f1` → `var(--accent)`
- [ ] Sed replace run for `#4f46e5` → `var(--accent-hover)`
- [ ] `lib/email.ts` reverted to original hex values after sed
- [ ] Sidebar background/border updated to dark tokens
- [ ] Sidebar nav active state updated to yellow
- [ ] Header avatar: yellow bg with dark text
- [ ] AppShell footer: dark theme tokens
- [ ] Yellow-bg buttons use `text-zinc-900` not `text-white`
- [ ] TypeScript compiles (`npx tsc --noEmit`)
