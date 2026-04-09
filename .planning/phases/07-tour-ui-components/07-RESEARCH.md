# Phase 7: Tour UI Components - Research

**Researched:** 2026-04-09
**Domain:** React component development (tooltip, overlay, focus trap, keyboard navigation)
**Confidence:** HIGH

## Summary

Phase 7 builds three visual components consumed by TourProvider (Phase 6): a speech-bubble tooltip with directional arrow, a spotlight overlay with SVG cutout, and a navigation bar with conditional controls. All decisions are locked in CONTEXT.md -- the implementation is straightforward React component work using only existing project dependencies (React, Tailwind CSS, lucide-react). No new libraries are needed.

The main technical challenges are: (1) computing tooltip placement relative to target elements across 4 positions (top/bottom/left/right) with resize handling, (2) SVG mask-based spotlight cutout with smooth repositioning, and (3) correct focus trapping within the tooltip. All three are well-understood patterns with no external dependencies required.

**Primary recommendation:** Build three components (`TourTooltip`, `TourOverlay`, `TourController`) in `nextjs/components/tour/` using only React, Tailwind, and existing project utilities. No new npm packages needed.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Minimal card style -- white bg (dark bg in dark mode), subtle shadow (shadow-md), small directional CSS arrow pointing toward target element. Matches existing rounded-lg card pattern.
- D-02: Fade + scale animation on enter/exit -- quick fade-in with scale from 95% to 100%, ~150ms duration. Uses CSS transitions, not a library.
- D-03: Tooltip rendered via React portal to document.body to avoid z-index and overflow issues.
- D-04: Semi-transparent overlay (black, ~50% opacity) covers viewport. Target highlighted with rounded-rectangle cutout (8px border-radius, 8px padding around target bounding box).
- D-05: Overlay implemented using SVG with mask/clipPath for the cutout.
- D-06: Clicking dimmed overlay does NOT dismiss the tour. Only Skip, Done, or Escape dismiss it.
- D-07: Auto-scroll to target when off-screen using scrollIntoView({ behavior: 'smooth', block: 'center' }). Brief delay after scroll to let layout settle.
- D-08: Bottom bar layout inside tooltip: Skip left-aligned, dot step indicator centered, Back and Next/Done right-aligned. Separated from body content by subtle border.
- D-09: Step indicator uses filled/empty dots (6 dots for 6 steps). Current step filled, others empty.
- D-10: Conditional button display: no Back on step 1, Done replaces Next on last step. Skip available on all steps.
- D-11: Button styling follows existing app patterns -- text buttons for Skip (muted), solid for Next/Done (primary), outline for Back.
- D-12: Focus trapped inside tooltip while tour is active. Tab cycles through tooltip buttons only.
- D-13: Escape key dismisses tour (calls skip()). Left arrow = Back, Right arrow = Next. Arrow keys only active when tooltip has focus.
- D-14: ARIA roles: tooltip container has role="dialog" and aria-modal="true". Live region announces step changes. Target element gets aria-describedby pointing to tooltip.

### Claude's Discretion
- Exact tooltip max-width and padding values
- SVG overlay implementation details (mask vs clipPath approach)
- Focus trap implementation (custom hook vs inline keydown handler)
- Transition timing between steps (cutout morph vs instant reposition)
- Z-index values for overlay and tooltip layers

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-01 | User sees a speech-bubble tooltip with arrow positioned next to the target element | D-01, D-02, D-03; tooltip positioning logic, CSS arrow technique, portal rendering |
| UI-02 | User sees the target element highlighted with a spotlight overlay dimming the background | D-04, D-05, D-06; SVG mask overlay pattern, getBoundingClientRect for cutout |
| UI-03 | User can navigate the tour with Next, Back, Skip, and Done controls | D-08, D-09, D-10, D-11; navigation bar component with conditional rendering |
| UI-04 | User can navigate and dismiss the tour using keyboard (Esc, arrow keys) | D-12, D-13, D-14; focus trap pattern, keydown event handling, ARIA attributes |
</phase_requirements>

## Standard Stack

