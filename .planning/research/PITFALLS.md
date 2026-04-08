# Pitfalls Research

**Domain:** Tooltip-based onboarding tour in a Next.js 14 App Router multi-page application
**Researched:** 2026-04-08
**Confidence:** HIGH (verified against codebase structure, React/Next.js patterns, and real-world tour library issues)

## Critical Pitfalls

### Pitfall 1: Targeting Elements That Have Not Rendered Yet (Async Data)

**What goes wrong:**
Every page in SetCash loads data via `useEffect` hooks (see `useBills.ts`, `useCategories.ts`, `useMotives.ts`, etc.). The tour step says "highlight the bill table" but the bill table does not exist in the DOM until the fetch resolves and React re-renders. The tour either shows the tooltip anchored to nothing (positioned at 0,0 or off-screen), throws a null reference error when calling `getBoundingClientRect()` on a missing element, or silently skips the step — confusing the user.

**Why it happens:**
Tour implementations typically resolve target selectors once when a step activates. If the selector finds nothing, most libraries fail silently or show the tooltip as a modal fallback. Developers test with warm caches where data loads in milliseconds and never see the race condition.

**How to avoid:**
1. Use a `MutationObserver` or polling mechanism that waits for the target element to appear before showing the tooltip. A simple `waitForElement(selector, timeoutMs)` utility that returns a Promise resolving when the element exists in the DOM.
2. Add a `data-tour="step-name"` attribute to stable wrapper elements (like the card container that always renders) rather than targeting inner content that appears after loading. The sidebar nav items (`Sidebar.tsx` lines 23+) are always present — those are safe targets. The bill table inside the dashboard is not.
3. Set a maximum wait time (3 seconds) with a graceful fallback: if the element does not appear, show the tooltip as a centered modal with the same content. Do not skip the step silently.

**Warning signs:**
- Tour works perfectly on subsequent visits (data cached) but breaks on first visit (cold load)
- Tooltip appears at the top-left corner of the viewport instead of next to the target
- Console warnings about `null` or `undefined` when calling `.getBoundingClientRect()`

**Phase to address:**
Core tour engine implementation — the element-waiting logic must be baked into the tour controller from day one, not bolted on after.

---

### Pitfall 2: Z-Index Wars With Existing Modals and Overlays

**What goes wrong:**
SetCash has a layered z-index stack that is already fragile:
- Header: `z-40` (sticky)
- Modals, dropdowns, mobile sidebar: `z-50`
- Confirmation dialogs: `z-[70]`
- SuperAdmin modal: `z-[200]`
- SuperAdmin sub-modals: `z-[300]`
- Toast container: `z-[400]`

A tour overlay needs to sit above regular content but below critical modals. If the tour overlay uses `z-50` (a common default in tour libraries), it fights with the mobile sidebar, notification bell dropdown, ProjectSwitcher dropdown, and every modal in the app. If it uses `z-[9999]` (another common approach), it covers the toast notifications and any confirmation dialog that might appear during the tour.

**Why it happens:**
Tour libraries ship with hardcoded z-index values designed for greenfield apps. Developers install the library, see the tour working on the dashboard, and ship it — never testing what happens when the notification bell dropdown opens or the mobile sidebar slides in during a tour step.

**How to avoid:**
1. Define a dedicated tour z-index layer: overlay at `z-[60]`, tooltip at `z-[65]`. This sits above the header (`z-40`) and standard content but below confirmation dialogs (`z-[70]`) and all modal layers.
2. When the tour is active, disable interactive elements that would open competing overlays (notification bell, project switcher dropdown). Use `pointer-events: none` on those elements during the tour, or add an `aria-disabled` state.
3. On mobile, dismiss the sidebar before starting the tour. The mobile sidebar at `z-50` would overlap with the tour. Close it programmatically via the existing `handleMenuClose` in `AppShell.tsx`.
4. Document the z-index map as a comment in the tour component so future developers do not accidentally change it.

