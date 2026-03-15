'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Copy, Check, AlertTriangle, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiFetch } from './useSuperAdminApi';

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserCreated: () => void;
}

type Step = 'form' | 'display';

function generateSecurePassword(): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const all = uppercase + lowercase + digits;

  // Guarantee at least one of each required character type
  const chars: string[] = [
    uppercase[Math.floor(Math.random() * uppercase.length)],
    lowercase[Math.floor(Math.random() * lowercase.length)],
    digits[Math.floor(Math.random() * digits.length)],
  ];

  // Fill remaining 13 chars from full set
  for (let i = 3; i < 16; i++) {
    chars.push(all[Math.floor(Math.random() * all.length)]);
  }

  // Shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}

export default function CreateUserModal({ isOpen, onClose, onUserCreated }: CreateUserModalProps) {
  const [step, setStep] = useState<Step>('form');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [copied, setCopied] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep('form');
      setEmail('');
      setPassword('');
      setIsSuperAdmin(false);
      setIsLoading(false);
      setError(null);
      setGeneratedPassword('');
      setCopied(false);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleClose = useCallback(() => {
    setStep('form');
    setEmail('');
    setPassword('');
    setIsSuperAdmin(false);
    setIsLoading(false);
    setError(null);
    setGeneratedPassword('');
    setCopied(false);
    onClose();
  }, [onClose]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side email validation
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Email is required.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    const autoGenerate = password.trim() === '';
    const finalPassword = autoGenerate ? generateSecurePassword() : password;

    setIsLoading(true);
    try {
      await apiFetch<{ ok: boolean; id: string }>('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          email: trimmedEmail,
          password: finalPassword,
          isSuperAdmin,
        }),
      });

      if (autoGenerate) {
        setGeneratedPassword(finalPassword);
        setStep('display');
      } else {
        handleClose();
        onUserCreated();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setIsLoading(false);
    }
  }, [email, password, isSuperAdmin, handleClose, onUserCreated]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(generatedPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  }, [generatedPassword]);

  const handleCloseDisplay = useCallback(() => {
    handleClose();
    onUserCreated();
  }, [handleClose, onUserCreated]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70 animate-[fadeIn_0.15s_ease-out]"
      onClick={(e) => {
        if (e.target === e.currentTarget && step === 'form') {
          handleClose();
        }
      }}
    >
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden animate-[scaleIn_0.15s_ease-out]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-100">
              <UserPlus className="w-4 h-4 text-[var(--vb-accent)]" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800">
              {step === 'form' ? 'Create User' : 'User Created'}
            </h3>
          </div>
          <button
            onClick={step === 'form' ? handleClose : handleCloseDisplay}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {step === 'form' ? (
            <form id="create-user-form" onSubmit={handleSubmit} noValidate>
              <div className="space-y-4">
                {/* Email field */}
                <div>
                  <label
                    htmlFor="create-user-email"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    Email <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="create-user-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--vb-accent)]/30 focus:border-[var(--vb-accent)] transition-colors"
                    placeholder="user@example.com"
                    autoComplete="email"
                    autoFocus
                  />
                </div>

                {/* Password field */}
                <div>
                  <label
                    htmlFor="create-user-password"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    Password
                  </label>
                  <input
                    id="create-user-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--vb-accent)]/30 focus:border-[var(--vb-accent)] transition-colors"
                    placeholder="Leave empty to auto-generate"
                    autoComplete="new-password"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    If left empty, a secure 16-character password will be generated and shown once.
                  </p>
                </div>

                {/* Super Admin checkbox */}
                <div className="flex items-center gap-3">
                  <input
                    id="create-user-superadmin"
                    type="checkbox"
                    checked={isSuperAdmin}
                    onChange={(e) => setIsSuperAdmin(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-[var(--vb-accent)] focus:ring-[var(--vb-accent)]/30 cursor-pointer"
                  />
                  <label
                    htmlFor="create-user-superadmin"
                    className="text-sm font-medium text-slate-700 cursor-pointer"
                  >
                    Grant Super Admin privileges
                  </label>
                </div>

                {/* Inline error */}
                {error && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700">
                    {error}
                  </div>
                )}
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">
                  Copy this password now. It will not be shown again.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Generated Password
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={generatedPassword}
                    readOnly
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-mono text-sm focus:outline-none"
                    onFocus={(e) => e.target.select()}
                  />
                  <button
                    onClick={handleCopy}
                    className={cn(
                      'px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2',
                      copied
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-[var(--vb-accent)] text-white hover:bg-[var(--vb-accent-hover)]'
                    )}
                    aria-label="Copy password to clipboard"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
          {step === 'form' ? (
            <>
              <button
                type="button"
                onClick={handleClose}
                disabled={isLoading}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="create-user-form"
                disabled={isLoading}
                className="px-4 py-2 bg-[var(--vb-accent)] text-white font-medium rounded-lg transition-colors hover:bg-[var(--vb-accent-hover)] disabled:opacity-50 flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
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
                    Creating...
                  </>
                ) : (
                  'Create User'
                )}
              </button>
            </>
          ) : (
            <button
              onClick={handleCloseDisplay}
              className="px-4 py-2 bg-[var(--vb-accent)] text-white font-medium rounded-lg transition-colors hover:bg-[var(--vb-accent-hover)]"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
