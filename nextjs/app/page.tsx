import { Suspense } from 'react';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import LoginForm from '@/components/auth/LoginForm';
import SparkleEffect from '@/components/auth/SparkleEffect';

export const metadata = {
  title: 'SetCash — Your receipts deserve better than a shoebox',
};

// ---------------------------------------------------------------------------
// Root page — combined landing + login, dark neon chaos theme
// ---------------------------------------------------------------------------
export default async function HomePage() {
  const session = await auth();
  if (session?.user) redirect('/dashboard');

  return (
    <main className="landing-page">
      {/* ── Turbo blobs ── */}
      <div aria-hidden="true">
        <div className="landing-blob landing-blob-1" />
        <div className="landing-blob landing-blob-2" />
        <div className="landing-blob landing-blob-3" />
        <div className="landing-blob landing-blob-4" />
        <div className="landing-blob landing-blob-5" />
        <div className="landing-blob landing-blob-6" />
        <div className="landing-blob landing-blob-7" />
        <div className="landing-blob landing-blob-8" />
      </div>

      {/* ── Outer orbit ring (15s) ── */}
      <div className="landing-orbit" aria-hidden="true">
        <div className="landing-orbit-dot" />
        <div className="landing-orbit-dot" />
        <div className="landing-orbit-dot" />
        <div className="landing-orbit-dot" />
        <div className="landing-orbit-dot" />
        <div className="landing-orbit-dot" />
        <div className="landing-orbit-dot" />
        <div className="landing-orbit-dot" />
      </div>

      {/* ── Inner orbit ring counter-rotating (8s) ── */}
      <div className="landing-orbit-inner" aria-hidden="true">
        <div className="landing-orbit-dot" />
        <div className="landing-orbit-dot" />
        <div className="landing-orbit-dot" />
        <div className="landing-orbit-dot" />
        <div className="landing-orbit-dot" />
        <div className="landing-orbit-dot" />
      </div>

      {/* ── Sparkle particles (client-side) ── */}
      <SparkleEffect />

      <div className="landing-container">
        {/* ---- LEFT: Hero content ---- */}
        <div className="landing-hero">
          {/* Wordmark */}
          <div className="landing-wordmark" style={{ animation: 'landing-rise 600ms ease-out both' }}>
            <div className="landing-logo-circle" aria-hidden="true">SC</div>
            <span className="landing-logo-text">SetCash</span>
          </div>

          {/* Headline */}
          <h1
            className="landing-headline"
            style={{ animation: 'landing-rise 600ms ease-out both', animationDelay: '100ms' }}
          >
            Track expenses. Manage budgets.
            <br />
            Simplify reimbursements.
          </h1>

          {/* Tagline */}
          <p
            className="landing-tagline"
            style={{ animation: 'landing-rise 600ms ease-out both', animationDelay: '200ms' }}
          >
            Stop pretending that crumpled paper in your pocket counts as bookkeeping.
            Your receipts deserve better than a shoebox.
          </p>

          {/* Feature pills */}
          <div
            className="landing-features"
            style={{ animation: 'landing-rise 600ms ease-out both', animationDelay: '350ms' }}
          >
            <div className="landing-feature">
              <span className="landing-feature-icon">&#128247;</span>
              <div>
                <p className="landing-feature-title">AI receipt scanning</p>
                <p className="landing-feature-desc">
                  Photograph it, forget it. Our AI reads receipts
                  better than you ever did.
                </p>
              </div>
            </div>

            <div className="landing-feature">
              <span className="landing-feature-icon">&#128200;</span>
              <div>
                <p className="landing-feature-title">Multi-project budgets</p>
                <p className="landing-feature-desc">
                  Because &ldquo;I&rsquo;ll track it in my head&rdquo;
                  has never worked for anyone, ever.
                </p>
              </div>
            </div>

            <div className="landing-feature">
              <span className="landing-feature-icon">&#129309;</span>
              <div>
                <p className="landing-feature-title">Team expenses</p>
                <p className="landing-feature-desc">
                  Submit, review, approve. No more chasing
                  colleagues through hallways with forms.
                </p>
              </div>
            </div>
          </div>

          {/* Footer note */}
          <p
            className="landing-footer-note"
            style={{ animation: 'landing-rise 600ms ease-out both', animationDelay: '500ms' }}
          >
            Free for small teams &middot; No credit card required &middot; Yes, it&rsquo;s really that easy
          </p>
        </div>

        {/* ---- RIGHT: Login card ---- */}
        <div
          className="landing-login-wrapper"
          style={{ animation: 'landing-rise 600ms ease-out both', animationDelay: '250ms' }}
        >
          {/* Rainbow gradient animated border wrapper */}
          <div className="landing-card-border">
            <div className="landing-login-card">
              <Suspense>
                <LoginForm allowSignup={process.env.EXTERNAL_REGISTRATION !== 'false'} />
              </Suspense>
            </div>
          </div>
          <p className="landing-login-aside">
            &ldquo;I wish I&rsquo;d started tracking expenses sooner&rdquo;
            &nbsp;&mdash; Literally everyone, eventually
          </p>
        </div>
      </div>
    </main>
  );
}
