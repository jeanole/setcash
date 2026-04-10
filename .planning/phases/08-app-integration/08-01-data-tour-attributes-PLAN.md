---
phase: 08-app-integration
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - nextjs/components/layout/Sidebar.tsx
  - nextjs/components/layout/ProjectSwitcher.tsx
  - nextjs/components/layout/Header.tsx
  - nextjs/components/dashboard/QuickActions.tsx
  - nextjs/components/dashboard/RecentBillsList.tsx
  - nextjs/components/dashboard/DashboardClient.tsx
autonomous: true
requirements:
  - INTG-01
user_setup: []

must_haves:
  truths:
    - "Every TOUR_STEPS selector resolves to exactly one element on /dashboard (desktop viewport)"
    - "The sidebar-nav step can be located from BOTH the desktop sidebar nav AND the mobile hamburger button via a single selector"
    - "Tour targets are the smallest visible interactive element, not wrapper sections (D-08)"
    - "No data-tour attribute is added through user-controlled input — all values are static literals"
  artifacts:
    - path: "nextjs/components/layout/Sidebar.tsx"
      provides: "data-tour='sidebar-nav' on desktop <nav>"
      contains: "data-tour=\"sidebar-nav\""
    - path: "nextjs/components/layout/Header.tsx"
      provides: "data-tour='sidebar-nav' on hamburger button AND data-tour='user-menu' on profile button"
      contains: "data-tour=\"sidebar-nav\""
    - path: "nextjs/components/layout/ProjectSwitcher.tsx"
      provides: "data-tour='project-switcher' on root element"
      contains: "data-tour=\"project-switcher\""
    - path: "nextjs/components/dashboard/QuickActions.tsx"
      provides: "data-tour='submit-bill' on New Bill action link"
      contains: "data-tour=\"submit-bill\""
    - path: "nextjs/components/dashboard/RecentBillsList.tsx"
      provides: "data-tour='bill-list' on root element"
      contains: "data-tour=\"bill-list\""
    - path: "nextjs/components/dashboard/DashboardClient.tsx"
      provides: "data-tour='budget-matrix' on Spending by Category chart container"
      contains: "data-tour=\"budget-matrix\""
  key_links:
    - from: "lib/tour/steps.ts TOUR_STEPS[*].targetSelector"
      to: "DOM elements on /dashboard"
      via: "document.querySelector in TourController.tsx"
      pattern: "\\[data-tour=\"(sidebar-nav|project-switcher|submit-bill|bill-list|budget-matrix|user-menu)\"\\]"
---

<objective>
Attach `data-tour` attributes to the six target host components so that each `TOUR_STEPS` entry in `nextjs/lib/tour/steps.ts` can be located via `document.querySelector(step.targetSelector)` on the `/dashboard` route. This is the pure markup side of Phase 8 — no runtime logic changes here. Plan 02 adapts the tour runtime to consume the attributes.

Purpose: Satisfy INTG-01 (data-tour attributes present and matching step config) per CONTEXT.md decisions D-08 and D-09.
Output: Six modified component files, each carrying a single static `data-tour` literal on the smallest visible interactive element representing the feature.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/08-app-integration/08-CONTEXT.md
@nextjs/lib/tour/steps.ts
@nextjs/components/layout/Sidebar.tsx
@nextjs/components/layout/ProjectSwitcher.tsx
@nextjs/components/layout/Header.tsx
@nextjs/components/dashboard/QuickActions.tsx
@nextjs/components/dashboard/RecentBillsList.tsx
@nextjs/components/dashboard/DashboardClient.tsx

<interfaces>
<!-- Current TOUR_STEPS selectors the executor must satisfy. Verbatim from nextjs/lib/tour/steps.ts. -->
<!-- Each entry below lists the selector and which host element it must bind to per D-09. -->