### Core
No new packages required. This phase uses only existing project dependencies.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.3.1 | Components, hooks, portals | Already installed [VERIFIED: project package.json] |
| react-dom | 18.3.1 | createPortal for tooltip rendering | Already installed, portal pattern exists in ImpressumModal.tsx [VERIFIED: codebase grep] |
| Tailwind CSS | v4 | All styling (utility classes) | Already installed [VERIFIED: project config] |
| lucide-react | 0.477.0 | Icons (ChevronLeft, ChevronRight, X if needed) | Already installed [VERIFIED: project package.json] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom tooltip | react-joyride / shepherd.js | Unnecessary dependency -- 6-step tour is simple enough to hand-roll; decisions require custom SVG overlay that libraries may not support cleanly |
| Custom focus trap | focus-trap-react | Adding a dependency for a single useEffect handler is overkill; the ConfirmationDialog already uses inline keydown handling |
| Framer Motion | CSS transitions | D-02 explicitly says "CSS transitions, not a library" |

**Installation:** No new packages to install.

## Architecture Patterns

### Recommended Project Structure
```
nextjs/components/tour/
  TourOverlay.tsx      # SVG overlay with spotlight cutout (D-04, D-05, D-06)
  TourTooltip.tsx      # Speech-bubble tooltip with arrow and content (D-01, D-02, D-03)
  TourController.tsx   # Orchestrator: reads useTour(), renders overlay + tooltip (D-07)
  index.ts             # Barrel export
```

### Pattern 1: Tooltip Positioning with getBoundingClientRect
**What:** Compute tooltip position relative to target element using getBoundingClientRect, respecting the `placement` property from TOUR_STEPS.
**When to use:** Every step change and window resize.
**Example:**
```typescript
// [VERIFIED: codebase] TourStep.placement is 'top' | 'bottom' | 'left' | 'right'
function computePosition(
  targetRect: DOMRect,
  tooltipRect: DOMRect,
  placement: TourStep['placement'],
  gap: number = 12
): { top: number; left: number } {
  switch (placement) {
    case 'bottom':
      return {
        top: targetRect.bottom + gap,
        left: targetRect.left + targetRect.width / 2 - tooltipRect.width / 2,
      };
    case 'top':
      return {
        top: targetRect.top - tooltipRect.height - gap,
        left: targetRect.left + targetRect.width / 2 - tooltipRect.width / 2,
      };
    case 'left':
      return {
        top: targetRect.top + targetRect.height / 2 - tooltipRect.height / 2,
        left: targetRect.left - tooltipRect.width - gap,
      };
    case 'right':
      return {
        top: targetRect.top + targetRect.height / 2 - tooltipRect.height / 2,
        left: targetRect.right + gap,
      };
  }
}
```

### Pattern 2: SVG Mask Overlay for Spotlight Cutout
**What:** Full-viewport SVG with a `<mask>` element. White rectangle covers viewport (opaque), black rounded-rect creates the transparent cutout over target. [ASSUMED]
**When to use:** Rendering the dimmed overlay with target highlight (D-04, D-05).
**Example:**
```typescript
// SVG mask approach -- white = visible overlay, black = transparent cutout
<svg className="fixed inset-0 w-full h-full" style={{ zIndex: Z_OVERLAY }}>
  <defs>
    <mask id="tour-spotlight">
      <rect x="0" y="0" width="100%" height="100%" fill="white" />
      <rect
        x={cutout.x}
        y={cutout.y}
        width={cutout.width}
        height={cutout.height}
        rx="8"
        ry="8"
        fill="black"
      />
    </mask>
  </defs>
  <rect
    x="0"
    y="0"
    width="100%"
    height="100%"
    fill="rgba(0, 0, 0, 0.5)"
    mask="url(#tour-spotlight)"
  />
</svg>
```

### Pattern 3: CSS Arrow for Tooltip
**What:** Pseudo-element or dedicated div creating a triangular arrow pointing toward the target. Uses CSS border trick or `clip-path`. [ASSUMED]
**When to use:** D-01 requires a directional CSS arrow.
**Example:**
```typescript
// CSS arrow using Tailwind arbitrary values -- arrow for "bottom" placement points up
// Arrow element positioned above tooltip body
<div
  className="absolute w-3 h-3 bg-white rotate-45 -translate-y-1.5"
  style={{
    left: `${arrowLeft}px`,
    top: 0,
    // For dark mode: bg color follows tooltip bg
  }}
/>
```

