'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';

function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('');
  const [resendEmail, setResendEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Invalid verification link. No token provided.');
      return;
    }

    async function verify() {
      try {
        const res = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const data = await res.json();

        if (!res.ok) {
          setStatus('error');
          setMessage(data.error || 'Verification failed.');
          return;
        }

        setStatus('success');
        setMessage(data.message);
      } catch {
        setStatus('error');
        setMessage('An unexpected error occurred. Please try again.');
      }
    }

    verify();
  }, [token]);

  async function handleResend() {
    if (!resendEmail.trim()) return;
    setResendLoading(true);
    setResendMessage(null);

    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resendEmail }),
      });

      const data = await res.json();

      if (!res.ok) {
        setResendMessage(data.error || 'An error occurred.');
      } else {
        setResendMessage(data.message);
      }
    } catch {
      setResendMessage('An unexpected error occurred.');
    } finally {
      setResendLoading(false);
    }
  }

  if (status === 'verifying') {
    return (
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
          <svg
            className="animate-spin h-4 w-4 text-indigo-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Verifying your email...
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="text-center">
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 mb-4">
          <p className="text-sm text-emerald-700">{message}</p>
        </div>
        <Link
          href="/"
          className="inline-block bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg px-6 py-2.5 text-sm font-semibold transition-colors"
        >
          Sign in
        </Link>
      </div>
    );
  }

  // Error state with resend option
  return (
    <div>
      <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
        <p className="text-sm text-red-700">{message}</p>
      </div>

      <div className="mt-4">
        <p className="text-sm text-slate-600 mb-3">
          Need a new verification link? Enter your email below.
        </p>
        <div className="flex gap-2">
          <input
            type="email"
            value={resendEmail}
            onChange={(e) => setResendEmail(e.target.value)}
            placeholder="you@example.com"
            disabled={resendLoading}
            className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 focus:bg-white disabled:opacity-60"
          />
          <button
            type="button"
            onClick={handleResend}
            disabled={resendLoading || !resendEmail.trim()}
            className="bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {resendLoading ? 'Sending...' : 'Resend'}
          </button>
        </div>
        {resendMessage && (
          <p className="text-xs text-slate-500 mt-2">{resendMessage}</p>
        )}
      </div>

      <div className="text-center mt-4">
        <Link href="/" className="text-sm text-indigo-500 hover:text-indigo-600 font-medium">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#020617' }}>
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8">
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-full bg-indigo-500 flex items-center justify-center text-white text-lg font-bold mb-3">
            vB
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Verify Email</h1>
          <p className="text-sm text-slate-500 mt-1">
            Confirming your email address
          </p>
        </div>

        <Suspense fallback={<div className="text-center text-sm text-slate-500">Loading...</div>}>
          <VerifyEmailForm />
        </Suspense>
      </div>
    </div>
  );
}