TOUR_STEPS selectors (from nextjs/lib/tour/steps.ts):
- `[data-tour="sidebar-nav"]` → desktop: Sidebar.tsx `<nav>` at ~line 295; mobile: Header.tsx hamburger button at ~line 34
- `[data-tour="submit-bill"]` → QuickActions.tsx "New Bill" Link (first entry of ACTIONS array, href="/bills")
- `[data-tour="bill-list"]` → RecentBillsList.tsx root `<div>` at ~line 12
- `[data-tour="budget-matrix"]` → DashboardClient.tsx "Spending by Category" chart wrapper `<div>` at ~line 120
- `[data-tour="project-switcher"]` → ProjectSwitcher.tsx root `<div>` at ~line 81
- `[data-tour="user-menu"]` → Header.tsx profile button at ~line 64 (already exists; just needs attribute)

Key note: The desktop sidebar `<nav>` at Sidebar.tsx line ~295 is `hidden lg:flex` via its parent `<aside>`; on mobile (<1024px) the `<aside>` is hidden, so the selector resolves to zero elements. The hamburger button in Header.tsx is `lg:hidden`, so on desktop it returns zero. Both carrying the same `data-tour="sidebar-nav"` attribute yields exactly one visible match at any viewport — `document.querySelector` returns the first, but only the visible one has a rendered bounding box > 0. Plan 02's runtime handles the viewport-aware skip logic.

Profile button in Header.tsx already exists at line ~64 (the `<button>` that calls `onProfileOpen`); NO new button needs to be introduced — just add `data-tour="user-menu"` to it.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add data-tour attributes to layout components (Sidebar, Header, ProjectSwitcher)</name>
  <files>nextjs/components/layout/Sidebar.tsx, nextjs/components/layout/Header.tsx, nextjs/components/layout/ProjectSwitcher.tsx</files>

  <read_first>
    - nextjs/components/layout/Sidebar.tsx (to see current desktop `<nav>` at line ~295 and mobile `<nav>` at line ~349)
    - nextjs/components/layout/Header.tsx (hamburger `<button>` at ~line 34, profile `<button>` at ~line 64)
    - nextjs/components/layout/ProjectSwitcher.tsx (root `<div ref={containerRef}>` at ~line 81)
    - nextjs/lib/tour/steps.ts (confirm selector literals)
    - .planning/phases/08-app-integration/08-CONTEXT.md (D-02, D-03, D-08, D-09)
  </read_first>

  <action>
Make exactly these edits. Add the attribute once per file element; do NOT touch any other markup.

1. **Sidebar.tsx (line ~295, desktop `<nav>` inside `<aside className="hidden lg:flex ...">`):**
   Change:
   ```tsx
   <nav className="flex-1 px-3 py-4 space-y-1" aria-label="Main menu">
   ```
   to:
   ```tsx
   <nav data-tour="sidebar-nav" className="flex-1 px-3 py-4 space-y-1" aria-label="Main menu">
   ```
   Do NOT add `data-tour` to the mobile `<nav aria-label="Mobile main menu">` at line ~349. The mobile nav lives inside a drawer that is invisible unless opened — per D-03, the tour must not open the drawer. The mobile target is the hamburger button in Header.tsx instead (step 2 below).

2. **Header.tsx — hamburger button (line ~34, `onClick={onMenuToggle}`):**
   Change:
   ```tsx
   <button
     type="button"
     onClick={onMenuToggle}
     className="lg:hidden mr-3 p-2 -ml-2 rounded-lg hover:bg-zinc-900/6 transition-colors"
     aria-label="Open navigation menu"
   >
   ```
   to:
   ```tsx
   <button
     type="button"
     data-tour="sidebar-nav"
     onClick={onMenuToggle}
     className="lg:hidden mr-3 p-2 -ml-2 rounded-lg hover:bg-zinc-900/6 transition-colors"
     aria-label="Open navigation menu"
   >
   ```
   Rationale per D-02: on mobile the sidebar-nav step retargets to the hamburger. The shared selector `[data-tour="sidebar-nav"]` resolves to whichever of the two elements is currently rendered (desktop nav on ≥1024px, hamburger on <1024px; the other is CSS-hidden but also not in the layout tree because of how `lg:flex` / `lg:hidden` work on the respective parents — the hamburger parent is always in the DOM, but its own `lg:hidden` gives it `display:none` on desktop, and the sidebar `<aside>` is `hidden lg:flex` which becomes `display:none` on mobile). Plan 02's runtime must pick the element with a non-zero bounding box, not simply the first match.