**Warning signs:**
- Tour overlay covers the "Skip" button because a dropdown rendered on top
- Mobile users cannot see the tour tooltip because the sidebar is open behind it
- Toast notifications appear underneath the tour overlay, invisible to the user

**Phase to address:**
Tour component implementation — z-index values must be chosen with full knowledge of the existing stack. This is not a "polish later" item.

---

### Pitfall 3: Tour Breaking on Client-Side Navigation (App Router)

**What goes wrong:**
SetCash uses Next.js App Router with client-side `<Link>` navigation. The tour is a client component living in `AppShell`. When the user is on step 3 (pointing at the budget matrix) and clicks "Next" to go to step 4 (pointing at the settings page), the tour must navigate the user to `/settings` and then find the target element on that new page.

The problem: Next.js App Router navigation unmounts the page component and mounts a new one. If the tour state (current step) lives inside the page component, it is destroyed on navigation. If it lives in `AppShell` (which persists across navigations), the tour survives but the target element from the new page has not rendered yet (back to Pitfall 1). Additionally, the `loading.tsx` skeleton may appear during navigation, and the tour tries to anchor to a skeleton element that is replaced moments later.

**Why it happens:**
Single-page tour libraries assume all steps are on one page. Multi-page tours require the tour controller to orchestrate navigation, wait for the new page to load, wait for async data to resolve, and only then show the next tooltip. Most implementations skip the "wait for data" step.

**How to avoid:**
1. Store tour state (current step index, active/inactive) in the `AppShell` component or a React context that wraps the entire protected layout. This state persists across App Router navigations.
2. Each tour step definition should include: `{ targetSelector, pageRoute, content, position }`. When advancing to a step on a different route, the tour controller calls `router.push(step.pageRoute)` and then uses the `waitForElement` utility (from Pitfall 1) before positioning the tooltip.
3. Listen to the Next.js `usePathname()` hook to detect when navigation completes. Only after the pathname matches the expected route AND the target element exists should the tooltip appear.
4. Ignore `loading.tsx` skeletons. Add the `data-tour` attributes only to the real page content, not to loading skeletons. The `waitForElement` naturally skips the loading state.

**Warning signs:**
- Tour tooltip disappears and never reappears after clicking a sidebar link
- Tour shows step 4 content anchored to step 3's element because navigation has not completed
- Flash of tooltip at wrong position during page transition

**Phase to address:**
Tour architecture design — the multi-page navigation flow must be designed upfront, not retrofitted.

---

### Pitfall 4: Stale Element References After React Re-Renders

**What goes wrong:**
React re-renders replace DOM nodes. The tour captures a reference to a DOM element (via `querySelector` or `ref`), positions the tooltip relative to it, and then React re-renders the component (e.g., data loads, state changes, theme toggle). The original DOM node is gone — replaced by a new node with the same selector but a different position or size. The tooltip remains anchored to the old coordinates.

In SetCash specifically: the budget matrix table (`BudgetMatrixTable.tsx`) has sticky headers with z-index values (`z-10`, `z-20`, `z-30`) and re-renders when data loads or cells are edited. The bill list re-renders when filters change. The sidebar re-renders when the project is switched.

**Why it happens:**
DOM references obtained via `document.querySelector()` are snapshots. React's virtual DOM reconciliation replaces nodes silently. The tour does not know the node was replaced because the selector still matches — it just matches a different node now.

**How to avoid:**
1. Re-query the target element on every animation frame or at minimum on every React render cycle. Use `requestAnimationFrame` to continuously update the tooltip position while a step is active. This is cheap (one `getBoundingClientRect` call per frame) and ensures the tooltip tracks element movement.
2. Use `ResizeObserver` on the target element to detect size changes, and re-position the tooltip when the observer fires.
3. Do NOT cache `getBoundingClientRect()` results. Always call it fresh when positioning.
4. For steps targeting the budget matrix: add the `data-tour` attribute to the outer container (which is stable), not to a specific cell or sticky header (which shifts).

