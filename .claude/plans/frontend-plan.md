# Frontend Implementation Plan — CR-28: Visit Analytics & Demo Tracking

## Feature
CR-28: Insights into Site Visits and Demo Usage
Spec: `features/PROJ-23-visit-analytics-demo-tracking.md` → `### CR-28` section
Backend plan: `.claude/plans/backend-plan.md` (already implemented)

## Context Summary
- SuperAdmin modal: `nextjs/components/superadmin/SuperAdminModal.tsx` — 3 tabs: Projects, Users, Config
- TabType: `'projects' | 'users' | 'config'` in `nextjs/components/superadmin/types.ts`
- Existing tab components: `ProjectsTab.tsx`, `UsersTab.tsx`, `ConfigTab.tsx` — follow same pattern
- API utility: `useSuperAdminApi` hook + `apiFetch<T>()` for data fetching with toast error handling
- Chart library: `recharts` ^3.8.0 already installed (used in `SpendingByCategoryChart.tsx` with PieChart)
- Dashboard `KpiCard` component exists but is tied to dashboard-specific props (href, percentBar) — will build simpler inline KPI cards matching the superadmin card style
- Design system: white cards, `rounded-xl`, `border-slate-200`, `shadow-sm`, `var(--vb-accent)` indigo accent

### Backend API endpoints (already built)
- `GET /api/admin/analytics` — returns `{ kpi, dailyVisits, demoLog }` (superadmin only)
- `DELETE /api/admin/analytics/prune` — deletes records >90 days, returns `{ visits: N, demoLogins: M }`

### API Response Shape (from `GET /api/admin/analytics`)
```ts
{
  kpi: {
    totalVisits: number;
    visitsLast7Days: number;
    demoLoginsLast7Days: number;
    demoSuccessRate: number; // 0-100
  };
  dailyVisits: Array<{ date: string; count: number }>; // last 30 days
  demoLog: {
    items: Array<{
      id: string;
      timestamp: string;
      countryCode: string | null;
      turnstileSuccess: boolean;
      loginSuccess: boolean;
    }>;
    total: number;
    page: number;
    pageSize: number;
  };
}
```

## User Decisions (from architecture/backend phase)
- Display: KPI numbers + daily bar chart + raw demo log table
- No new pages — Analytics is a 4th tab in the existing SuperAdmin modal
- Manual prune button (90-day retention) with count feedback
- Style matches existing superadmin UI

## Open Bug Reports to Address
None for PROJ-23.

## Existing Components to Reuse
- `SuperAdminModal.tsx` — add 4th tab button
- `types.ts` — extend `TabType` union
- `useSuperAdminApi` hook + `apiFetch<T>()` — data fetching with error toasts
- `cn()` from `@/lib/utils` — class merging
- `recharts` — `BarChart`, `Bar`, `XAxis`, `YAxis`, `Tooltip`, `ResponsiveContainer`

## New Components to Build

### 1. `nextjs/components/superadmin/AnalyticsTab.tsx`

**Self-contained tab** component (follows `ConfigTab` pattern — manages its own data fetching and state).

**State:**
```ts
interface AnalyticsData {
  kpi: { totalVisits: number; visitsLast7Days: number; demoLoginsLast7Days: number; demoSuccessRate: number };
  dailyVisits: Array<{ date: string; count: number }>;
  demoLog: { items: DemoLogItem[]; total: number; page: number; pageSize: number };
}
```

**Sections:**

#### A) KPI Cards Row
4 cards in a responsive grid (`grid-cols-2 lg:grid-cols-4`):
1. **Total Visits** (all time) — icon: `Eye`
2. **Visits (7d)** — icon: `TrendingUp`
3. **Demo Logins (7d)** — icon: `LogIn`
4. **Success Rate** — icon: `CheckCircle`, shows `N%`

Style: white card, `rounded-xl border border-slate-200 p-4`, value in `text-2xl font-bold font-mono`, label in `text-xs uppercase tracking-wider text-slate-400`

#### B) Daily Visits Bar Chart
- `recharts` `BarChart` with `ResponsiveContainer` (height: 250px)
- Bar fill: `var(--vb-accent)` with `radius={[4, 4, 0, 0]}`
- XAxis: date labels (format: `MM/DD`), tick every ~5 days
- YAxis: count
- Tooltip: date + count
- Empty state: "No visit data yet" centered text
- Wrapped in white card with title "Daily Visits (Last 30 Days)"

#### C) Demo Login Log Table
- Columns: Timestamp | Country | Turnstile | Login Result
- Timestamp: formatted as `YYYY-MM-DD HH:mm`
- Country: 2-letter code or "—"
- Turnstile: green check or red X icon
- Login: green check or red X icon
- Pagination: Previous/Next buttons + "Page X of Y" (25 per page)
- Empty state: "No demo login attempts yet"
- Wrapped in white card with title "Demo Login Log"