### Pattern 4: Focus Trap via Keydown Intercept
**What:** useEffect keydown handler that intercepts Tab/Shift+Tab and cycles focus among tooltip-internal focusable elements. Matches the ConfirmationDialog pattern but extended. [VERIFIED: ConfirmationDialog.tsx uses same approach]
**When to use:** D-12 requires focus trapped within tooltip.
**Example:**
```typescript
useEffect(() => {
  if (!isActive) return;
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { skip(); return; }
    if (e.key === 'ArrowRight') { next(); return; }
    if (e.key === 'ArrowLeft') { back(); return; }
    if (e.key === 'Tab') {
      // Get all focusable elements within tooltip ref
      const focusable = tooltipRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [isActive, skip, next, back]);
```

### Anti-Patterns to Avoid
- **Using CSS box-shadow for spotlight:** Box-shadow hacks create jagged edges and cannot animate between positions smoothly. Use SVG mask per D-05.
- **Absolute positioning within parent instead of portal:** Tooltip will be clipped by overflow:hidden ancestors. D-03 requires portal to document.body.
- **Attaching resize listener without cleanup:** Memory leak. Always return cleanup function from useEffect.
- **Using setTimeout without ref-guarding:** If component unmounts during the scroll delay (D-07), setState will warn. Use a ref flag or AbortController pattern.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| N/A | N/A | N/A | This phase IS about building custom UI components -- no off-the-shelf alternatives match the locked decisions |

**Key insight:** The decisions lock in a custom implementation. Libraries like react-joyride would fight the specific SVG mask, CSS arrow, and styling requirements. Building from scratch is the correct approach for 3 components totaling ~300-400 lines.

## Common Pitfalls

### Pitfall 1: Tooltip Positioned Off-Screen
**What goes wrong:** Tooltip computed to appear at negative coordinates or beyond viewport edge (e.g., "right" placement when target is near right edge).
**Why it happens:** No viewport boundary clamping in position calculation.
**How to avoid:** After computing position, clamp to viewport bounds with padding (e.g., 16px margin from edges). Flip placement if tooltip would overflow.
**Warning signs:** Tooltip partially hidden or causing horizontal scrollbar.

### Pitfall 2: Stale Target Rect After Scroll
**What goes wrong:** Tooltip and cutout positioned at pre-scroll coordinates after scrollIntoView (D-07).
**Why it happens:** scrollIntoView is async; getBoundingClientRect called before scroll completes.
**How to avoid:** Add a ~300ms delay after scrollIntoView before reading getBoundingClientRect. Use requestAnimationFrame or setTimeout.
**Warning signs:** Tooltip appears briefly in wrong position then jumps.

### Pitfall 3: SVG Mask Not Covering Full Viewport on Scroll
**What goes wrong:** SVG overlay only covers initial viewport, scrolled content visible below.
**Why it happens:** SVG dimensions set to 100vw/100vh but page is taller than viewport.
**How to avoid:** Use `position: fixed` with `inset: 0` so the SVG always covers the visible viewport regardless of scroll position. Do NOT use `width: 100%; height: 100%` on a non-fixed element.
**Warning signs:** Dimmed overlay has gaps when page is scrolled.

### Pitfall 4: Focus Not Moving to Tooltip on Step Change
**What goes wrong:** After advancing steps, keyboard focus stays on previously-focused element outside tooltip.
**Why it happens:** Focus not explicitly moved to tooltip container after render.
**How to avoid:** After tooltip renders/repositions, call `tooltipRef.current?.focus()` or focus the first button. Use autoFocus or useEffect with dependency on currentStep.
**Warning signs:** User presses Tab but focus cycles through page elements instead of tooltip buttons.

### Pitfall 5: Target Element Not Found
**What goes wrong:** querySelector returns null for a step's targetSelector.
**Why it happens:** data-tour attributes not yet added (Phase 8 work), or element is conditionally rendered.
**How to avoid:** Gracefully handle null target -- skip to next step, or show tooltip centered on screen without spotlight. Log a warning. Phase 8 adds data-tour attributes; during Phase 7 testing, add temporary test attributes.
**Warning signs:** TypeError on null.getBoundingClientRect().

