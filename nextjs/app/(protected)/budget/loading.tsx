export default function BudgetLoading() {
  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* Header skeleton */}
      <div className="mb-6">
        <div className="h-8 w-48 bg-slate-200 rounded animate-pulse mb-2"></div>
        <div className="h-4 w-96 bg-slate-200 rounded animate-pulse"></div>
      </div>

      {/* Save button skeleton */}
      <div className="flex justify-end mb-4">
        <div className="h-10 w-36 bg-slate-200 rounded-lg animate-pulse"></div>
      </div>

      {/* Legend skeleton */}
      <div className="flex flex-wrap gap-4 mb-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-slate-200 animate-pulse"></div>
            <div className="h-4 w-24 bg-slate-200 rounded animate-pulse"></div>
          </div>
        ))}
      </div>

      {/* Matrix table skeleton */}
      <div className="overflow-auto max-h-[calc(100vh-200px)] border border-slate-200 rounded-lg">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-50">
              {/* Corner header cell */}
              <th className="sticky top-0 left-0 z-20 bg-slate-100 p-3 border-b border-r border-slate-200 min-w-[160px]">
                <div className="h-4 w-32 bg-slate-200 rounded animate-pulse"></div>
              </th>
              {/* Motive column headers */}
              {[...Array(4)].map((_, i) => (
                <th
                  key={i}
                  className="sticky top-0 z-10 bg-slate-50 p-3 border-b border-r border-slate-200 min-w-[140px]"
                >
                  <div className="h-4 w-24 bg-slate-200 rounded animate-pulse mb-2"></div>
                  <div className="h-3 w-16 bg-slate-200 rounded animate-pulse"></div>
                </th>
              ))}
              {/* Total column header */}
              <th className="sticky top-0 right-0 z-20 bg-slate-100 p-3 border-b border-l border-slate-200 min-w-[140px]">
                <div className="h-4 w-16 bg-slate-200 rounded animate-pulse mb-2"></div>
                <div className="h-3 w-20 bg-slate-200 rounded animate-pulse"></div>
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Category rows */}
            {[...Array(5)].map((_, rowIndex) => (
              <tr key={rowIndex}>
                {/* Category name cell */}
                <td className="sticky left-0 z-10 bg-white p-3 border-b border-r border-slate-200 min-w-[160px]">
                  <div className="h-4 w-28 bg-slate-200 rounded animate-pulse mb-2"></div>
                  <div className="h-3 w-20 bg-slate-200 rounded animate-pulse"></div>
                </td>
                {/* Motive cells */}
                {[...Array(4)].map((_, cellIndex) => (
                  <td
                    key={cellIndex}
                    className="p-2 border-b border-r border-slate-200 min-w-[140px]"
                  >
                    <div className="p-2 rounded bg-slate-50">
                      <div className="h-4 w-20 bg-slate-200 rounded animate-pulse mb-2"></div>
                      <div className="flex items-center justify-between">
                        <div className="h-3 w-16 bg-slate-200 rounded animate-pulse"></div>
                        <div className="h-5 w-10 bg-slate-200 rounded-full animate-pulse"></div>
                      </div>
                    </div>
                  </td>
                ))}
                {/* Category total cell */}
                <td className="sticky right-0 z-10 bg-slate-50 p-3 border-b border-l border-slate-200 min-w-[140px]">
                  <div className="h-4 w-20 bg-slate-200 rounded animate-pulse mb-2"></div>
                  <div className="h-3 w-16 bg-slate-200 rounded animate-pulse"></div>
                </td>
              </tr>
            ))}
            {/* Total row */}
            <tr>
              <td className="sticky left-0 bottom-0 z-20 bg-slate-100 p-3 border-t border-r border-slate-200">
                <div className="h-4 w-16 bg-slate-200 rounded animate-pulse"></div>
              </td>
              {[...Array(4)].map((_, i) => (
                <td
                  key={i}
                  className="sticky bottom-0 z-10 bg-slate-100 p-3 border-t border-r border-slate-200"
                >
                  <div className="h-4 w-20 bg-slate-200 rounded animate-pulse mb-2"></div>
                  <div className="h-3 w-16 bg-slate-200 rounded animate-pulse"></div>
                </td>
              ))}
              <td className="sticky right-0 bottom-0 z-30 bg-slate-200 p-3 border-t border-l border-slate-300">
                <div className="h-4 w-24 bg-slate-300 rounded animate-pulse mb-2"></div>
                <div className="h-3 w-20 bg-slate-300 rounded animate-pulse"></div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
