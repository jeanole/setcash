# Frontend Implementation Plan

## Feature
BUG-14: Mobile Navigation Menu Not Working

## Context Summary
The mobile navigation is completely inaccessible. The Sidebar component uses `hidden lg:flex` making it invisible on mobile, and there's no hamburger menu button to toggle it. This is a critical bug affecting all mobile users.

## User Decisions
- **Design:** Follow existing vBudget design system (slate/indigo colors)
- **Mobile breakpoint:** lg (1024px) — matches current Tailwind classes
- **Drawer behavior:** Slide from left with backdrop overlay
- **Icons:** Use lucide-react (Menu, X icons)

## Open Bug Reports to Address
- BUG-14: Mobile Navigation Menu Not Working (this fix)

## Existing Components to Reuse
- `AppShell.tsx` — Layout wrapper (needs state management added)
- `Sidebar.tsx` — Navigation content (needs mobile drawer behavior)
- `Header.tsx` — Top bar (needs hamburger button)
- `lucide-react` — Icon library already in use

## New Components to Build
None — modifying existing components only.

## Components to Modify

### 1. Header.tsx
**Changes:**
- Add optional `onMenuToggle` prop
- Add hamburger button (visible only on mobile: `lg:hidden`)
- Use `Menu` icon from lucide-react

**Props:**
```typescript
interface HeaderProps {
  title?: string;
  onMenuToggle?: () => void;
}
```

### 2. Sidebar.tsx
**Changes:**
- Add `isMobileOpen` prop to control mobile visibility
- Add mobile drawer overlay (`fixed inset-0 z-50 lg:static lg:z-auto`)
- Add close button in mobile header (X icon)
- Clicking a link should close mobile menu
- Clicking backdrop should close mobile menu

**Props:**
```typescript
interface SidebarProps {
  currentUser?: {
    email: string;
    role: 'user' | 'admin' | 'superadmin';
  } | null;
  isMobileOpen?: boolean;
  onClose?: () => void;
}
```

### 3. AppShell.tsx
**Changes:**
- Convert to client component (`'use client'`)
- Add `isMobileMenuOpen` state
- Pass toggle handler to Header
- Pass open state and close handler to Sidebar
- Add effect to close menu on route change (optional UX improvement)

## Design Specifications

### Mobile Drawer
- Width: 280px (w-72)
- Backdrop: bg-black/50 with fade animation
- Position: fixed, left-0, top-0, full height
- Z-index: 50 (above all content)
- Animation: translate-x transition

### Hamburger Button
- Visible: only on mobile (`lg:hidden`)
- Style: ghost button (hover:bg-slate-100)
- Icon: Menu from lucide-react
- Position: left side of header

### Mobile Sidebar Header
- Logo + close button row
- Close button: X icon, right-aligned
- Border bottom to match desktop sidebar

## Accessibility
- Hamburger button has `aria-label="Open navigation menu"`
- Close button has `aria-label="Close navigation menu"`
- Backdrop has `aria-hidden="true"` when closed
- Focus trap within mobile drawer when open
- ESC key closes mobile menu

## Checklist
- [ ] Header shows hamburger button on mobile
- [ ] Clicking hamburger opens mobile drawer
- [ ] Sidebar renders correctly in mobile drawer
- [ ] Backdrop click closes drawer
- [ ] Clicking nav link closes drawer
- [ ] Close button works
- [ ] ESC key closes drawer
- [ ] Desktop layout unchanged (lg breakpoint)
- [ ] No visual regressions on desktop
