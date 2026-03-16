import { Suspense } from 'react';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import LoginForm from '@/components/auth/LoginForm';

export const metadata = {
  title: 'SetCash — Not a startup. Just a curious dude with WiFi.',
};

// ---------------------------------------------------------------------------
// Root page — yellow editorial landing + login
// ---------------------------------------------------------------------------
export default async function HomePage() {
  const session = await auth();
  if (session?.user) redirect('/dashboard');

  return (
    <main className="lp">
      <div className="lp-inner">

        {/* ── Top-left wordmark ── */}
        <header className="lp-header">
          <div className="lp-wordmark">
            <span className="lp-wordmark-name">SetCash</span>
            <span className="lp-wordmark-sub">Expense Tracker</span>
          </div>
        </header>

        {/* ── Content split ── */}
        <div className="lp-content">

          {/* Left: hero copy */}
          <div className="lp-hero">
            <h1 className="lp-headline">
              Not a startup.<br />
              Just a curious<br />
              dude with wifi.
            </h1>

            <ul className="lp-bullets">
              <li>Not VC-backed. Just vibes and AI agents.</li>
              <li>Built for fun. Used by real people somehow.</li>
              <li>Zero roadmap. Maximum curiosity.</li>
            </ul>
          </div>

          {/* Right: login card */}
          <div className="lp-card-wrapper">
            <div className="lp-card">
              <h2 className="lp-card-title">Sign in — come close</h2>
              <Suspense>
                <LoginForm allowSignup={process.env.EXTERNAL_REGISTRATION !== 'false'} />
              </Suspense>
            </div>
          </div>

        </div>

        {/* ── Footer ── */}
        <footer className="lp-footer">
          <p className="lp-footer-left">
            SetCash is what happens when a tech-offline dude looking for direction figures out what
            building with age-is could be like. For pleasure, out of curiosity, to dissect from real
            life. It evolves though. Turns out accidental utility is still utility.
          </p>
          <p className="lp-footer-right">Free for 90,001 &middot; No commits required</p>
        </footer>

      </div>
    </main>
  );
}
