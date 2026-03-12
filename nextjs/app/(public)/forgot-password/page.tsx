'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (res.status === 429) {
        setError('Too many requests. Please try again in a few minutes.');
        return;
      }

      // Always show success (no user enumeration)
      setSent(true);
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#020617' }}>
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8">
        {/* Header */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-full bg-indigo-500 flex items-center justify-center text-white text-lg font-bold mb-3">
            vB
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Reset Password</h1>
          <p className="text-sm text-slate-500 mt-1">
            Enter your email to receive a reset link
          </p>
        </div>

        {sent ? (
          <div className="text-center">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 mb-4">
              <p className="text-sm text-emerald-700">
                If an account exists with that email, a reset link has been sent. Check your inbox.
              </p>
            </div>
            <Link
              href="/"
              className="text-sm text-indigo-500 hover:text-indigo-600 font-medium"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-4">
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:bg-white disabled:opacity-60 disabled:cursor-not-allowed"
                placeholder="you@example.com"
              />
            </div>

            {error && (
              <div
                role="alert"
                className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>

            <div className="text-center mt-4">
              <Link
                href="/"
                className="text-sm text-indigo-500 hover:text-indigo-600 font-medium"
              >
                Back to sign in
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
