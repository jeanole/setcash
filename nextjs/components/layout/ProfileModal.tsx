'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, User } from 'lucide-react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: {
    email: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    mobile: string | null;
  };
  onProfileUpdated: (updated: {
    username: string | null;
    firstName: string | null;
    lastName: string | null;
  }) => void;
}

export default function ProfileModal({
  isOpen,
  onClose,
  user,
  onProfileUpdated,
}: ProfileModalProps) {
  // Profile section state
  const [username, setUsername] = useState(user.username ?? '');
  const [firstName, setFirstName] = useState(user.firstName ?? '');
  const [lastName, setLastName] = useState(user.lastName ?? '');
  const [mobile, setMobile] = useState(user.mobile ?? '');
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

  // Password section state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  // Fetch fresh profile data on open
  useEffect(() => {
    if (!isOpen) return;

    async function loadProfile() {
      try {
        const res = await fetch('/api/users/me');
        if (!res.ok) return;
        const data = await res.json();
        setUsername(data.username ?? '');
        setFirstName(data.firstName ?? '');
        setLastName(data.lastName ?? '');
        setMobile(data.mobile ?? '');
      } catch {
        // Silently ignore — fields remain pre-populated from props
      }
    }

    loadProfile();
  }, [isOpen]);

  // Auto-dismiss success banners after 3 seconds
  useEffect(() => {
    if (!profileSuccess) return;
    const timer = setTimeout(() => setProfileSuccess(null), 3000);
    return () => clearTimeout(timer);
  }, [profileSuccess]);

  useEffect(() => {
    if (!passwordSuccess) return;
    const timer = setTimeout(() => setPasswordSuccess(null), 3000);
    return () => clearTimeout(timer);
  }, [passwordSuccess]);

  const handleClose = useCallback(() => {
    setProfileError(null);
    setProfileSuccess(null);
    setPasswordError(null);
    setPasswordSuccess(null);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    onClose();
  }, [onClose]);

  const handleProfileSave = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setProfileError(null);
      setIsProfileLoading(true);

      try {
        const res = await fetch('/api/users/me', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: username.trim() || null,
            firstName: firstName.trim() || null,
            lastName: lastName.trim() || null,
            mobile: mobile.trim() || null,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          if (res.status === 409) {
            setProfileError('This username is already taken. Please choose a different one.');
          } else {
            setProfileError(data.error || 'Failed to save profile');
          }
          return;
        }

        setProfileSuccess('Profile saved successfully.');
        onProfileUpdated({
          username: data.username ?? null,
          firstName: data.firstName ?? null,
          lastName: data.lastName ?? null,
        });
      } catch {
        setProfileError('An unexpected error occurred. Please try again.');
      } finally {
        setIsProfileLoading(false);
      }
    },
    [username, firstName, lastName, mobile, onProfileUpdated]
  );

  const handlePasswordUpdate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setPasswordError(null);

      if (newPassword !== confirmPassword) {
        setPasswordError('New passwords do not match.');
        return;
      }

      if (newPassword.length < 8) {
        setPasswordError('Password must be at least 8 characters long.');
        return;
      }

      if (!/[A-Z]/.test(newPassword)) {
        setPasswordError('Password must contain at least one uppercase letter.');
        return;
      }

      if (!/[a-z]/.test(newPassword)) {
        setPasswordError('Password must contain at least one lowercase letter.');
        return;
      }

      if (!/[0-9]/.test(newPassword)) {
        setPasswordError('Password must contain at least one digit.');
        return;
      }

      setIsPasswordLoading(true);

      try {
        const res = await fetch('/api/users/me/password', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentPassword, newPassword }),
        });

        const data = await res.json();

        if (!res.ok) {
          if (res.status === 401) {
            setPasswordError('Current password is incorrect.');
          } else if (res.status === 400) {
            setPasswordError(data.error || 'Password does not meet requirements.');
          } else {
            setPasswordError(data.error || 'Failed to update password.');
          }
          return;
        }

        setPasswordSuccess('Password updated successfully.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } catch {
        setPasswordError('An unexpected error occurred. Please try again.');
      } finally {
        setIsPasswordLoading(false);
      }
    },
    [currentPassword, newPassword, confirmPassword]
  );

  if (!isOpen) return null;

  const inputClass =
    'w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]';
  const readOnlyInputClass =
    'w-full px-3 py-2 border border-slate-300 rounded-md bg-slate-50 text-slate-400 cursor-not-allowed';
  const primaryBtnClass =
    'px-4 py-2 bg-[var(--accent)] text-zinc-900 rounded-md font-medium hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors';
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1';
  const errorBannerClass =
    'p-3 bg-rose-50 border border-rose-200 rounded-md text-sm text-rose-600';
  const successBannerClass =
    'p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-700';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-modal-title"
    >
      <div className="w-full max-w-lg bg-white rounded-t-lg sm:rounded-lg shadow-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-indigo-500" />
            <h2 id="profile-modal-title" className="text-lg font-semibold text-slate-900">
              Edit Profile
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Close profile modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* ── Section 1: Profile Info ── */}
          <form onSubmit={handleProfileSave} noValidate>
            <h3 className="text-sm font-semibold text-slate-800 mb-4 uppercase tracking-wide">
              Profile Information
            </h3>

            {profileError && (
              <div className={`${errorBannerClass} mb-4`} role="alert">
                {profileError}
              </div>
            )}

            {profileSuccess && (
              <div className={`${successBannerClass} mb-4`} role="status">
                {profileSuccess}
              </div>
            )}

            <div className="space-y-4">
              {/* Email — read-only */}
              <div>
                <label htmlFor="profile-email" className={labelClass}>
                  Email
                </label>
                <input
                  type="email"
                  id="profile-email"
                  value={user.email}
                  disabled
                  className={readOnlyInputClass}
                  aria-readonly="true"
                />
              </div>

              {/* Username */}
              <div>
                <label htmlFor="profile-username" className={labelClass}>
                  Username
                </label>
                <input
                  type="text"
                  id="profile-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="your_username"
                  className={inputClass}
                  autoComplete="username"
                />
              </div>

              {/* First name + Last name side by side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="profile-firstname" className={labelClass}>
                    First Name
                  </label>
                  <input
                    type="text"
                    id="profile-firstname"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Jane"
                    className={inputClass}
                    autoComplete="given-name"
                  />
                </div>
                <div>
                  <label htmlFor="profile-lastname" className={labelClass}>
                    Last Name
                  </label>
                  <input
                    type="text"
                    id="profile-lastname"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe"
                    className={inputClass}
                    autoComplete="family-name"
                  />
                </div>
              </div>

              {/* Mobile */}
              <div>
                <label htmlFor="profile-mobile" className={labelClass}>
                  Mobile
                </label>
                <input
                  type="tel"
                  id="profile-mobile"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="+1 555 000 0000"
                  className={inputClass}
                  autoComplete="tel"
                />
              </div>
            </div>

            <div className="flex justify-end mt-5">
              <button
                type="submit"
                disabled={isProfileLoading}
                className={primaryBtnClass}
              >
                {isProfileLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>

          {/* ── Divider ── */}
          <div className="border-t border-slate-200 mt-6 pt-6">
            {/* ── Section 2: Change Password ── */}
            <form onSubmit={handlePasswordUpdate} noValidate>
              <h3 className="text-sm font-semibold text-slate-800 mb-4 uppercase tracking-wide">
                Change Password
              </h3>

              {passwordError && (
                <div className={`${errorBannerClass} mb-4`} role="alert">
                  {passwordError}
                </div>
              )}

              {passwordSuccess && (
                <div className={`${successBannerClass} mb-4`} role="status">
                  {passwordSuccess}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label htmlFor="profile-current-password" className={labelClass}>
                    Current Password
                  </label>
                  <input
                    type="password"
                    id="profile-current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter your current password"
                    className={inputClass}
                    autoComplete="current-password"
                  />
                </div>

                <div>
                  <label htmlFor="profile-new-password" className={labelClass}>
                    New Password
                  </label>
                  <input
                    type="password"
                    id="profile-new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 8 chars, upper, lower, digit"
                    className={inputClass}
                    autoComplete="new-password"
                  />
                </div>

                <div>
                  <label htmlFor="profile-confirm-password" className={labelClass}>
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    id="profile-confirm-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat your new password"
                    className={inputClass}
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <div className="flex justify-end mt-5">
                <button
                  type="submit"
                  disabled={isPasswordLoading}
                  className={primaryBtnClass}
                >
                  {isPasswordLoading ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
