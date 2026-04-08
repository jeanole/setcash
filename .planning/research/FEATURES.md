# Feature Landscape

**Domain:** Tooltip-based onboarding tour for an existing Next.js expense tracking app
**Researched:** 2026-04-08
**Milestone scope:** v1.1 Onboarding Tour — 6-step guided tooltip tour for new and demo users

---

## Table Stakes

Features users expect from any tooltip-based product tour. Missing any of these makes the tour feel broken or unprofessional.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Step-by-step tooltip progression (Next/Back) | Core mechanic; users expect linear navigation through steps | Low | 6 steps per PROJECT.md; library handles navigation state machine |
| Element highlighting / spotlight overlay | Without dimming the background and cutting out the target, users cannot find what the tooltip references | Low | Dark overlay with CSS cutout around target element; all major libraries (driver.js, react-joyride) provide this out of the box |
| Scroll-into-view before showing tooltip | Target element may be below the fold; tooltip must scroll it into the viewport first | Low | All major libraries handle this automatically; critical for budget matrix step |
| Skip / Dismiss button on every step | Users who already know the app must bail out immediately; forcing them through 6 steps creates resentment | Low | "Skip tour" link in tooltip footer; persist completion on skip (same as finishing) |
| Done / Finish button on last step | Clear signal the tour is over; last step needs "Done" instead of "Next" | Low | Conditional label on final step; trivial |
| Progress indicator (step N of 6) | Users tolerate a 6-step tour only if they know how much is left; progress indicators measurably improve completion rates | Low | Dots or "3/6" text in tooltip; best practice says 3-5 ideal, 6 is acceptable |
| Smart tooltip positioning (flip/shift) | Tooltips must not overflow viewport edges; auto-flip when target is near screen edge | Low | Floating UI or library-internal positioning engine handles this; driver.js uses its own engine |
| Completion persistence (hasSeenTour flag) | Tour must not re-show on every page load for regular users; this is the single most annoying bug in product tours | Med | Requires Prisma migration: add `hasSeenTour Boolean @default(false)` to User model, plus PATCH endpoint to mark complete |
| Demo user re-trigger on every login | PROJECT.md explicitly requires tour shows every login for demo/test accounts | Low | Check `isDemoAccount` from session JWT (already available); bypass hasSeenTour flag |
| Backdrop click to dismiss | Standard UX pattern; clicking the dark overlay should close/skip the tour | Low | Config option in all major libraries |
| Auto-start on first login | New users should see the tour without clicking anything; requiring them to find a "Start Tour" button defeats the purpose | Med | Detect `hasSeenTour === false` in AppShell after mount; auto-trigger with short delay (500ms) to let page render settle |
| Tour does not break page interaction after completion | After tour ends, all click handlers, scrolling, and navigation must work normally; no leftover overlay or z-index issues | Low | Library cleanup on tour end; test manually |

---

## Differentiators

Features that elevate the tour beyond basic expectations. Not required, but noticeably improve quality.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Keyboard navigation (Esc to dismiss, arrow keys for steps) | Accessibility win; power users expect keyboard control; WCAG 2.1 compliance | Low | driver.js supports this out of the box; react-joyride needs `disableCloseOnEsc: false` config |
| ARIA live regions announcing step changes | Screen readers announce "Step 3 of 6: Track budget allocations" on each transition | Med | Requires `role="dialog"` + `aria-label` on tooltip, `aria-live="polite"` region for step content changes |
| Smooth scroll + entrance animations | Polished feel; tooltip fades/slides in rather than popping abruptly | Low | CSS transitions; driver.js includes smooth animations by default |
| Mobile-responsive step adaptation | On mobile (375px), sidebar is hidden behind hamburger; tour step 1 must either open the drawer or adapt | Med | Hook into `onBeforeStep` to programmatically open mobile sidebar before highlighting nav items; or skip sidebar step on mobile |
| Themed tooltips matching SetCash design system | Tour looks native rather than third-party; uses `--vb-` custom properties and Tailwind classes | Med | Custom popover component rendered inside library's tooltip slot; Tailwind styling with app's color tokens |
| Re-trigger tour from settings/profile | Users who skipped may want to revisit; admins demoing to team want to restart | Low | "Restart tour" button in profile dropdown or settings page; resets tour state client-side without touching DB |
| Tooltip arrow pointing to exact element | Visual line connecting tooltip to its target anchor | Low | Standard in all libraries; CSS triangle or SVG arrow |
| Delayed auto-start with welcome message | Instead of jumping straight to step 1, show a "Welcome to SetCash! Take a quick tour?" modal with Start/Skip | Low | Friendlier onboarding; gives user agency before tour begins |

---

## Anti-Features

