// ---------------------------------------------------------------------------
// Tour viewport and target resolution helpers
// ---------------------------------------------------------------------------
// Purpose: Centralized logic for (a) detecting desktop vs mobile viewport at
// the Tailwind `lg:` breakpoint (1024px) and (b) resolving a data-tour
// selector to the single visible element when multiple elements share the
// same data-tour value across responsive variants (e.g., sidebar-nav lives
// on the desktop <nav> AND the mobile hamburger button — only one is
// rendered/visible at a time).
//
// Rationale: Per Phase 8 D-04, step-skipping on mobile is done by the tour
// runtime, not by duplicating the steps config. This module is the runtime's
// source of truth for viewport decisions.
// ---------------------------------------------------------------------------

export const DESKTOP_MIN_WIDTH_PX = 1024;

/**
 * Returns true when the current viewport is at or above the desktop
 * breakpoint (1024px), matching the Tailwind `lg:` breakpoint used by
 * Sidebar.tsx `hidden lg:flex` / `lg:hidden` patterns.
 *
 * Safe to call in SSR — returns false when `window` is undefined.
 */
export function isDesktopViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(`(min-width: ${DESKTOP_MIN_WIDTH_PX}px)`).matches;
}

/**
 * Resolves a CSS selector to the first VISIBLE element (one whose rendered
 * bounding box has non-zero width AND height). Returns null if no element
 * matches OR no matched element is visible.
 *
 * Why "visible" rather than `document.querySelector` directly: when the
 * same `data-tour` attribute lives on both a desktop-only and a mobile-only
 * element, the CSS-hidden one still exists in the DOM with zero bounding
 * box. `document.querySelector` returns the first match in source order,
 * which may be the wrong (hidden) element. Filtering to visible elements
 * lets the same selector work on both viewports without runtime duplication.
 */
export function resolveVisibleTarget(selector: string): Element | null {
  if (typeof document === 'undefined') return null;
  const candidates = document.querySelectorAll(selector);
  for (const el of Array.from(candidates)) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return el;
    }
  }
  return null;
}
