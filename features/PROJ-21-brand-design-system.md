# PROJ-21: Brand & Design System

**Status:** Planned
**Created:** 2026-03-15
**Priority:** Medium

## Dependencies
- Requires: PROJ-4 (Next.js scaffold — base CSS/theming infrastructure)
- Requires: PROJ-18 (Atelier UI — existing visual baseline)

## Overview

SetCash brand identity and design token system. Defines the logo mark, typography scale, color tokens, and CSS custom properties used throughout the application.

## User Stories
- As a developer, I want a single source-of-truth CSS token file so that all UI components use consistent colors and typography.
- As a designer, I want the logo to render correctly at all sizes (primary, compact, favicon) so that the brand is recognizable across contexts.
- As a user, I want the app to support both dark and light themes so that I can use it comfortably in any environment.

## Acceptance Criteria

### Logo
- [ ] Accent bar logotype: solid vertical rectangle left of wordmark
- [ ] Wordmark: "SET" + "CASH" uppercase, no space between words
- [ ] "SET" in `--text-primary`, "CASH" in `--accent`
- [ ] Optional tagline: "EXPENSE TRACKING FOR TEAMS" below wordmark
- [ ] All four size variants implemented: Primary, Compact/Header, Favicon 48px, 32px, 16px

### Typography
- [ ] Display font: Space Grotesk, weight 700, uppercase for wordmark
- [ ] Mono font: JetBrains Mono, weight 500/600, uppercase for UI labels and tagline
- [ ] Letter-spacing: 3px tagline, 2px section labels

### Color Tokens — Dark Mode (`data-theme="dark"`)
- [ ] `--bg-primary: #0F0F10`
- [ ] `--bg-surface: #18181B`
- [ ] `--accent: #FACC15`
- [ ] `--text-primary: #FAFAFA`
- [ ] `--text-secondary: #A1A1AA`
- [ ] `--text-tertiary: #71717A`
- [ ] `--text-muted: #52525B`
- [ ] `--border: #27272A`

### Color Tokens — Light Mode (`data-theme="light"`)
- [ ] `--bg-primary: #FFFFFF`
- [ ] `--bg-surface: #FAFAFA`
- [ ] `--accent: #FACC15`
- [ ] `--text-primary: #0D0D0D`
- [ ] `--text-secondary: #7A7A7A`
- [ ] `--text-tertiary: #7A7A7A`
- [ ] `--text-muted: #B0B0B0`
- [ ] `--border: #E8E8E8`

### Monochrome Variant
- [ ] Dark: bar + all text `#FAFAFA`, "CASH" in `#A1A1AA`
- [ ] Light: bar + all text `#0D0D0D`, "CASH" in `#7A7A7A`

### Design Principles Enforced
- [ ] Zero corner radius (`--radius: 0px`) on all UI elements
- [ ] Single accent color (`#FACC15`) for all interactive/emphasis elements
- [ ] No shadows or gradients — structure through borders only
- [ ] Uppercase labels with wide letter-spacing (1–3px)

### CSS Custom Properties
- [ ] `:root` declares `--font-display`, `--font-mono`, `--accent`, `--radius`
- [ ] `[data-theme="dark"]` block complete
- [ ] `[data-theme="light"]` block complete
- [ ] Fonts loaded via Google Fonts or self-hosted

## Logo Size Specifications

| Variant | Font Size | Bar Width | Bar Height |
|---------|-----------|-----------|------------|
| Primary | 48px | 6px | 52px |
| Compact/Header | 26px | 4px | 28px |
| Favicon 48px | — | 5px | 30px |
| Favicon 32px | — | 4px | 20px |
| Favicon 16px | — | 3px | 12px |

## CSS Custom Properties (Reference)

```css
:root {
  --font-display: 'Space Grotesk', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  --accent: #FACC15;
  --radius: 0px;
}

[data-theme="dark"] {
  --bg-primary: #0F0F10;
  --bg-surface: #18181B;
  --text-primary: #FAFAFA;
  --text-secondary: #A1A1AA;
  --text-tertiary: #71717A;
  --text-muted: #52525B;
  --border: #27272A;
}

[data-theme="light"] {
  --bg-primary: #FFFFFF;
  --bg-surface: #FAFAFA;
  --text-primary: #0D0D0D;
  --text-secondary: #7A7A7A;
  --text-tertiary: #7A7A7A;
  --text-muted: #B0B0B0;
  --border: #E8E8E8;
}
```

## Change Requests

### CR-26: SetCash Brand & Logo Style Specification
**Requested:** 2026-03-15 | **Priority:** Medium | **Status:** Pending Review

**Current Behavior:** No formal brand system exists. App uses ad-hoc Tailwind classes with indigo (`#6366f1`) as accent; no defined logo mark, no typography scale, no CSS token layer.

**Desired Behavior:** A complete brand and design token system as specified above — accent bar logotype, Space Grotesk + JetBrains Mono typography, yellow (`#FACC15`) accent, sharp/industrial aesthetic with zero radius, full dark/light token set.

**Rationale:** Establishes visual identity for SetCash and provides a single source of truth for all UI decisions going forward.

**Proposed Acceptance Criteria:**
- [ ] Logo renders correctly in all size variants
- [ ] CSS token file applies across all pages in dark and light mode
- [ ] Typography fonts loaded and applied
- [ ] No Tailwind color overrides conflict with new token layer

**Resolution:** Pending
