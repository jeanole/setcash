'use client';

import { useState, useCallback } from 'react';
import { Plus, X } from 'lucide-react';
import RoleBadge from '@/components/ui/RoleBadge';
import { Position } from './types';

type RoleType = 'user' | 'admin' | 'owner';

interface AddMemberFormProps {
  positions: Position[];
  onAdd: (email: string, role: RoleType, positionId: string | null) => Promise<void>;
  onCancel: () => void;
}

export default function AddMemberForm({ positions, onAdd, onCancel }: AddMemberFormProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<RoleType>('user');
  const [positionId, setPositionId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      if (!email.trim()) {
        setError('Email is required');
        return;
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        setError('Please enter a valid email address');
        return;
      }

      setIsLoading(true);
      try {
        await onAdd(email.trim(), role, positionId || null);
        // Reset form on success
        setEmail('');
        setRole('user');
        setPositionId('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add member');
      } finally {
        setIsLoading(false);
      }
    },
    [email, role, positionId, onAdd]
  );

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-slate-800">Add New Member</h4>
        <button
          onClick={onCancel}
          className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded transition-colors"
          aria-label="Cancel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="member-email" className="block text-sm font-medium text-slate-700 mb-1">
            Email <span className="text-rose-500">*</span>
          </label>
          <input
            id="member-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            disabled={isLoading}
          />
          <p className="text-xs text-slate-500 mt-1">Must be an existing user</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Role</label>
          <div className="flex flex-wrap gap-2">
            {(['user', 'admin', 'owner'] as RoleType[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`transition-all ${role === r ? 'ring-2 ring-offset-1 ring-indigo-500' : ''}`}
              >
                <RoleBadge role={r} />
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="member-position" className="block text-sm font-medium text-slate-700 mb-1">
            Position (optional)
          </label>
          <select
            id="member-position"
            value={positionId}
            onChange={(e) => setPositionId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white"
            disabled={isLoading}
          >
            <option value="">— Select Position —</option>
            {positions.map((pos) => (
              <option key={pos.id} value={pos.id}>
                {pos.name}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors text-sm disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading || !email.trim()}
            className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg transition-colors hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 text-sm"
          >
            {isLoading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Adding...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Add Member
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
