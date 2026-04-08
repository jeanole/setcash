# Stack Research: Onboarding Tour Tooltips

**Domain:** Guided onboarding tour with speech-bubble tooltips for Next.js 14 / React 18 / Tailwind CSS v4
**Researched:** 2026-04-08
**Confidence:** HIGH

---

## Recommendation: react-joyride v3

Use **react-joyride 3.0.2** -- the most mature, best-maintained, React-native tour library with the largest community. It is the right choice for this project.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `react-joyride` | 3.0.2 | Tour engine: step management, spotlight overlay, tooltip positioning, progression controls | React-first library with 635K+ weekly npm downloads. V3 is a complete rewrite: uses `@floating-ui/react-dom` for positioning (replaces Popper.js), SVG overlay for spotlight, portal rendering, ~30% smaller bundle than v2. Supports React 16.8 through 19. Has both a component API and a `useJoyride()` hook API. SSR-safe (works with Next.js App Router). MIT licensed. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@floating-ui/react-dom` | (transitive) | Tooltip positioning engine | Bundled as a dependency of react-joyride v3. Do NOT install separately -- react-joyride manages it. Listed here for awareness only. |

### Development Tools

No additional dev tools required for this feature. Existing Jest + ts-jest setup is sufficient for testing tour state logic.

---

## Installation

```bash
cd nextjs

