'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Eye, TrendingUp, LogIn, CheckCircle, XCircle } from 'lucide-react';
import { apiFetch, useSuperAdminApi } from './useSuperAdminApi';
import ToastContainer from './ToastContainer';

// ─── Types ───────────────────────────────────────────────────────────────────

interface KpiData {
  totalVisits: number;
  visitsLast7Days: number;
  demoLoginsLast7Days: number;
  demoSuccessRate: number;
}

interface DailyVisit {
  date: string;
  count: number;
}

interface DemoLogItem {
  id: string;
  timestamp: string;
  countryCode: string | null;
  turnstileSuccess: boolean;
  loginSuccess: boolean;
}

interface DemoLog {
  items: DemoLogItem[];
  total: number;
  page: number;
  pageSize: number;
}

interface AnalyticsData {
  kpi: KpiData;
  dailyVisits: DailyVisit[];
  demoLog: DemoLog;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(isoString: string): string {
  const d = new Date(isoString);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function formatChartDate(isoDate: string): string {
  const [, month, day] = isoDate.split('-');
  return `${month}/${day}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface KpiCardProps {
  icon: React.ReactNode;
  value: string;
  label: string;
}

function KpiCard({ icon, value, label }: KpiCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-3">
      <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400">
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-800 font-mono">{value}</p>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-[0.1em] mt-0.5">
          {label}
        </p>
      </div>
    </div>
  );
}

// Skeleton loader
function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`bg-slate-200 rounded animate-pulse ${className ?? ''}`} />;
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <SkeletonBlock className="w-8 h-8" />
            <SkeletonBlock className="h-7 w-20" />
            <SkeletonBlock className="h-3 w-28" />
          </div>
        ))}
      </div>
      {/* Chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <SkeletonBlock className="h-5 w-56 mb-4" />
        <SkeletonBlock className="h-[250px] w-full" />
      </div>
      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-5 border-b border-slate-100">
          <SkeletonBlock className="h-5 w-36" />
        </div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="px-5 py-3 border-b border-slate-100 flex gap-4">
            <SkeletonBlock className="h-4 w-36" />
            <SkeletonBlock className="h-4 w-8" />
            <SkeletonBlock className="h-4 w-8" />
            <SkeletonBlock className="h-4 w-8" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AnalyticsTab() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isPaging, setIsPaging] = useState(false);
  const [isPruning, setIsPruning] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const { toasts, showToast, removeToast, handleApiError } = useSuperAdminApi();

  const fetchAnalytics = useCallback(
    async (page: number = 1, initial = false) => {
      if (initial) setIsInitialLoad(true);
      else setIsPaging(true);
      try {
        const result = await apiFetch<AnalyticsData>(
          `/api/admin/analytics?page=${page}&pageSize=25`
        );
        setData(result);
        setCurrentPage(page);
      } catch (error) {
        handleApiError(error, 'Failed to load analytics');
      } finally {
        setIsInitialLoad(false);
        setIsPaging(false);
      }
    },
    [handleApiError]
  );

  useEffect(() => {
    fetchAnalytics(1, true);
  }, [fetchAnalytics]);

  const handlePrune = useCallback(async () => {
    const confirmed = window.confirm(
      'Delete all analytics records older than 90 days? This cannot be undone.'
    );
    if (!confirmed) return;

    setIsPruning(true);
    try {
      const result = await apiFetch<{ visits: number; demoLogins: number }>(
        '/api/admin/analytics/prune',
        { method: 'DELETE' }
      );
      showToast(
        `Deleted ${result.visits} visit(s) and ${result.demoLogins} demo login(s)`
      );
      await fetchAnalytics(1, true);
    } catch (error) {
      handleApiError(error, 'Failed to prune analytics records');
    } finally {
      setIsPruning(false);
    }
  }, [fetchAnalytics, showToast, handleApiError]);

  if (isInitialLoad) {
    return (
      <>
        <AnalyticsSkeleton />
        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </>
    );
  }

  if (!data) {
    return (
      <>
        <p className="text-sm text-slate-500">Failed to load analytics data.</p>
        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </>
    );
  }

  const { kpi, dailyVisits, demoLog } = data;
  const totalPages = Math.max(1, Math.ceil(demoLog.total / demoLog.pageSize));

  // For XAxis we want to show a tick every ~5 days
  const chartTicks = dailyVisits
    .filter((_, idx) => idx % 5 === 0)
    .map((d) => d.date);

  return (
    <>
      <div className="space-y-6">
        {/* ── A) KPI Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" role="list" aria-label="Analytics KPIs">
          <KpiCard
            icon={<Eye className="w-4 h-4" aria-hidden="true" />}
            value={kpi.totalVisits.toLocaleString()}
            label="Total Visits"
          />
          <KpiCard
            icon={<TrendingUp className="w-4 h-4" aria-hidden="true" />}
            value={kpi.visitsLast7Days.toLocaleString()}
            label="Visits (7d)"
          />
          <KpiCard
            icon={<LogIn className="w-4 h-4" aria-hidden="true" />}
            value={kpi.demoLoginsLast7Days.toLocaleString()}
            label="Demo Logins (7d)"
          />
          <KpiCard
            icon={<CheckCircle className="w-4 h-4" aria-hidden="true" />}
            value={`${kpi.demoSuccessRate}%`}
            label="Success Rate"
          />
        </div>

        {/* ── B) Daily Visits Bar Chart ── */}
        <section
          className="bg-white rounded-xl border border-slate-200 p-5"
          aria-label="Daily visits chart"
        >
          <h3 className="text-base font-semibold text-slate-800 mb-4">
            Daily Visits (Last 30 Days)
          </h3>
          {dailyVisits.length === 0 ? (
            <div className="h-[250px] flex items-center justify-center text-sm text-slate-400">
              No visit data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={dailyVisits} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <XAxis
                  dataKey="date"
                  ticks={chartTicks}
                  tickFormatter={formatChartDate}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                  width={32}
                />
                <Tooltip
                  formatter={(value) => [value, 'Visits']}
                  labelFormatter={(label) =>
                    typeof label === 'string' ? formatChartDate(label) : String(label)
                  }
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                  }}
                />
                <Bar
                  dataKey="count"
                  fill="var(--vb-accent)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </section>

        {/* ── C) Demo Login Log Table ── */}
        <section
          className="bg-white rounded-xl border border-slate-200 overflow-hidden"
          aria-label="Demo login log"
        >
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-base font-semibold text-slate-800">Demo Login Log</h3>
          </div>

          {demoLog.items.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-400">
              No demo login attempts yet
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px]" aria-label="Demo login attempts">
                  <thead>
                    <tr className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase">
                      <th className="px-5 py-3 text-left tracking-wider">Timestamp</th>
                      <th className="px-5 py-3 text-left tracking-wider">Country</th>
                      <th className="px-5 py-3 text-center tracking-wider">Turnstile</th>
                      <th className="px-5 py-3 text-center tracking-wider">Login Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {demoLog.items.map((item) => (
                      <tr
                        key={item.id}
                        className="border-t border-slate-100 hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-5 py-3 text-sm text-slate-700 tabular-nums whitespace-nowrap">
                          {formatDate(item.timestamp)}
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-700 font-mono">
                          {item.countryCode ?? '—'}
                        </td>
                        <td className="px-5 py-3 text-center">
                          {item.turnstileSuccess ? (
                            <CheckCircle
                              className="w-4 h-4 text-emerald-500 inline-block"
                              aria-label="Turnstile passed"
                            />
                          ) : (
                            <XCircle
                              className="w-4 h-4 text-red-400 inline-block"
                              aria-label="Turnstile failed"
                            />
                          )}
                        </td>
                        <td className="px-5 py-3 text-center">
                          {item.loginSuccess ? (
                            <CheckCircle
                              className="w-4 h-4 text-emerald-500 inline-block"
                              aria-label="Login succeeded"
                            />
                          ) : (
                            <XCircle
                              className="w-4 h-4 text-red-400 inline-block"
                              aria-label="Login failed"
                            />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between gap-3">
                <span className="text-sm text-slate-600">
                  Page {currentPage} of {totalPages}
                  {demoLog.total > 0 && (
                    <span className="ml-2 text-slate-400">({demoLog.total} total)</span>
                  )}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => fetchAnalytics(currentPage - 1)}
                    disabled={currentPage <= 1 || isPaging}
                    className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    aria-label="Previous page"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => fetchAnalytics(currentPage + 1)}
                    disabled={currentPage >= totalPages || isPaging}
                    className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    aria-label="Next page"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </section>

        {/* ── D) Prune Section ── */}
        <section
          className="bg-white rounded-xl border border-slate-200 p-5"
          aria-label="Data pruning"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-800">Data Retention</h3>
              <p className="text-sm text-slate-500 mt-0.5">
                Delete all analytics records older than 90 days.
              </p>
            </div>
            <button
              onClick={handlePrune}
              disabled={isPruning}
              className="px-4 py-2 text-sm font-medium border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
              aria-label="Prune records older than 90 days"
            >
              {isPruning ? 'Pruning…' : 'Prune Old Records'}
            </button>
          </div>
        </section>
      </div>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
}
