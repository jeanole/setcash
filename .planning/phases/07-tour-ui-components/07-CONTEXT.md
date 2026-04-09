# Phase 7: Tour UI Components - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Speech-bubble tooltip component, spotlight overlay with cutout, navigation controls (Next/Back/Skip/Done with step dots), and keyboard support (Escape, arrow keys, focus trap). This phase builds the visible tour UI consumed by TourProvider from Phase 6. App integration (data-tour attributes, auto-start, mobile adaptation, theming) is Phase 8.

</domain>

<decisions>
## Implementation Decisions

### Tooltip Visual Style
- **D-01:** Minimal card style — white background (dark bg in dark mode), subtle shadow (shadow-md), small directional CSS arrow pointing toward the target element. Matches the existing rounded-lg card pattern used throughout the app.
- **D-02:** Fade + scale animation on enter/exit — quick fade-in with scale from 95% to 100%, ~150ms duration. Uses CSS transitions, not a library.
- **D-03:** Tooltip rendered via React portal to document.body to avoid z-index and overflow issues with parent containers.

### Spotlight & Overlay
- **D-04:** Semi-transparent overlay (black, ~50% opacity) covers the entire viewport. The target element is highlighted with a rounded-rectangle cutout (8px border-radius, 8px padding around the target's bounding box).
- **D-05:** Overlay implemented using SVG with a mask/clipPath for the cutout — allows smooth transitions between targets and avoids box-shadow hacks.
- **D-06:** Clicking the dimmed overlay does NOT dismiss the tour. Only Skip, Done, or Escape dismiss it. Prevents accidental dismissal.
- **D-07:** Auto-scroll to target when off-screen — uses `scrollIntoView({ behavior: 'smooth', block: 'center' })` before positioning the tooltip. Brief delay after scroll to let layout settle.

### Navigation Controls
- **D-08:** Bottom bar layout inside tooltip: Skip button left-aligned, dot step indicator centered, Back and Next/Done buttons right-aligned. Separated from body content by a subtle border.
- **D-09:** Step indicator uses filled/empty dots (6 dots for 6 steps). Current step dot is filled, others are empty. Compact and standard tour pattern.
- **D-10:** Conditional button display: no Back on step 1, Done replaces Next on last step. Skip available on all steps.
- **D-11:** Button styling follows existing app patterns — text buttons for Skip (muted), solid button for Next/Done (primary color), outline button for Back.

### Keyboard & Accessibility
- **D-12:** Focus trapped inside the tooltip while tour is active. Tab cycles through tooltip buttons only. Uses a focus-trap approach (intercept Tab/Shift+Tab keydown events).
- **D-13:** Escape key dismisses the tour (calls `skip()`). Left arrow = Back, Right arrow = Next. Arrow keys only active when tooltip has focus.
- **D-14:** ARIA roles: tooltip container has `role="dialog"` and `aria-modal="true"`. Live region announces step changes for screen readers. Target element gets `aria-describedby` pointing to tooltip.

### Claude's Discretion
- Exact tooltip max-width and padding values
- SVG overlay implementation details (mask vs clipPath approach)
- Focus trap implementation (custom hook vs inline keydown handler)
- Transition timing between steps (cutout morph vs instant reposition)
- Z-index values for overlay and tooltip layers

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 6 Infrastructure (consumed by this phase)
- `nextjs/components/providers/TourProvider.tsx` — Context provider with useTour() hook (isActive, currentStep, next, back, skip, complete)
- `nextjs/lib/tour/steps.ts` — TOUR_STEPS array with 6 entries (targetSelector, title, body, placement)

### Existing UI Patterns
- `nextjs/components/ui/ConfirmationDialog.tsx` — Escape key handler pattern, overlay pattern
- `nextjs/app/globals.css` — CSS custom properties with --vb- prefix for design tokens

### Requirements
- `.planning/REQUIREMENTS.md` — UI-01 through UI-04

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ConfirmationDialog.tsx`: Escape key handler pattern via useEffect + keydown listener
- `cn()` utility from `@/lib/utils`: Conditional class merging for all components
- `lucide-react`: Icon library already installed — use for arrow/close icons if needed
- Existing modal pattern: `fixed inset-0` overlay with z-index stacking

### Established Patterns
- `'use client'` directive for all interactive components
- Default exports for components
- Props destructured in function signature
- Tailwind utility classes for all styling (no CSS modules)
- `--vb-` CSS custom properties for design tokens in globals.css

### Integration Points
- `useTour()` hook from TourProvider — primary interface for tour state and navigation
- `TOUR_STEPS` import from `@/lib/tour/steps` — step content and target selectors
- React portal to document.body — tooltip and overlay render outside component tree
- `useEffect` for keydown event listeners (Escape, arrow keys)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-tour-ui-components*
*Context gathered: 2026-04-09*
