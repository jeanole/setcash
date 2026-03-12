import { Suspense } from 'react';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import LoginForm from '@/components/auth/LoginForm';

export const metadata = {
  title: 'vBudget — Your receipts deserve better than a shoebox',
};

// ---------------------------------------------------------------------------
// Decorative receipt SVG — floats in the background
// ---------------------------------------------------------------------------
function ReceiptDoodle({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      className={className}
      style={style}
      width="120"
      height="160"
      viewBox="0 0 120 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M10 0h100v148l-8 6-8-6-8 6-8-6-8 6-8-6-8 6-8-6-8 6-8-6-8 6-8-6V0z"
        fill="currentColor"
        opacity="0.06"
      />
      <line x1="28" y1="32" x2="92" y2="32" stroke="currentColor" opacity="0.1" strokeWidth="2" />
      <line x1="28" y1="48" x2="80" y2="48" stroke="currentColor" opacity="0.08" strokeWidth="2" />
      <line x1="28" y1="64" x2="88" y2="64" stroke="currentColor" opacity="0.1" strokeWidth="2" />
      <line x1="28" y1="80" x2="72" y2="80" stroke="currentColor" opacity="0.08" strokeWidth="2" />
      <line x1="28" y1="104" x2="92" y2="104" stroke="currentColor" opacity="0.12" strokeWidth="2.5" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Root page — combined landing + login
// ---------------------------------------------------------------------------
export default async function HomePage() {
  const session = await auth();
  if (session?.user) redirect('/dashboard');

  return (
    <main className="landing-page">
      {/* Background decorations */}
      <div className="landing-bg" aria-hidden="true">
        <ReceiptDoodle
          style={{
            position: 'absolute',
            top: '8%',
            left: '5%',
            transform: 'rotate(-12deg)',
            color: '#c1694f',
            animation: 'landing-float 6s ease-in-out infinite',
          }}
        />
        <ReceiptDoodle
          style={{
            position: 'absolute',
            bottom: '12%',
            right: '8%',
            transform: 'rotate(8deg)',
            color: '#c1694f',
            animation: 'landing-float 7s ease-in-out infinite 1s',
          }}
        />
        <ReceiptDoodle
          style={{
            position: 'absolute',
            top: '45%',
            right: '20%',
            transform: 'rotate(-5deg) scale(0.7)',
            color: '#c1694f',
            animation: 'landing-float 8s ease-in-out infinite 2s',
            opacity: 0.5,
          }}
        />
        {/* Grain overlay */}
        <div className="landing-grain" />
      </div>

      <div className="landing-container">
        {/* ---- LEFT: Hero content ---- */}
        <div className="landing-hero">
          {/* Wordmark */}
          <div className="landing-wordmark" style={{ animation: 'landing-rise 600ms ease-out both' }}>
            <div className="landing-logo-circle" aria-hidden="true">vB</div>
            <span className="landing-logo-text">vBudget</span>
          </div>

          {/* Headline */}
          <h1
            className="landing-headline"
            style={{ animation: 'landing-rise 600ms ease-out both', animationDelay: '100ms' }}
          >
            Your receipts deserve
            <br />
            better than a shoebox.
          </h1>

          {/* Tagline */}
          <p
            className="landing-tagline"
            style={{ animation: 'landing-rise 600ms ease-out both', animationDelay: '200ms' }}
          >
            Track expenses, manage budgets, and stop pretending
            that crumpled paper in your pocket counts as bookkeeping.
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

          {/* Subtle footer */}
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
          <div className="landing-login-card">
            <Suspense>
              <LoginForm allowSignup={process.env.EXTERNAL_REGISTRATION !== 'false'} />
            </Suspense>
          </div>
          <p className="landing-login-aside">
            &ldquo;I wish I&rsquo;d started tracking expenses sooner&rdquo;
            <br />
            <span>— Literally everyone, eventually</span>
          </p>
        </div>
      </div>
    </main>
  );
}