Things to explicitly NOT build for v1.1.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Interactive walkthrough with sandbox data | PROJECT.md explicitly marks out of scope; massive complexity (fake data, sandbox isolation) for marginal benefit over tooltips | Lightweight tooltips pointing at real UI elements |
| Video tutorials or embedded help docs | Out of scope per PROJECT.md; video hosting, player integration, content creation are separate projects | One sentence per tooltip, under 140 characters |
| Per-project customizable tour content | Out of scope for v1.1; tour content changes rarely; admin editor is over-engineering | Hardcode 6 steps in a TypeScript config array |
| Tour analytics / drop-off tracking | Deferred to future milestone per PROJECT.md; adds schema complexity (step-level events) for data nobody will act on yet | Binary completion tracking only (hasSeenTour) |
| Multi-page tour spanning route changes | Route transitions cause component unmounting; re-mounting tour state across pages adds enormous complexity | All 6 steps target elements visible from the main dashboard/bills page; single-page tour |
| Conditional steps based on user role | Branching logic (admin sees 8 steps, user sees 5) adds complexity and testing burden | Show same 6 steps to all users; admin-only features use phrasing like "Admins can approve bills here" |
| Floating persistent help button | Clutters the UI permanently for a feature used once; demo users get auto-trigger every login | Allow re-trigger from profile menu or settings if needed |
| i18n / translated tour content | App is currently single-language; adding translation infrastructure just for 6 tooltips is premature | Hardcode English strings; extract to i18n keys only when app-wide i18n is adopted |
| Custom tooltip animation library (Framer Motion, etc.) | Adding a motion library for 6 fade-ins is dependency bloat | CSS transitions or library-built-in animations |

---

## Feature Dependencies

```
Prisma migration (hasSeenTour field on User)
  --> API endpoint (PATCH /api/users/me/tour-complete)
  --> Tour auto-start logic (reads hasSeenTour from session or API)

isDemoAccount session flag (ALREADY EXISTS in JWT)
  --> Demo re-trigger logic (bypass hasSeenTour check)

AppShell component (ALREADY EXISTS)
  --> Tour wrapper mounts here (wraps children or renders alongside)
  --> Tour reads session to decide whether to auto-start

Sidebar component (ALREADY EXISTS)
  --> Tour step 1 target (needs data-tour="sidebar-nav" attribute)
  --> Mobile: sidebar is a drawer, needs programmatic open for tour

data-tour attributes on target elements
  --> All 6 tour steps (each step needs a stable selector)
  --> Must be added to: Sidebar, "New Bill" button, Budget Matrix link,
      Bill status area, Export buttons, Settings link

Tour step config array
  --> Tour component (reads steps, renders tooltips)
  --> Decoupled from library choice (plain object array)
```

Key dependency chain: DB migration first, then API endpoint, then session enrichment (or client-side fetch), then tour component with auto-start logic.

---

## MVP Recommendation

Prioritize for v1.1 in this order:

1. **hasSeenTour DB migration + API endpoint** — foundational; everything else depends on knowing whether to show the tour
2. **6-step tooltip tour with Next/Back/Skip/Done** — the core deliverable; library-powered step progression
3. **Element highlighting with backdrop overlay** — users cannot find target elements without visual focus
4. **Auto-start on first login + demo re-trigger** — seamless; no user action required to begin
5. **Progress indicator (step counter)** — keeps users oriented through 6 steps
6. **Keyboard dismiss (Esc key)** — minimal effort, significant accessibility baseline
7. **data-tour attributes on target elements** — stable selectors for tour anchoring; avoids fragile CSS class selectors

Defer to v1.2 or later:
- **Full ARIA live regions**: Basic keyboard nav is sufficient for v1.1; add screen reader support in accessibility pass
- **Mobile sidebar step adaptation**: If sidebar step is broken on mobile, skip it on small viewports rather than building drawer-opening hooks
- **Custom themed tooltip component**: Use library defaults with Tailwind class overrides; full custom rendering is polish work
- **Re-trigger from settings**: Low priority; demo users get it every login, regular users rarely want to replay
- **Welcome modal before tour starts**: Nice-to-have; direct auto-start is simpler for v1.1

---

## Sources

- [OnboardJS: 5 Best React Onboarding Libraries in 2026](https://onboardjs.com/blog/5-best-react-onboarding-libraries-in-2025-compared)
- [Chameleon: Top 8 React Product Tour Libraries](https://www.chameleon.io/blog/react-product-tour)
- [Userorbit: Best Open-Source Product Tour Libraries 2026](https://userorbit.com/blog/best-open-source-product-tour-libraries)
- [Appcues: Tooltips Best Practices](https://www.appcues.com/blog/tooltips)
- [Userpilot: Onboarding Tooltips for SaaS](https://userpilot.com/blog/onboarding-tooltips-saas/)
- [Flook: 13 Mobile Tooltip Best Practices](https://flook.co/blog/posts/mobile-tooltip-best-practices)
- [CSS-Tricks: Onboarding UIs with Anchor Positioning](https://css-tricks.com/one-of-those-onboarding-uis-with-anchor-positioning/)
- [Appcues: Product Tour UI/UX Patterns](https://www.appcues.com/blog/product-tours-ui-patterns)
- SetCash codebase: AppShell.tsx, Sidebar.tsx, schema.prisma, session JWT flags