3. **Header.tsx — profile button (line ~64, `onClick={onProfileOpen}`):**
   Change:
   ```tsx
   <button
     type="button"
     onClick={onProfileOpen}
     className="w-8 h-8 rounded-full bg-[var(--vb-accent)] border border-zinc-900 flex items-center justify-center text-zinc-900 text-sm font-bold shrink-0 cursor-pointer focus:outline-none btn-brutal-sm"
     aria-label={`Edit profile — signed in as ${user.email}`}
   >
   ```
   to:
   ```tsx
   <button
     type="button"
     data-tour="user-menu"
     onClick={onProfileOpen}
     className="w-8 h-8 rounded-full bg-[var(--vb-accent)] border border-zinc-900 flex items-center justify-center text-zinc-900 text-sm font-bold shrink-0 cursor-pointer focus:outline-none btn-brutal-sm"
     aria-label={`Edit profile — signed in as ${user.email}`}
   >
   ```
   The profile button already exists; no new button introduction needed. D-09's "introduce a minimal one as part of this phase" is satisfied because it already exists.

4. **ProjectSwitcher.tsx (line ~81, root `<div>`):**
   Change:
   ```tsx
   <div ref={containerRef} className="relative px-6 py-3 border-b border-slate-200">
   ```
   to:
   ```tsx
   <div ref={containerRef} data-tour="project-switcher" className="relative px-6 py-3 border-b border-slate-200">
   ```
   Note: ProjectSwitcher.tsx is only rendered inside the desktop `<aside>` branch of Sidebar.tsx (line ~293) when `!isDemoAccount`; the demo branch renders a static `<div>` with project name instead. Because demo users DO see the tour (Phase 6 D-03), Plan 02 must rely on the viewport + demo-state skip logic from runtime, not on the data-tour attribute presence alone. Do NOT add `data-tour="project-switcher"` to the demo branch's info `<div>` — it's not a project switcher.
  </action>

  <verify>
    <automated>cd nextjs && grep -q 'data-tour="sidebar-nav"' components/layout/Sidebar.tsx && grep -q 'data-tour="sidebar-nav"' components/layout/Header.tsx && grep -q 'data-tour="user-menu"' components/layout/Header.tsx && grep -q 'data-tour="project-switcher"' components/layout/ProjectSwitcher.tsx && npx tsc --noEmit && npm run lint</automated>
  </verify>

  <acceptance_criteria>
    - `grep -c 'data-tour="sidebar-nav"' nextjs/components/layout/Sidebar.tsx` prints `1` (desktop nav only)
    - `grep -c 'data-tour="sidebar-nav"' nextjs/components/layout/Header.tsx` prints `1` (hamburger button)
    - `grep -c 'data-tour="user-menu"' nextjs/components/layout/Header.tsx` prints `1` (profile button)
    - `grep -c 'data-tour="project-switcher"' nextjs/components/layout/ProjectSwitcher.tsx` prints `1`
    - `grep -n 'data-tour="sidebar-nav"' nextjs/components/layout/Sidebar.tsx` points to the `<nav aria-label="Main menu">` line, NOT the mobile `<nav aria-label="Mobile main menu">` line
    - `cd nextjs && npx tsc --noEmit` exits 0
    - `cd nextjs && npm run lint` exits 0
    - No new imports were added to any of the three files (grep shows same import count before/after)
  </acceptance_criteria>

  <done>
    All four layout attributes are present on the correct DOM elements, no other markup was altered, TypeScript compiles cleanly, and ESLint passes.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add data-tour attributes to dashboard components (QuickActions, RecentBillsList, DashboardClient)</name>
  <files>nextjs/components/dashboard/QuickActions.tsx, nextjs/components/dashboard/RecentBillsList.tsx, nextjs/components/dashboard/DashboardClient.tsx</files>

  <read_first>
    - nextjs/components/dashboard/QuickActions.tsx (ACTIONS array at ~line 11, map loop at ~line 43)
    - nextjs/components/dashboard/RecentBillsList.tsx (root `<div>` at ~line 12)
    - nextjs/components/dashboard/DashboardClient.tsx (Spending by Category chart wrapper at ~line 120)
    - nextjs/lib/tour/steps.ts (confirm selector literals for submit-bill, bill-list, budget-matrix)
    - .planning/phases/08-app-integration/08-CONTEXT.md (D-08 smallest-interactive-element rule, D-09 budget-matrix retargeting)
  </read_first>

  <action>