### Pitfall 6: Z-Index Stacking Conflicts
**What goes wrong:** Overlay renders behind existing modals or header.
**Why it happens:** Existing z-index values in the app: z-[70] (ConfirmationDialog), z-[200] (SuperAdminModal), z-[300] (sub-modals), z-[400] (toast).
**How to avoid:** Use z-index values that sit above standard content but below super-admin modals: z-[100] for overlay, z-[101] for tooltip. Tour should not be active simultaneously with super-admin modals.
**Warning signs:** Tour overlay partially obscured by header or sidebar.

## Code Examples

### Existing Portal Pattern (from ImpressumModal.tsx)
```typescript
// [VERIFIED: nextjs/components/ImpressumModal.tsx]
import { createPortal } from 'react-dom';
// ...
return createPortal(
  <div className="fixed inset-0 z-[70] ...">
    {/* content */}
  </div>,
  document.body
);
```

### Existing Animation Keyframes (from globals.css)
```css
/* [VERIFIED: nextjs/app/globals.css lines 226-235] */
@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
/* Usage: animate-[scaleIn_0.15s_ease-out] */
```

### Existing Design Tokens (from globals.css)
```css
/* [VERIFIED: nextjs/app/globals.css] */
--vb-card-bg: #FFFFFF;
--vb-card-border: rgba(15,23,42,0.18);
--vb-text-primary: #1e293b;
--vb-text-secondary: #64748b;
--vb-text-muted: #94a3b8;
--vb-accent: #FACC15;
--vb-accent-hover: #EAB308;
--vb-shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.06), 0 1px 1px rgba(15, 23, 42, 0.04);

/* Dark mode uses two-layer tokens: */
[data-theme="dark"] {
  --bg-surface: #18181B;
  --text-primary: #FAFAFA;
  --text-secondary: #A1A1AA;
  --border: #27272A;
}
```

### Existing Escape Key Pattern (from ConfirmationDialog.tsx)
```typescript
// [VERIFIED: nextjs/components/ui/ConfirmationDialog.tsx lines 29-38]
useEffect(() => {
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && isOpen) {
      onCancel();
    }
  };
  window.addEventListener('keydown', handleEscape);
  return () => window.removeEventListener('keydown', handleEscape);
}, [isOpen, onCancel]);
```

### TourProvider Interface (consumed by this phase)
```typescript
// [VERIFIED: nextjs/components/providers/TourProvider.tsx]
interface TourContextValue {
  isActive: boolean;
  currentStep: number;
  stepCount: number;
  next: () => void;
  back: () => void;
  skip: () => void;
  complete: () => void;
}
// Hook: const { isActive, currentStep, stepCount, next, back, skip, complete } = useTour();
```

### TourStep Shape (consumed by this phase)
```typescript
// [VERIFIED: nextjs/lib/tour/steps.ts]
export interface TourStep {
  id: string;
  targetSelector: string;
  title: string;
  body: string;
  placement: 'top' | 'bottom' | 'left' | 'right';
}
// 6 steps defined: sidebar-nav, submit-bill, bill-list, budget-matrix, project-switcher, user-menu
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-joyride for tours | Custom components for simple tours | Ongoing trend | Fewer dependencies, full control over UX |
| CSS box-shadow spotlight | SVG mask spotlight | Widely adopted ~2020+ | Smooth cutout transitions, proper rounded corners |
| focus-trap library | Manual keydown intercept for small dialogs | Always valid for simple cases | Zero-dependency focus trapping |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | SVG mask approach (white rect + black cutout) works cross-browser for spotlight | Architecture Pattern 2 | LOW -- SVG masks are supported in all modern browsers; fallback is full overlay without cutout |
| A2 | CSS border-trick or rotate-45 approach for tooltip arrow works well with Tailwind | Architecture Pattern 3 | LOW -- standard CSS technique, trivial to adjust |
| A3 | 300ms delay after scrollIntoView is sufficient for layout to settle | Pitfall 2 | LOW -- can be tuned; requestAnimationFrame may be more reliable |

## Open Questions

1. **Dark mode tooltip background color**
   - What we know: Light mode uses `--vb-card-bg: #FFFFFF`. Dark mode has `--bg-surface: #18181B`.
   - What's unclear: Whether tooltip should use `--vb-card-bg` (which may not have a dark variant) or `--bg-surface`.
   - Recommendation: Use `bg-[var(--vb-card-bg)]` for light mode and add a `dark:bg-[var(--bg-surface)]` or use `[data-theme="dark"]` selector. This is Claude's discretion per CONTEXT.md -- resolve at implementation time by checking which token the app's existing cards use.

