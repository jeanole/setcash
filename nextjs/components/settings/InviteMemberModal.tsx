'use client';

import { useState, useCallback } from 'react';
import { X, UserPlus } from 'lucide-react';
import { Position } from '@/lib/hooks/usePositions';

interface InviteMemberModalProps {
  isOpen: boolean;
  positions: Position[];
  currentUserRole: 'user' | 'admin' | 'owner' | 'superadmin';
  onClose: () => void;
  onInvite: (email: string, role: string, positionId?: string) => Promise<boolean>;
}

const ROLES = [
  { value: 'user', label: 'User' },
  { value: 'admin', label: 'Admin' },
  { value: 'owner', label: 'Owner' },
];

export default function InviteMemberModal({
  isOpen,
  positions,
  currentUserRole,
  onClose,
  onInvite,
}: InviteMemberModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('user');
  const [positionId, setPositionId] = useState('none');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canInviteOwner = currentUserRole === 'owner' || currentUserRole === 'superadmin';

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);

    const success = await onInvite(
      email.trim(),
      role,
      positionId === 'none' ? undefined : positionId
    );

    setIsLoading(false);

    if (success) {
      setEmail('');
      setRole('user');
      setPositionId('none');
      onClose();
    }
  }, [email, role, positionId, onInvite, onClose]);

  const handleClose = useCallback(() => {
    setEmail('');
    setRole('user');
    setPositionId('none');
    setError(null);
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-md bg-white rounded-lg shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Invite Member</h2>
          <button
            onClick={handleClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-md">
              <p className="text-sm text-rose-600">{error}</p>
            </div>
          )}

          <div>
            <label htmlFor="invite-email" className="block text-sm font-medium text-slate-700 mb-1">
              Email <span className="text-rose-500">*</span>
            </label>
            <input
              type="email"
              id="invite-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <p className="mt-1 text-xs text-slate-500">
              User must already have an account to be invited
            </p>
          </div>

          <div>
            <label htmlFor="invite-role" className="block text-sm font-medium text-slate-700 mb-1">
              Role
            </label>
            <select
              id="invite-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value} disabled={r.value === 'owner' && !canInviteOwner}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="invite-position" className="block text-sm font-medium text-slate-700 mb-1">
              Position
            </label>
            <select
              id="invite-position"
              value={positionId}
              onChange={(e) => setPositionId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="none">— None —</option>
              {positions.map((pos) => (
                <option key={pos.id} value={pos.id}>
                  {pos.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-slate-700 bg-slate-100 rounded-md font-medium hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              {isLoading ? 'Inviting...' : 'Invite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
