'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Plus, Loader2 } from 'lucide-react';

interface AddPositionFormProps {
  onAdd: (name: string) => Promise<void>;
}

export default function AddPositionForm({ onAdd }: AddPositionFormProps) {
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || isSubmitting) return;

    setIsSubmitting(true);
    await onAdd(trimmed);
    setIsSubmitting(false);
    setName('');
    setIsExpanded(false);
  };

  const handleCancel = () => {
    setName('');
    setIsExpanded(false);
  };

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[var(--accent)] hover:text-[var(--accent)] hover:bg-indigo-50 rounded-lg transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add Position
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Position name"
        maxLength={50}
        autoFocus
        className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] outline-none"
      />
      <button
        type="submit"
        disabled={!name.trim() || isSubmitting}
        className={cn(
          'inline-flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors',
          !name.trim() || isSubmitting
            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
            : 'bg-[var(--accent)] text-zinc-900 hover:bg-[var(--accent-hover)]'
        )}
      >
        {isSubmitting && <Loader2 className="w-3 h-3 animate-spin" />}
        Add
      </button>
      <button
        type="button"
        onClick={handleCancel}
        disabled={isSubmitting}
        className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
      >
        Cancel
      </button>
    </form>
  );
}
