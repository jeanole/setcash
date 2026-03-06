'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Copy, Check, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { User } from './types';

interface PasswordResetModalProps {
  isOpen: boolean;
  user: User | null;
  onClose: () => void;
  onConfirmReset: (email: string) => Promise<string>;
}

type Step = 'confirm' | 'display';

export default function PasswordResetModal({
  isOpen,
  user,
  onClose,
  onConfirmReset,
}: PasswordResetModalProps) {
  const [step, setStep] = useState<Step>('confirm');
  const [newPassword, setNewPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep('confirm');
      setNewPassword('');
      setCopied(false);
      setError(null);
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
  }, [isOpen]);

  const handleConfirm = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    setError(null);
    try {
      // Call the API through parent handler
      const password = await onConfirmReset(user.email);
      setNewPassword(password);
      setStep('display');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  }, [user, onConfirmReset]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(newPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  }, [newPassword]);

  const handleClose = useCallback(() => {
    setStep('confirm');
    setNewPassword('');
    setCopied(false);
    setError(null);
    onClose();
  }, [onClose]);

  if (!isOpen || !user) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 animate-[fadeIn_0.15s_ease-out]"
      onClick={(e) => {
        if (e.target === e.currentTarget && step === 'confirm') {
          handleClose();
        }
      }}
    >
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden animate-[scaleIn_0.15s_ease-out]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800">
            {step === 'confirm' ? 'Reset Password' : 'Password Reset Complete'}
          </h3>
          <button
            onClick={handleClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {step === 'confirm' ? (
            <div>
              <p className="text-sm text-slate-600">
                Reset password for <strong>{user.email}</strong>?
              </p>
              <p className="text-sm text-slate-500 mt-2">
                A new secure password will be generated. This action cannot be undone.
              </p>
              {error && (
                <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700">
                  {error}
                </div>
              )}
            </div>
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
                  New Password
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newPassword}
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
                        : 'bg-[#7C6AF6] text-white hover:bg-[#6C5CE7]'
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
          {step === 'confirm' ? (
            <>
              <button
                onClick={handleClose}
                disabled={isLoading}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={isLoading}
                className="px-4 py-2 bg-[#7C6AF6] text-white font-medium rounded-lg transition-colors hover:bg-[#6C5CE7] disabled:opacity-50 flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Processing...
                  </>
                ) : (
                  'Reset Password'
                )}
              </button>
            </>
          ) : (
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-[#7C6AF6] text-white font-medium rounded-lg transition-colors hover:bg-[#6C5CE7]"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
