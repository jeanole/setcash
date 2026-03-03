import { getCurrentUser } from '@/lib/auth/session';
import SignOutButton from '@/components/auth/SignOutButton';

interface HeaderProps {
  title?: string;
}

// ---------------------------------------------------------------------------
// Header — server component
// Shows authenticated user's initials avatar, email, and sign-out button
// ---------------------------------------------------------------------------

export default async function Header({ title }: HeaderProps) {
  const user = await getCurrentUser();

  // Derive initials from email (first character, uppercase)
  const initials = user?.email
    ? user.email.charAt(0).toUpperCase()
    : '?';

  return (
    <header
      className="h-14 border-b border-slate-200 bg-white flex items-center px-4 md:px-6 shrink-0 shadow-sm"
      aria-label="Page header"
    >
      {/* Page title */}
      <h1 className="text-base font-semibold text-slate-800">
        {title ?? 'vBudget'}
      </h1>

      {/* User info + sign-out */}
      <div className="ml-auto flex items-center gap-3">
        {user ? (
          <>
            {/* Email — hidden on mobile */}
            <span
              className="hidden md:block text-xs text-slate-500 max-w-[160px] truncate"
              title={user.email}
            >
              {user.email}
            </span>

            {/* Initials avatar */}
            <div
              className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-semibold shrink-0"
              aria-label={`Signed in as ${user.email}`}
              role="img"
            >
              {initials}
            </div>

            {/* Sign-out button */}
            <SignOutButton />
          </>
        ) : (
          /* Fallback avatar if no session (edge case) */
          <div
            className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 text-sm font-semibold"
            aria-label="User avatar"
            role="img"
          >
            ?
          </div>
        )}
      </div>
    </header>
  );
}