Three files, one attribute each. Do NOT refactor; do NOT restructure component props.

1. **QuickActions.tsx — the "New Bill" Link:**
   The ACTIONS array renders four items. Per D-08 (smallest visible interactive element) the `submit-bill` target is the "New Bill" Link specifically, not the grid container. Do NOT add the attribute to the ACTIONS array (that would require adding an optional field and a map change). Instead, pre-destructure the first action or conditionally emit the attribute during the map. Use the latter — minimal change.

   Change the map at line ~43:
   ```tsx
   {ACTIONS.map((action) => (
     <Link
       key={action.href}
       href={action.href}
       role="listitem"
       className="group flex flex-col items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-center hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition-all hover:scale-[1.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
     >
   ```
   to:
   ```tsx
   {ACTIONS.map((action) => (
     <Link
       key={action.href}
       href={action.href}
       role="listitem"
       data-tour={action.label === 'New Bill' ? 'submit-bill' : undefined}
       className="group flex flex-col items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-center hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition-all hover:scale-[1.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
     >
   ```
   React elides attributes whose value is `undefined`, so only the "New Bill" link gets the attribute in the rendered DOM. Do NOT change the ACTIONS array (labels are the source of truth for the match).

2. **RecentBillsList.tsx — root `<div>` at line 12:**
   Change:
   ```tsx
   <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
   ```
   to:
   ```tsx
   <div data-tour="bill-list" className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
   ```
   This is acceptable per D-08 even though the root `<div>` is a wrapper, because the entire card IS the feature the user needs to see — there is no smaller "bill list" element inside that is the meaningful target. The spotlight should envelope the card.