**Warning signs:**
- Tooltip "drifts" away from its target after scrolling or filtering
- Tooltip points to empty space after the user interacts with the page during the tour
- Budget matrix step tooltip overlaps with sticky headers

**Phase to address:**
Tour positioning engine — must use continuous repositioning from the start.

---

### Pitfall 5: Hydration Mismatch With SSR

**What goes wrong:**
The protected layout in SetCash is a server component that renders `AppShell` (a client component). If the tour component checks `typeof window !== 'undefined'` or reads `localStorage` (to check `hasSeenTour`) during the initial render, the server-rendered HTML will not include the tour overlay, but the client hydration will try to add it. React throws a hydration mismatch warning and may produce visual glitches (flash of tour appearing, disappearing, then reappearing).

**Why it happens:**
Developers add `hasSeenTour` as a condition that gates rendering of the tour overlay. On the server, `localStorage` is not available, so the condition evaluates differently than on the client.

**How to avoid:**
1. Never read `hasSeenTour` from localStorage during the initial render. Use a `useEffect` to read it after mount, and keep the tour hidden until the effect runs.
2. The tour component should render `null` on the server and during the first client render. Use a `const [mounted, setMounted] = useState(false)` pattern with `useEffect(() => setMounted(true), [])`. Only render the tour when `mounted && shouldShowTour`.
3. The `hasSeenTour` flag should come from the API (database), not localStorage. The project already has `isDemoAccount` in the JWT session — add `hasSeenTour` to the user model and pass it via the session. This avoids localStorage entirely and works with SSR.

**Warning signs:**
- React hydration mismatch warnings in the console mentioning the tour component
- Flash of unstyled tour overlay on page load
- Tour appearing briefly then disappearing on first render

**Phase to address:**
Data model and tour trigger logic — decide where `hasSeenTour` lives before building the UI.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcoding step selectors as CSS class names | Quick to implement | Classes get renamed in refactors, breaking the tour silently | Never — use `data-tour` attributes |
| Storing tour state in localStorage only | No API/DB changes needed | Tour resets when user clears browser, does not sync across devices, demo users bypass is fragile | MVP only if `hasSeenTour` DB field is in the same milestone |
| Inline tour content as string literals in the component | No separate config file | Content changes require code changes and redeployment; impossible to i18n later | Acceptable for v1.1 single-language tour |
| Using `position: fixed` for all tooltips | Simpler positioning math | Breaks inside scrollable containers (the main content area scrolls in SetCash) | Never — use `position: absolute` relative to a positioned ancestor or a portal |
| Skipping mobile testing | Faster development | Mobile sidebar, smaller viewport, and touch interactions break the tour in ways desktop testing never reveals | Never |

## Integration Gotchas

