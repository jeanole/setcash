'use client';

import { useState, type FormEvent } from 'react';
import { signIn } from 'next-auth/react';

// ---------------------------------------------------------------------------
// Error message mapping — NextAuth error codes → user-friendly strings
// ---------------------------------------------------------------------------

function mapError(code: string | undefined): string {
  switch (code) {
    case 'CredentialsSignin':
      return 'Invalid email or password.';
    case 'OAuthAccountNotLinked':
      return 'Please use Google to sign in for this account.';
    case 'AccessDenied':
      return 'Account not active. Please contact your administrator.';
    default:
      return 'An error occurred. Please try again.';
  }
}

// ---------------------------------------------------------------------------
// Google "G" SVG logo (standard branding)
// ---------------------------------------------------------------------------

function GoogleLogo() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="w-5 h-5"
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Spinner SVG for loading state
// ---------------------------------------------------------------------------

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4 text-white"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// LoginForm — main export
// ---------------------------------------------------------------------------

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Animation base style helper
  function rise(durationMs: number, delayMs: number): React.CSSProperties {
    return {
      animation: `vb-rise ${durationMs}ms ease-out both`,
      animationDelay: `${delayMs}ms`,
    };
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(mapError(result.error));
      } else if (result?.ok) {
        // Session verified — navigate to dashboard
        window.location.href = '/dashboard';
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setGoogleLoading(true);
    try {
      await signIn('google', { callbackUrl: '/dashboard' });
    } finally {
      setGoogleLoading(false);
    }
  }

  const isDisabled = loading || googleLoading;

  return (
    <>
      {/* Logo area */}
      <div className="flex flex-col items-center mb-6">
        {/* Monogram */}
        <div
          className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-white text-lg font-bold mb-3"
          style={rise(300, 300)}
          aria-hidden="true"
        >
          vB
        </div>

        {/* Product name */}
        <h1
          className="text-2xl font-bold text-slate-800"
          style={rise(300, 450)}
        >
          vBudget
        </h1>

        {/* Subtitle */}
        <p
          className="text-sm text-slate-500 mt-1"
          style={rise(300, 500)}
        >
          Expense Tracker
        </p>
      </div>

      {/* Credentials form */}
      <form onSubmit={handleSubmit} noValidate aria-label="Sign in form">
        {/* Email field */}
        <div className="mb-4" style={rise(300, 700)}>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isDisabled}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:bg-white disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ boxShadow: 'none' }}
            onFocus={(e) =>
              (e.currentTarget.style.boxShadow = 'var(--vb-ring)')
            }
            onBlur={(e) => (e.currentTarget.style.boxShadow = 'none')}
            placeholder="you@example.com"
            aria-required="true"
          />
        </div>

        {/* Password field */}
        <div className="mb-4" style={rise(300, 780)}>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isDisabled}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:bg-white disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ boxShadow: 'none' }}
            onFocus={(e) =>
              (e.currentTarget.style.boxShadow = 'var(--vb-ring)')
            }
            onBlur={(e) => (e.currentTarget.style.boxShadow = 'none')}
            placeholder="••••••••"
            aria-required="true"
          />
        </div>

        {/* Inline error message */}
        {error && (
          <div
            role="alert"
            aria-live="polite"
            className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-2 mb-3"
            style={{
              animation: 'vb-rise 200ms ease-out both',
            }}
          >
            {error}
          </div>
        )}

        {/* Submit button */}
        <div style={rise(300, 860)}>
          <button
            type="submit"
            disabled={isDisabled}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-2.5 text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            aria-busy={loading}
          >
            {loading ? (
              <>
                <Spinner />
                Signing in…
              </>
            ) : (
              'Sign in'
            )}
          </button>
        </div>
      </form>

      {/* Divider + Google button */}
      <div style={rise(300, 940)}>
        {/* Divider */}
        <div className="relative my-5">
          <hr className="border-slate-200" />
          <span className="absolute left-1/2 -translate-x-1/2 -top-2.5 bg-white px-2 text-xs text-slate-400">
            or
          </span>
        </div>

        {/* Google sign-in button */}
        <button
          type="button"
          onClick={handleGoogle}
          disabled={isDisabled}
          className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg py-2.5 text-sm font-medium text-slate-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          aria-busy={googleLoading}
        >
          {googleLoading ? (
            <>
              <svg
                className="animate-spin h-4 w-4 text-slate-500"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Signing in with Google…
            </>
          ) : (
            <>
              <GoogleLogo />
              Sign in with Google
            </>
          )}
        </button>
      </div>
    </>
  );
}