#### D) Prune Section
- White card with warning styling
- Text: "Delete all analytics records older than 90 days"
- Button: `text-red-600 border-red-200 hover:bg-red-50` — "Prune Old Records"
- Confirm via `window.confirm()` before calling DELETE
- After success: show toast "Deleted N visit(s) and M demo login(s)" + refetch data
- Loading state: button disabled + "Pruning…" text

**States:** loading (skeleton), error (toast), empty (individual section messages), populated

**Responsive:**
- Mobile (375px): KPI grid 2 cols, chart full width, table horizontal scroll
- Tablet (768px): KPI grid 2 cols, same
- Desktop (1440px): KPI grid 4 cols

## Files to Modify

### `nextjs/components/superadmin/types.ts`
- Change `TabType = 'projects' | 'users' | 'config'` to `'projects' | 'users' | 'config' | 'analytics'`

### `nextjs/components/superadmin/SuperAdminModal.tsx`
- Import `AnalyticsTab` and `BarChart3` icon from `lucide-react`
- Add 4th tab button in the tab navigation bar
- Add `activeTab === 'analytics'` branch in the tab content area rendering `<AnalyticsTab />`

### `nextjs/components/superadmin/index.ts`
- Export `AnalyticsTab` if other components are exported from barrel file

## Landing Page Visit Tracking (Client-side)
The landing page needs to fire `POST /api/analytics/visit` on mount. This is a tiny addition:

### `nextjs/app/page.tsx` (or the landing page component)
- Add a `useEffect` that fires once on mount:
  ```ts
  useEffect(() => {
    fetch('/api/analytics/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: window.location.pathname }),
    }).catch(() => {}); // fire-and-forget
  }, []);
  ```
- No loading state, no error handling — completely silent

## Design Specifications

### KPI Cards
- Container: `bg-white rounded-xl border border-slate-200 p-4`
- Icon: `w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400`
- Value: `text-2xl font-bold text-slate-800 font-mono`
- Label: `text-xs font-semibold text-slate-400 uppercase tracking-[0.1em]`

### Bar Chart
- Container: `bg-white rounded-xl border border-slate-200 p-5`
- Title: `text-base font-semibold text-slate-800 mb-4`
- Bar: fill `var(--vb-accent)`, hover fill slightly lighter
- Axis: `text-xs text-slate-400`

### Demo Log Table
- Container: `bg-white rounded-xl border border-slate-200`
- Header row: `bg-slate-50 text-xs font-semibold text-slate-500 uppercase`
- Body rows: `text-sm text-slate-700`, alternating hover `hover:bg-slate-50`
- Boolean cells: green `CheckCircle` / red `XCircle` icons (w-4 h-4)
- Pagination: `text-sm text-slate-600`, buttons `px-3 py-1.5 border rounded-lg`

### Prune Section
- Container: `bg-white rounded-xl border border-slate-200 p-5`
- Button: `px-4 py-2 text-sm font-medium border border-red-200 text-red-600 rounded-lg hover:bg-red-50`

## Implementation Order
1. Update `types.ts` — add `'analytics'` to `TabType`
2. Create `AnalyticsTab.tsx` — full component with KPI, chart, table, prune
3. Update `SuperAdminModal.tsx` — add tab button + render `AnalyticsTab`
4. Update landing page — add visit tracking `useEffect`
5. Update `index.ts` barrel export if needed

## Checklist
- [ ] `TabType` extended with `'analytics'`
- [ ] `AnalyticsTab` component created with all 4 sections (KPI, chart, table, prune)
- [ ] `AnalyticsTab` fetches data from `GET /api/admin/analytics` using `apiFetch`
- [ ] KPI cards display all 4 metrics
- [ ] Daily visits bar chart uses `recharts BarChart` (last 30 days)
- [ ] Demo log table is paginated (25 per page)
- [ ] Prune button calls `DELETE /api/admin/analytics/prune` with confirmation
- [ ] Prune shows toast with deleted counts + refetches data
- [ ] `SuperAdminModal` has 4th Analytics tab button with `BarChart3` icon
- [ ] Tab content renders `AnalyticsTab` when analytics tab is active
- [ ] Landing page fires `POST /api/analytics/visit` on mount (fire-and-forget)
- [ ] Loading skeleton shown while data fetches
- [ ] Empty states for chart and table
- [ ] Responsive: 2-col KPI on mobile, 4-col on desktop
- [ ] TypeScript compiles cleanly
- [ ] Commit with: `feat(PROJ-23): Implement frontend for CR-28 visit analytics`
