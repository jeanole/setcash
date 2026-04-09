# Phase 7: Tour UI Components - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-09
**Phase:** 07-tour-ui-components
**Areas discussed:** Tooltip visual style, Spotlight & overlay, Navigation controls, Keyboard & accessibility

---

## Tooltip Visual Style

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal card | White/dark bg, subtle shadow, small directional arrow. Matches existing card patterns. | ✓ |
| Branded bubble | Uses --vb- brand colors for bg/border. Bolder presence, more playful. | |
| Glass/blur effect | Translucent background with backdrop-blur. Modern feel. | |

**User's choice:** Minimal card
**Notes:** Clean and consistent with existing app design.

### Animation

| Option | Description | Selected |
|--------|-------------|----------|
| Fade + scale | Quick fade-in with scale from 95% to 100%, ~150ms. | ✓ |
| Slide from target | Tooltip slides in from direction of target element. | |
| No animation | Instant show/hide. | |

**User's choice:** Fade + scale

---

## Spotlight & Overlay

### Cutout Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Rounded rectangle | 8px border-radius cutout with 8px padding. Matches app corners. | ✓ |
| Circle/ellipse | Circular cutout centered on target. | |
| Exact element shape | Tight fit to target bounding box. | |

**User's choice:** Rounded rectangle

### Off-Screen Target

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-scroll to target | Smooth scroll to bring target into view. | ✓ |
| Skip the step | Skip to next if target not visible. | |
| Show without spotlight | Centered tooltip, no spotlight. | |

**User's choice:** Auto-scroll to target

### Overlay Click

| Option | Description | Selected |
|--------|-------------|----------|
| No dismiss on click | Only Skip/Done/Escape dismiss. Per success criteria. | ✓ |
| Dismiss on overlay click | Clicking outside closes tour. | |

**User's choice:** No dismiss on click

---

## Navigation Controls

### Button Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Bottom bar | Footer row: Skip left, dots center, Back/Next right. | ✓ |
| Inline after body | Buttons flow after body text. | |
| Top-right close + bottom nav | X button top-right, Back/Next at bottom. | |

**User's choice:** Bottom bar

### Step Indicator

| Option | Description | Selected |
|--------|-------------|----------|
| Dots | 6 small dots, current one filled. | ✓ |
| Text counter | "2 of 6" text. | |
| Progress bar | Thin bar showing completion. | |

**User's choice:** Dots

---

## Keyboard & Accessibility

### Focus Management

| Option | Description | Selected |
|--------|-------------|----------|
| Trap focus in tooltip | Tab cycles through tooltip buttons only. | ✓ |
| Focus tooltip but allow escape | Focus starts in tooltip, Tab can leave. | |
| No focus management | Browser handles focus naturally. | |

**User's choice:** Trap focus in tooltip

### Arrow Key Navigation

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, left/right arrows | Left = Back, Right = Next. Per success criteria. | ✓ |
| No arrow key navigation | Only button clicks and Escape. | |

**User's choice:** Yes, left/right arrows

---

## Claude's Discretion

- Exact tooltip max-width and padding values
- SVG overlay implementation details
- Focus trap implementation approach
- Transition timing between steps
- Z-index values for overlay and tooltip layers

## Deferred Ideas

None — discussion stayed within phase scope
