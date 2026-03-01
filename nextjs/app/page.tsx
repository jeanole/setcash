export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 max-w-md w-full text-center">
        {/* Logo / wordmark */}
        <div className="mb-6">
          <span className="text-3xl font-bold text-indigo-600 tracking-tight">
            vBudget
          </span>
          <p className="text-sm text-slate-500 mt-1">expense tracker</p>
        </div>

        {/* Migration notice */}
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-6">
          <p className="text-indigo-800 font-medium text-sm">
            Next.js migration in progress
          </p>
          <p className="text-indigo-600 text-xs mt-1">
            This scaffold is part of PROJ-4. Full feature parity coming soon.
          </p>
        </div>

        {/* Status badges */}
        <div className="flex flex-wrap gap-2 justify-center text-xs">
          <span className="bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-medium">
            Next.js 14
          </span>
          <span className="bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full font-medium">
            Tailwind v4
          </span>
          <span className="bg-violet-100 text-violet-700 px-2.5 py-1 rounded-full font-medium">
            Prisma + PostgreSQL
          </span>
          <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full font-medium">
            TypeScript
          </span>
        </div>

        <p className="text-xs text-slate-400 mt-6">v2.0.0-next</p>
      </div>
    </main>
  );
}