Common mistakes when integrating the tour with SetCash's existing systems.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| NextAuth session (`isDemoAccount`) | Reading `isDemoAccount` only from `useSession()` which may be stale after login | Read from the session passed by the server layout; `useSession` reflects the latest JWT which is correct here since `isDemoAccount` is set at sign-in |
| Mobile sidebar (`Sidebar.tsx`) | Tour step targets a sidebar nav item but on mobile the sidebar is hidden (off-screen `aside`) | Check viewport width; on mobile, programmatically open the sidebar before showing a sidebar-targeted step, then close it after advancing |
| Notification bell dropdown | User opens notification dropdown during a tour step, dropdown renders at `z-50` and competes with tour | Disable notification bell interactivity during tour (add `pointer-events-none` class) or pause the tour when a dropdown opens |
| Theme toggle (dark mode) | Tour tooltip colors hardcoded for light theme; dark mode makes text invisible | Use CSS custom properties (`--vb-` tokens) for tooltip colors, or use Tailwind `dark:` variants. Test both themes. |
| `AppShell` state (`isMobileMenuOpen`) | Tour does not coordinate with `AppShell` state; opening mobile menu during tour causes visual chaos | Pass a `isTourActive` prop or context to `AppShell` that suppresses mobile menu toggle during tour |
| Budget matrix scroll | Tour highlights a budget cell but the matrix is scrollable with sticky headers; highlight overlay does not scroll with the table | Target the matrix container, not individual cells. Or use `scrollIntoView()` to ensure the target is visible before showing the tooltip |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Full-viewport overlay with `backdrop-filter: blur()` | Janky scrolling, dropped frames on mobile, battery drain | Use a simple semi-transparent background (`bg-black/50`) without blur. Blur forces GPU compositing of the entire viewport on every frame | Immediately on low-end mobile devices |
| Re-running `querySelector` on every animation frame without throttling | CPU usage spikes during tour, affects app responsiveness | Throttle repositioning to every 100ms, or use `ResizeObserver` + scroll listener instead of `requestAnimationFrame` polling | At 10+ tour steps or on pages with frequent re-renders |
| Cloning the entire page DOM for the highlight "cutout" effect | Memory spike, long initial step render | Use CSS `clip-path` or `box-shadow` with a large spread to create the spotlight effect. No DOM cloning needed | Immediately on complex pages like the budget matrix |
| Adding a `MutationObserver` on `document.body` with `subtree: true` | Observer fires on every DOM change across the entire app, causing GC pressure | Scope the observer to the nearest stable ancestor of the target element, not the entire document | On pages with frequent DOM updates (bill list with polling) |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Tour step content includes raw HTML injection patterns | XSS if tour content is ever loaded from DB or API in the future | Use React JSX for tour content, never raw HTML. Even for v1.1 hardcoded content, set the precedent correctly |
| Tour API endpoint to mark `hasSeenTour` lacks auth check | Any unauthenticated request can flip the flag for any user | Apply the standard auth pattern: check session, verify user ID matches, rate limit the endpoint |
| Tour overlay captures all click events, preventing access to critical UI | User cannot click "Submit" on a bill form that is partially completed | The overlay must have pointer-events passthrough (`pointer-events-none`) except for tour controls. Only the highlighted element and tour buttons should be clickable |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Tour starts immediately on login before the page has loaded | User sees a tooltip pointing at a loading skeleton; first impression is broken | Delay tour start until the dashboard page has finished loading (detect via a `data-loaded` attribute or a hook callback) |
| No way to restart the tour | User skips the tour, later wants to see it, cannot find it anywhere | Add a "Restart Tour" option in the settings page or help menu |
| Tour forces a linear path through 6 steps with no escape | User wanted to quickly submit a bill but is trapped in the tour | "Skip Tour" must be prominent (not a tiny X button). Skipping should be a single click, not a confirmation dialog |
| Tooltip blocks the element it is describing | Tooltip covers the sidebar nav item it is pointing at; user cannot see what is being described | Position tooltip with enough offset and use an arrow/pointer. Test that the target element is fully visible alongside the tooltip |
| Tour on mobile takes up too much screen space | Speech bubble covers 60% of the mobile viewport, user cannot see context | On viewports under 768px, use a bottom sheet or compact tooltip style. Limit content to one short sentence. Test on 375px width |
| Step content says "click here" but the element is not clickable during the tour | User tries to follow instructions, nothing happens, feels broken | Either make the highlighted element interactive during that step, or phrase content as "This is where you will..." not "Click here to..." |

## "Looks Done But Isn't" Checklist

