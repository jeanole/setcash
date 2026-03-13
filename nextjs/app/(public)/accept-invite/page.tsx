'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';

interface InvitationDetails {
  email: string;
  projectName: string;
  invitedBy: string;
  message: string | null;
  userExists: boolean;
}

function AcceptInviteForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoadError('Invalid invitation link.');
      setValidating(false);
      return;
    }

    fetch(`/api/auth/accept-invite?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setLoadError(data.error || 'Invalid invitation.');
        } else {
          setInvitation(data);
        }
      })
      .catch(() => setLoadError('Failed to validate invitation.'))
      .finally(() => setValidating(false));
  }, [token]);

  if (validating) {
    return (
      <div className="text-center text-sm text-slate-500">
        Validating invitation...
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="text-center">
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
          <p className="text-sm text-red-700">{loadError}</p>
        </div>
        <Link
          href="/"
          className="text-sm text-indigo-500 hover:text-indigo-600 font-medium"
        >
          Go to sign in
        </Link>
      </div>
    );
  }

  if (!invitation) return null;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!invitation!.userExists) {
      if (password.length < 8) {
        setError('Password must be at least 8 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          password: invitation!.userExists ? undefined : password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'An error occurred.');
        return;
      }

      setSuccess(true);
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="text-center">
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 mb-4">
          <p className="text-sm text-emerald-700">
            You&apos;ve joined <strong>{invitation.projectName}</strong>! You can now sign in.
          </p>
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

  return (
    <>
      {/* Invitation info */}
      <div className="mb-5">
        <p className="text-sm text-slate-600 text-center">
          <strong>{invitation.invitedBy}</strong> invited you to join
        </p>
        <p className="text-lg font-semibold text-slate-900 text-center mt-1">
          {invitation.projectName}
        </p>
      </div>

      {invitation.message && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 mb-5">
          <p className="text-sm text-slate-600 italic">&ldquo;{invitation.message}&rdquo;</p>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {/* Show email (read-only) */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Email
          </label>
          <input
            type="email"
            value={invitation.email}
            disabled
            className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-600 cursor-not-allowed"
          />
        </div>

        {/* Password fields — only for new users */}
        {!invitation.userExists && (
          <>
            <div className="mb-4">
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
                Create Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:bg-white disabled:opacity-60 disabled:cursor-not-allowed"
                placeholder="At least 8 characters"
                minLength={8}
              />
            </div>

            <div className="mb-4">
              <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-700 mb-1">
                Confirm Password
              </label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:bg-white disabled:opacity-60 disabled:cursor-not-allowed"
                placeholder="Repeat your password"
              />
            </div>
          </>
        )}

        {invitation.userExists && (
          <p className="text-sm text-slate-500 mb-4">
            You already have a SetCash account. Click below to join the project.
          </p>
        )}

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
          {loading
            ? 'Joining...'
            : invitation.userExists
              ? 'Join Project'
              : 'Create Account & Join'}
        </button>
      </form>
    </>
  );
}

export default function AcceptInvitePage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#020617' }}>
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8">
        {/* Header */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-full bg-indigo-500 flex items-center justify-center text-white text-lg font-bold mb-3">
            vB
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Join Project</h1>
        </div>

        <Suspense fallback={<div className="text-center text-sm text-slate-500">Loading...</div>}>
          <AcceptInviteForm />
        </Suspense>
      </div>
    </div>
  );
}
