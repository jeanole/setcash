export default function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-[vb-rise_0.4s_ease-out]">
      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3"
            aria-hidden="true"
          >
            <div className="flex items-center justify-between">
              <div className="h-3 w-24 bg-slate-200 rounded animate-pulse" />
              <div className="h-8 w-8 bg-slate-100 rounded-lg animate-pulse" />
            </div>
            <div className="h-7 w-32 bg-slate-200 rounded animate-pulse" />
            <div className="h-3 w-20 bg-slate-100 rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="bg-white rounded-xl border border-slate-200 shadow-sm p-5"
            aria-hidden="true"
          >
            <div className="h-4 w-40 bg-slate-200 rounded animate-pulse mb-4" />
            <div className="min-h-[300px] bg-slate-50 rounded-lg animate-pulse" />
          </div>
        ))}
      </div>

      {/* Recent bills + quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3"
          aria-hidden="true"
        >
          <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100">
              <div className="space-y-1">
                <div className="h-3 w-24 bg-slate-200 rounded animate-pulse" />
                <div className="h-3 w-16 bg-slate-100 rounded animate-pulse" />
              </div>
              <div className="h-5 w-16 bg-slate-200 rounded animate-pulse" />
            </div>
          ))}
        </div>
        <div
          className="bg-white rounded-xl border border-slate-200 shadow-sm p-5"
          aria-hidden="true"
        >
          <div className="h-4 w-28 bg-slate-200 rounded animate-pulse mb-4" />
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