3. **DashboardClient.tsx — Spending by Category chart wrapper at ~line 120:**
   Per D-09 the `budget-matrix` step is RETARGETED to the "Spending by Category" chart container (not the literal budget matrix page — that lives at /budget and is out of scope for a dashboard-only tour per D-06).
   Change:
   ```tsx
   <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
     <h2 className="text-sm font-semibold text-slate-700 mb-4">
       Spending by Category
     </h2>
     <SpendingByCategoryChart items={categoryItems} />
   </div>
   ```
   to:
   ```tsx
   <div data-tour="budget-matrix" className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
     <h2 className="text-sm font-semibold text-slate-700 mb-4">
       Spending by Category
     </h2>
     <SpendingByCategoryChart items={categoryItems} />
   </div>
   ```
   IMPORTANT: Do NOT also add the attribute to the "Spending by Motive" chart wrapper at ~line 113; only the Category chart is the target. The attribute name `budget-matrix` is historical (from TOUR_STEPS.id); keep the id in steps.ts unchanged — only its `body` copy changes in Plan 02.
  </action>

  <verify>
    <automated>cd nextjs && grep -q "data-tour={action.label === 'New Bill' ? 'submit-bill' : undefined}" components/dashboard/QuickActions.tsx && grep -q 'data-tour="bill-list"' components/dashboard/RecentBillsList.tsx && grep -q 'data-tour="budget-matrix"' components/dashboard/DashboardClient.tsx && npx tsc --noEmit && npm run lint</automated>
  </verify>

  <acceptance_criteria>
    - `grep -c 'data-tour="submit-bill"' nextjs/components/dashboard/QuickActions.tsx || grep -c "data-tour={action.label === 'New Bill'" nextjs/components/dashboard/QuickActions.tsx` prints `1` (conditional form accepted)
    - `grep -c 'data-tour="bill-list"' nextjs/components/dashboard/RecentBillsList.tsx` prints `1`
    - `grep -c 'data-tour="budget-matrix"' nextjs/components/dashboard/DashboardClient.tsx` prints `1` (exactly once — not on both chart containers)
    - `grep -B2 'data-tour="budget-matrix"' nextjs/components/dashboard/DashboardClient.tsx` context shows the Category chart wrapper, NOT the Motive chart wrapper
    - The ACTIONS array in QuickActions.tsx still has 4 entries with unchanged `label` values (`New Bill`, `Spending`, `Budget`, `Reports`)
    - `cd nextjs && npx tsc --noEmit` exits 0
    - `cd nextjs && npm run lint` exits 0
  </acceptance_criteria>

  <done>
    All three dashboard attributes are present, the conditional submit-bill binding uses the static `'New Bill'` label literal, the budget-matrix attribute is on the Category chart only, TypeScript compiles cleanly, and ESLint passes.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client JSX → rendered DOM | Static literal attribute values flow from source files into the DOM; no user input crosses this boundary in this plan. |
| DOM → `document.querySelector` (Plan 02 runtime) | The tour runtime reads attributes via CSS selectors — selectors are static literals from TOUR_STEPS, not user input. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-08-01 | Tampering | Sidebar.tsx / Header.tsx / ProjectSwitcher.tsx / dashboard files | accept | Attributes are static string literals hard-coded in JSX; no user input interpolation. Severity: low. |
| T-08-02 | Information Disclosure | data-tour attributes in rendered HTML | accept | The attribute leaks only the target step ID (e.g. `sidebar-nav`). No PII or session data. Severity: low. Already standard practice for analytics/test-id attributes in the codebase. |
| T-08-03 | Elevation of Privilege | QuickActions.tsx conditional attribute | accept | The condition `action.label === 'New Bill'` compares against a hard-coded literal from the in-file `ACTIONS` const — attacker cannot influence the comparison. Severity: low. |

No high-severity threats. Plan passes security gate.
</threat_model>

<verification>
After both tasks complete:

1. Build check: `cd nextjs && npx tsc --noEmit` exits 0
2. Lint check: `cd nextjs && npm run lint` exits 0
3. Selector presence sweep:
   ```
   cd nextjs && for s in sidebar-nav project-switcher submit-bill bill-list budget-matrix user-menu; do
     echo -n "$s: "; grep -rn "data-tour=\"$s\"" components/ | wc -l
   done
   ```
   Expected:
   - `sidebar-nav: 2` (Sidebar.tsx desktop nav + Header.tsx hamburger)
   - `project-switcher: 1`
   - `submit-bill: 0` (conditional form, counted below)
   - `bill-list: 1`
   - `budget-matrix: 1`
   - `user-menu: 1`
4. Conditional submit-bill: `grep -c "'submit-bill'" nextjs/components/dashboard/QuickActions.tsx` prints `1`
5. No `data-tour` attribute accepts any dynamic value derived from session/URL/props (grep for `data-tour=\{` and confirm only the one conditional literal match).
</verification>

<success_criteria>
- All six TOUR_STEPS target selectors can be located in the source via grep
- Plan 02's TourController can call `document.querySelector('[data-tour="*"]')` and find the correct element at the correct viewport
- No data-tour value is derived from untrusted input
- TypeScript and ESLint clean
</success_criteria>

<output>
After completion, create `.planning/phases/08-app-integration/08-01-SUMMARY.md` documenting: files modified, attribute bindings, and any deviations from the plan.
</output>
