import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import LoginForm from '@/components/auth/LoginForm';

// ---------------------------------------------------------------------------
// Root page — combined landing + login entry point
// Authenticated users are redirected to /dashboard immediately.
// ---------------------------------------------------------------------------

export const metadata = {
  title: 'vBudget — Track expenses, manage budgets',
};

export default async function HomePage() {
  const session = await auth();
  if (session?.user) redirect('/dashboard');

  return (
    <main
      className="min-h-screen flex items-center justify-center p-4 lg:p-8"
      style={{
        backgroundColor: '#020617', // slate-950
        backgroundImage: [
          'radial-gradient(900px 600px at 10% -10%, rgba(99, 102, 241, 0.18), transparent 60%)',
          'radial-gradient(700px 500px at 110% 110%, rgba(16, 185, 129, 0.12), transparent 55%)',
        ].join(', '),
        backgroundAttachment: 'fixed',
        animation: 'vb-rise 400ms ease-out both',
      }}
      aria-label="Welcome to vBudget"
    >
      <div className="w-full max-w-6xl mx-auto flex flex-col lg:flex-row lg:items-center lg:gap-16">

        {/* ----------------------------------------------------------------
            LEFT COLUMN — branding + feature highlights
            Visible at top on mobile, left panel on desktop
        ---------------------------------------------------------------- */}
        <div
          className="flex-1 mb-8 lg:mb-0 flex flex-col items-center lg:items-start text-center lg:text-left"
          style={{ animation: 'vb-rise 500ms ease-out both', animationDelay: '100ms' }}
        >
          {/* Wordmark */}
          <div className="mb-4 flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold flex-shrink-0"
              style={{ backgroundColor: '#6366f1' }}
              aria-hidden="true"
            >
              vB
            </div>
            <span
              className="text-4xl font-bold tracking-tight"
              style={{ color: '#ffffff' }}
            >
              vBudget
            </span>
          </div>

          {/* Tagline */}
          <p
            className="text-lg mb-10 max-w-md"
            style={{ color: '#cbd5e1' /* slate-300 */ }}
          >
            Track expenses. Manage budgets. Simplify reimbursements.
          </p>

          {/* Feature highlights */}
          <ul className="space-y-5 w-full max-w-md" aria-label="Product features">

            {/* Feature 1 — Receipt scanning */}
            <li className="flex items-start gap-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                aria-hidden="true"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-5 h-5"
                  style={{ color: '#818cf8' /* indigo-400 */ }}
                  aria-hidden="true"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="9" y1="13" x2="15" y2="13" />
                  <line x1="9" y1="17" x2="12" y2="17" />
                </svg>
              </div>
              <div>
                <p className="font-semibold" style={{ color: '#ffffff' }}>
                  Receipt scanning with AI analysis
                </p>
                <p className="text-sm mt-0.5" style={{ color: '#94a3b8' /* slate-400 */ }}>
                  Upload photos of receipts and let AI extract the details automatically.
                </p>
              </div>
            </li>

            {/* Feature 2 — Budget tracking */}
            <li className="flex items-start gap-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                aria-hidden="true"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-5 h-5"
                  style={{ color: '#818cf8' /* indigo-400 */ }}
                  aria-hidden="true"
                >
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              </div>
              <div>
                <p className="font-semibold" style={{ color: '#ffffff' }}>
                  Multi-project budget tracking
                </p>
                <p className="text-sm mt-0.5" style={{ color: '#94a3b8' }}>
                  Manage budgets across multiple projects with real-time category breakdowns.
                </p>
              </div>
            </li>

            {/* Feature 3 — Team management */}
            <li className="flex items-start gap-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                aria-hidden="true"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-5 h-5"
                  style={{ color: '#818cf8' /* indigo-400 */ }}
                  aria-hidden="true"
                >
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <div>
                <p className="font-semibold" style={{ color: '#ffffff' }}>
                  Team expense management
                </p>
                <p className="text-sm mt-0.5" style={{ color: '#94a3b8' }}>
                  Collaborate with your team — submit, review, and approve expenses together.
                </p>
              </div>
            </li>
          </ul>

          {/* Footer version note */}
          <p
            className="mt-10 text-xs"
            style={{ color: '#475569' /* slate-600 */ }}
          >
            v2.0 · Next.js
          </p>
        </div>

        {/* ----------------------------------------------------------------
            RIGHT COLUMN — login card
            Centered on mobile, right panel on desktop
        ---------------------------------------------------------------- */}
        <div
          className="w-full lg:w-auto lg:flex-shrink-0"
          style={{ animation: 'vb-rise 500ms ease-out both', animationDelay: '200ms' }}
        >
          <div
            className="bg-white/95 backdrop-blur-sm rounded-2xl p-8 w-full lg:w-96"
            style={{
              boxShadow: 'var(--vb-shadow-xl)',
            }}
          >
            <LoginForm />
          </div>
        </div>

      </div>
    </main>
  );
}
