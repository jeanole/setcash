'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';

// ---------------------------------------------------------------------------
// SignOutButton — inline text button for the Header
// ---------------------------------------------------------------------------

export default function SignOutButton() {
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    try {
      await signOut({ callbackUrl: '/login' });
    } finally {
      // Loading state reset is handled by page navigation after signOut
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={loading}
      className="text-xs text-slate-500 hover:text-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      aria-label="Sign out"
      aria-busy={loading}
    >
      {loading ? (
        <span className="flex items-center gap-1.5">
          <svg
            className="animate-spin h-3 w-3"
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
          Signing out…
        </span>
      ) : (
        'Sign out'
      )}
    </button>
  );
}