2. **Testing approach for UI components**
   - What we know: Jest is configured for node environment with real DB integration tests. No component test setup (no jsdom, no React Testing Library).
   - What's unclear: Whether UI-focused tests should be added for this phase.
   - Recommendation: Skip automated component tests for Phase 7. The existing test infrastructure is API/integration focused. Manual browser testing is more appropriate for visual tooltip positioning. Note this in Validation Architecture.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.7 + ts-jest (node environment) |
| Config file | `nextjs/jest.config.js` |
| Quick run command | `cd nextjs && npx jest --testPathPattern tour -x` |
| Full suite command | `cd nextjs && npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-01 | Tooltip with arrow positioned next to target | manual-only | N/A -- visual positioning requires browser | N/A |
| UI-02 | Spotlight overlay with cutout highlighting target | manual-only | N/A -- SVG rendering requires browser | N/A |
| UI-03 | Navigation controls (Next/Back/Skip/Done) | unit (logic only) | `cd nextjs && npx jest --testPathPattern tour -x` | No -- Wave 0 |
| UI-04 | Keyboard navigation (Esc, arrow keys, focus trap) | unit (logic only) | `cd nextjs && npx jest --testPathPattern tour -x` | No -- Wave 0 |

**Note:** The existing Jest setup uses `testEnvironment: 'node'` which cannot render React components or test DOM interactions. UI-01 and UI-02 are inherently visual and require manual browser testing. UI-03 and UI-04 can have their logic tested (conditional button rendering rules, key mappings) but not their DOM behavior without adding jsdom + React Testing Library. Given project conventions (integration tests with real DB, not component tests), manual verification is the primary validation method.

### Sampling Rate
- **Per task commit:** Manual browser check -- tooltip positions correctly, overlay renders, navigation works
- **Per wave merge:** Full manual walkthrough of all 6 tour steps
- **Phase gate:** All 4 requirements verified manually in browser before /gsd-verify-work

### Wave 0 Gaps
- None required -- existing test infrastructure does not support component tests, and adding jsdom/RTL is out of scope for this phase. Planner should include manual verification steps in each task.

## Security Domain

This phase creates client-side UI components only. No API endpoints, no user input processing, no data persistence, no authentication changes.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A |
| V3 Session Management | no | N/A |
| V4 Access Control | no | N/A |
| V5 Input Validation | no | No user input -- tooltip content is hardcoded in TOUR_STEPS |
| V6 Cryptography | no | N/A |

No security concerns for this phase. All content is static, read from a constant array. No XSS vectors (no user-supplied HTML rendered in tooltips).

## Sources

### Primary (HIGH confidence)
- Codebase inspection -- TourProvider.tsx, steps.ts, ConfirmationDialog.tsx, globals.css, ImpressumModal.tsx
- Codebase grep -- z-index values, design tokens, animation keyframes, portal usage

### Secondary (MEDIUM confidence)
- None needed -- all implementation details derived from existing codebase patterns and locked decisions

### Tertiary (LOW confidence)
- SVG mask overlay pattern -- common technique, not verified against specific browser compatibility table [ASSUMED]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new packages, all existing dependencies verified in codebase
- Architecture: HIGH -- component structure follows existing patterns (portal, keydown, Tailwind)
- Pitfalls: HIGH -- based on direct codebase inspection (z-index values, scroll behavior, null targets)

**Research date:** 2026-04-09
**Valid until:** 2026-05-09 (stable -- no external dependencies to go stale)