# Single dependency -- everything else is transitive
npm install react-joyride
```

That is it. No other packages needed.

---

## Why react-joyride v3 Over Alternatives

### Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| react-joyride 3.0.2 | NextStepJS 2.2.0 | If you need multi-page tours with automatic route navigation AND are willing to add `motion` (Framer Motion) as a dependency. NextStepJS is Next.js-native but has only ~24K weekly downloads (vs 635K for joyride), meaning smaller community and higher risk of abandonment. |
| react-joyride 3.0.2 | Custom implementation with `@floating-ui/react-dom` | If you need fewer than 3 tooltip steps and want zero library overhead. For 6 steps with spotlight overlay, back/next/skip controls, and scroll-into-view behavior, you would be reimplementing what react-joyride already does. |
| react-joyride 3.0.2 | Shepherd.js / react-shepherd 7.0.4 | Never for this project. Shepherd.js is dual-licensed AGPL-3.0 + Commercial. AGPL is a copyleft license that requires distributing your source code if you serve the app over a network. Unacceptable for a commercial SaaS product. |
| react-joyride 3.0.2 | Intro.js | Never for this project. Intro.js is AGPL-licensed with a paid commercial license ($9.99-$299). Unnecessary cost when react-joyride is MIT and feature-superior for React apps. |
| react-joyride 3.0.2 | Reactour | Stale. Reactour's last meaningful update was 2023. react-joyride v3 was rewritten in 2026 and is actively maintained. |

### Detailed Reasoning

**react-joyride v3 wins because:**

1. **MIT license** -- no copyleft risk, no paid tiers.
2. **React-native API** -- `useJoyride()` hook returns `controls` (next, prev, skip, close), `state` (current step index, running status), and a `<Tour>` component. This maps directly to the "Next/Back/Skip/Done" controls in the requirements.
3. **Target flexibility** -- v3 accepts CSS selectors, `RefObject<HTMLElement>`, or `() => HTMLElement | null`. Since this app uses client components with hooks, ref-based targeting is cleaner than brittle CSS selectors.
4. **Spotlight overlay** -- v3 uses SVG overlay (not CSS box-shadow hack), providing precise cutouts around target elements. This is the "speech-bubble" visual the requirements describe.
5. **Scroll-into-view** -- built-in smooth scrolling to bring the target element into viewport before showing the tooltip.
6. **Controlled mode** -- `run` prop controls when the tour starts/stops. Perfect for the "trigger on first login / every login for demo users" requirement.
7. **Callback system** -- `onEvents` subscription in v3 fires on step changes, tour completion, and user actions. Use this to persist the `hasSeenTour` flag when the user completes or skips.
8. **No animation library dependency** -- unlike NextStepJS which requires `motion` (Framer Motion, ~15-30KB gzipped), react-joyride uses CSS transitions only.
9. **Bundle size** -- v3 is ~30% smaller than v2 (v2 was ~30KB gzipped; v3 is estimated ~20-22KB gzipped including @floating-ui/react-dom transitive dep).

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Shepherd.js / react-shepherd | AGPL-3.0 license -- copyleft requirement is incompatible with commercial SaaS. Would require either open-sourcing the entire app or purchasing a commercial license. | react-joyride (MIT) |
| Intro.js / intro.js-react | AGPL-licensed with paid commercial tiers. Adds licensing cost and complexity for no technical benefit over react-joyride. | react-joyride (MIT) |
| NextStepJS | Requires `motion` (Framer Motion) as a peer dependency -- adds 15-30KB gzipped to the bundle for animation capabilities this feature does not need. Only 24K weekly downloads vs 635K; smaller community means higher maintenance risk. | react-joyride (MIT, zero animation dep) |
| Reactour | Last meaningful release in 2023. Stale maintenance. v3 of react-joyride is actively developed as of April 2026. | react-joyride v3 |
| Custom `@floating-ui/react-dom` implementation | For 6 steps with spotlight overlay, scroll management, keyboard navigation, back/next/skip/done controls, and controlled start/stop, you would spend 2-3 days building what react-joyride provides out of the box. Only justified for < 3 steps with no overlay. | react-joyride v3 |
| Any library requiring `framer-motion` / `motion` | The project currently has zero animation library dependencies. Adding one solely for tour tooltips is disproportionate. | react-joyride (CSS transitions) |

---

## Integration Points with Existing Stack

### Next.js 14 App Router

react-joyride v3 is SSR-safe. Import it in a client component (`'use client'` directive) and it renders via portal. No special configuration needed for App Router.

**Pattern:** Create a `TourProvider` client component in `nextjs/components/onboarding/` that wraps the tour logic. Include it in the protected layout (`app/(protected)/layout.tsx`) so it is available on all authenticated pages.

### Tailwind CSS v4

react-joyride's default tooltip styles are minimal and customizable. Override with Tailwind classes via the `styles` prop or provide a fully custom `tooltipComponent`. The project's existing `cn()` utility works for conditional class merging in custom tooltip components.

### NextAuth Session

The `isDemoAccount` and `isExampleProject` flags already exist in the JWT session. Use `useSession()` in the `TourProvider` to determine tour trigger behavior (always run for demo, check `hasSeenTour` for regular users).

### Prisma / Database

Add a `hasSeenTour` boolean field to the `User` model. Single migration, single column. Persist via a `PATCH /api/users/tour-status` endpoint when the tour completes or is skipped.

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `react-joyride@3.0.2` | `react@^16.8 \|\| ^17 \|\| ^18 \|\| ^19` | Officially supports React 18.3.1 (project version). |
| `react-joyride@3.0.2` | `next@14.x` | SSR-safe, portal-based rendering. Works with App Router. |
| `react-joyride@3.0.2` | `tailwindcss@4.x` | No CSS conflicts. Tooltip styles are inline/portal-rendered. |
| `@floating-ui/react-dom` (transitive) | `react@^16.8 \|\| ^17 \|\| ^18 \|\| ^19` | Transitive dependency of react-joyride v3. No direct installation needed. |

---

## Sources

- [react-joyride npm](https://www.npmjs.com/package/react-joyride) -- version 3.0.2, 635K weekly downloads, last published April 2026 (HIGH confidence)
- [react-joyride v3 "New in V3" docs](https://react-joyride.com/docs/new-in-v3) -- @floating-ui migration, SVG overlay, hook API, ~30% smaller bundle (HIGH confidence)
- [react-joyride GitHub releases](https://github.com/gilbarbara/react-joyride/releases) -- active maintenance confirmed (HIGH confidence)
- [react-joyride React 18 compatibility issue #1124](https://github.com/gilbarbara/react-joyride/issues/1124) -- v3 resolves React 18 issues from v2 (HIGH confidence)
- [react-shepherd npm](https://www.npmjs.com/package/react-shepherd) -- v7.0.4, AGPL-3.0 license confirmed (HIGH confidence)
- [Shepherd.js website](https://www.shepherdjs.dev/) -- dual AGPL-3.0 + Commercial license (HIGH confidence)
- [Intro.js license page](https://introjs.com/docs/getting-started/license) -- AGPL with paid commercial tiers (HIGH confidence)
- [nextstepjs npm](https://www.npmjs.com/package/nextstepjs) -- v2.2.0, 24K weekly downloads, requires motion dependency (MEDIUM confidence)
- [OnboardJS comparison article](https://onboardjs.com/blog/5-best-react-onboarding-libraries-in-2025-compared) -- ecosystem overview (MEDIUM confidence)
- [Bundlephobia react-joyride v2.5.5](https://bundlephobia.com/package/react-joyride) -- v2 was ~30KB gzipped; v3 claims ~30% reduction (MEDIUM confidence on exact v3 size)

---

*Stack research for: Onboarding Tour Tooltips*
*Researched: 2026-04-08*
