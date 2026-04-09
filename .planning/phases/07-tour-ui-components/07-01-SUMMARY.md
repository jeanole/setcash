---
phase: 07-tour-ui-components
plan: 01
subsystem: tour-ui
tags: [tour, overlay, svg, spotlight, ui-component]
dependency_graph:
  requires: []
  provides: [TourOverlay-component]
  affects: [tour-controller, tour-tooltip]
tech_stack:
  added: []
  patterns: [svg-mask-spotlight, react-portal, css-transition-svg]
key_files:
  created:
    - nextjs/components/tour/TourOverlay.tsx
  modified: []
decisions:
  - Used SVG mask technique (white+black rects) for cross-browser spotlight cutout
  - CSS transition on SVG rect style properties for smooth cutout repositioning
  - pointer-events on overlay rect blocks clicks without dismiss behavior
metrics:
  duration: 550s
  completed: 2026-04-09
  tasks: 1
  files: 1
---

# Phase 7 Plan 01: TourOverlay SVG Mask Component Summary

SVG mask overlay component rendering via React portal with spotlight cutout that highlights tour target elements, using 50% opacity backdrop and 200ms animated transitions.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create TourOverlay SVG mask component | f1b87c4 | nextjs/components/tour/TourOverlay.tsx |

## Implementation Details

### TourOverlay Component

Created `nextjs/components/tour/TourOverlay.tsx` as a client component that:

- Renders a full-viewport SVG overlay via `createPortal` to `document.body`
- Uses SVG `<mask>` with white rect (full viewport, opaque) and black rect (cutout, transparent) to create the spotlight effect
- Cutout has 8px padding around the target bounding box and 8px border-radius (`rx`/`ry`)
- Overlay fill is `rgba(0, 0, 0, 0.5)` for 50% opacity dimming
- Z-index 100 positions it above content but below tooltip (101) and super-admin modals (200)
- `pointerEvents: 'all'` on the overlay rect blocks clicks on dimmed areas
- No onClick handler to dismiss the tour (per design spec D-06)
- CSS transitions on cutout x/y/width/height (200ms ease) for smooth step-to-step animation
- `mounted` state guard prevents SSR portal issues
- Accepts `targetRect: DOMRect | null` -- when null, shows full overlay without cutout

## Deviations from Plan

None -- plan executed exactly as written.

## Verification

- TypeScript compilation: No errors from TourOverlay.tsx (pre-existing errors in other files unrelated to this component)
- All 13 acceptance criteria verified programmatically
- File contains required patterns: createPortal, SVG mask, pointer-events, z-index 100, padding 8, border-radius 8
- File does NOT contain prohibited patterns: no onClick dismiss handler

## Self-Check: PASSED