- [ ] **Tour trigger logic:** Often missing the "every login for demo users" requirement — verify `isDemoAccount` users see the tour even after `hasSeenTour` is true
- [ ] **Mobile sidebar steps:** Often untested — verify tour opens/closes mobile sidebar programmatically when targeting nav items on small screens
- [ ] **Window resize during tour:** Often ignored — verify tooltip repositions correctly when browser is resized or mobile orientation changes
- [ ] **Keyboard navigation:** Often missing — verify user can advance tour with Enter/Escape, not just mouse clicks
- [ ] **Screen reader announcement:** Often skipped — verify tour step changes are announced via `aria-live` region
- [ ] **Back button:** Often only "Next" works — verify "Back" returns to the previous step with correct tooltip positioning, including cross-page back navigation
- [ ] **Tour state after session expiry:** Often not handled — verify that if the session expires mid-tour, the user is redirected to login and the tour resumes on next login (for demo users) or does not replay (for real users who completed it)
- [ ] **Dark mode:** Often only tested in light mode — verify all tour UI elements are visible in both themes
- [ ] **Multiple browser tabs:** Often ignored — verify that completing the tour in one tab does not leave a stale tour in another tab (use session/DB state, not just React state)

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Z-index conflict discovered in production | LOW | Update z-index values in the tour component; no data migration needed |
| Tour breaks on navigation | MEDIUM | Refactor tour state to context/AppShell level; requires restructuring component tree |
| Hydration mismatch causing flash | LOW | Add `mounted` state guard; single-file fix |
| Stale element references | MEDIUM | Replace snapshot positioning with continuous repositioning; touches the core positioning engine |
| Tour state in localStorage, user complains about re-showing | MEDIUM | Add `hasSeenTour` to DB schema, write migration, update tour trigger logic |
| Accessibility complaints (no keyboard nav, no screen reader) | MEDIUM | Add `aria-live`, `role="dialog"`, keyboard handlers; requires testing with screen reader |
| Mobile layout broken by tour | LOW-MEDIUM | Add responsive tooltip sizing and mobile-specific positioning; CSS-heavy fix |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Async element targeting (Pitfall 1) | Tour engine implementation | Test tour on cold load (clear cache, hard refresh) — tooltip must wait for data |
| Z-index conflicts (Pitfall 2) | Tour component implementation | Open every modal/dropdown during each tour step on both mobile and desktop |
| Navigation mid-tour (Pitfall 3) | Tour architecture design | Complete full 6-step tour that crosses pages; verify no step is skipped or mispositioned |
| Stale DOM references (Pitfall 4) | Tour positioning engine | Interact with the page during each step (scroll, filter, toggle) — tooltip must track |
| SSR hydration mismatch (Pitfall 5) | Data model and trigger logic | Check browser console for hydration warnings on first load after login |
| Mobile UX | Tour responsive design | Complete full tour on 375px viewport; verify no tooltip extends beyond screen |
| Accessibility | Tour controls implementation | Complete full tour using only keyboard; run axe-core on each step |
| Dark mode | Tour styling | Toggle theme during tour; verify all text/backgrounds have sufficient contrast |

## Sources

- SetCash codebase audit: `AppShell.tsx`, `Sidebar.tsx`, `Header.tsx`, `BudgetMatrixTable.tsx` z-index inventory (HIGH confidence)
- SetCash hooks: `useBills.ts`, `useCategories.ts`, `useMotives.ts` async data loading patterns (HIGH confidence)
- React documentation on hydration: https://react.dev/reference/react-dom/client/hydrateRoot#handling-different-client-and-server-content (HIGH confidence)
- Next.js App Router navigation behavior: client-side transitions unmount/remount page components while layout persists (HIGH confidence)
- WAI-ARIA Authoring Practices for tooltip/dialog patterns: https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/ (HIGH confidence)
- `getBoundingClientRect()` returns position at call time, does not update reactively — standard DOM behavior (HIGH confidence)
- CSS `clip-path` spotlight technique vs DOM cloning: common pattern in Shepherd.js, React Joyride implementations (MEDIUM confidence)
- Mobile viewport tooltip overflow: documented in React Joyride and Intro.js GitHub issues as the most common complaint (MEDIUM confidence)

---
*Pitfalls research for: Tooltip-based onboarding tour in Next.js 14 App Router application*
*Researched: 2026-04-08*
