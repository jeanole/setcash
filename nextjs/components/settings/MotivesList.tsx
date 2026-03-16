'use client';

import { useState, useCallback, useRef } from 'react';
import { Trash2, Plus, Check, X, Lock } from 'lucide-react';
import { Motive } from '@/lib/hooks/useMotives';
import ConfirmationDialog from '@/components/ui/ConfirmationDialog';

interface MotivesListProps {
  motives: Motive[];
  isLoading: boolean;
  onCreate: (name: string, budget: number) => Promise<boolean>;
  onUpdate: (motiveId: string, data: { name?: string; budget?: number }) => Promise<boolean>;
  onDelete: (motiveId: string, name: string) => Promise<boolean>;
}

interface EditingMotive {
  id: string;
  name: string;
  budget: string;
}

interface NewMotive {
  name: string;
  budget: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

export default function MotivesList({
  motives,
  isLoading,
  onCreate,
  onUpdate,
  onDelete,
}: MotivesListProps) {
  const [newMotive, setNewMotive] = useState<NewMotive>({ name: '', budget: '' });
  const [isAdding, setIsAdding] = useState(false);
  const [editing, setEditing] = useState<EditingMotive | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; motive: Motive | null }>({
    isOpen: false,
    motive: null,
  });
  const nameInputRef = useRef<HTMLInputElement>(null);

  const isProtected = (name: string) => name === 'Default';

  const handleAddSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMotive.name.trim()) return;

    const budget = parseFloat(newMotive.budget) || 0;
    const success = await onCreate(newMotive.name.trim(), budget);
    if (success) {
      setNewMotive({ name: '', budget: '' });
      setIsAdding(false);
    }
  }, [newMotive, onCreate]);

  const handleStartEdit = useCallback((motive: Motive) => {
    if (isProtected(motive.name)) return;
    setEditing({
      id: motive.id,
      name: motive.name,
      budget: motive.budget.toString(),
    });
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editing) return;

    const originalMotive = motives.find(m => m.id === editing.id);
    if (!originalMotive) {
      setEditing(null);
      return;
    }

    const updates: { name?: string; budget?: number } = {};
    const newName = editing.name.trim();
    const newBudget = parseFloat(editing.budget);

    // Only include changes
    if (newName && newName !== originalMotive.name) {
      updates.name = newName;
    }
    if (!isNaN(newBudget) && newBudget !== originalMotive.budget) {
      updates.budget = newBudget;
    }

    // If nothing changed, just close editing
    if (Object.keys(updates).length === 0) {
      setEditing(null);
      return;
    }

    const success = await onUpdate(editing.id, updates);
    if (success) {
      setEditing(null);
    }
  }, [editing, motives, onUpdate]);

  const handleCancelEdit = useCallback(() => {
    setEditing(null);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  }, [handleSaveEdit, handleCancelEdit]);

  const handleBudgetKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  }, [handleSaveEdit, handleCancelEdit]);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-slate-100 rounded-md" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {motives.map((motive) => (
          <div
            key={motive.id}
            className={`flex items-center justify-between px-4 py-3 rounded-lg border ${
              isProtected(motive.name)
                ? 'bg-slate-100 border-slate-200'
                : 'bg-slate-50 border-slate-200'
            }`}
          >
            {editing?.id === motive.id ? (
              <div className="flex-1 flex items-center gap-2">
                <input
                  ref={nameInputRef}
                  type="text"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  onKeyDown={handleKeyDown}
                  autoFocus
                  maxLength={100}
                  className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-[var(--vb-accent)]"
                  placeholder="Motive name"
                />
                <input
                  type="number"
                  value={editing.budget}
                  onChange={(e) => setEditing({ ...editing, budget: e.target.value })}
                  onKeyDown={handleBudgetKeyDown}
                  min={0}
                  step={0.01}
                  className="w-28 px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-[var(--vb-accent)]"
                  placeholder="Budget"
                />
                <button
                  onClick={handleSaveEdit}
                  className="p-1 text-green-600 hover:bg-green-50 rounded"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <div className="flex-1 flex items-center gap-2">
                  <div className="flex-1">
                    <button
                      onClick={() => handleStartEdit(motive)}
                      className={`text-left ${
                        isProtected(motive.name)
                          ? 'cursor-default font-medium text-slate-600'
                          : 'cursor-pointer hover:text-[var(--vb-accent)] font-medium text-slate-700'
                      }`}
                      disabled={isProtected(motive.name)}
                    >
                      <div className="flex items-center gap-2">
                        {motive.name}
                        {isProtected(motive.name) && (
                          <Lock className="w-3.5 h-3.5 text-slate-400" />
                        )}
                      </div>
                    </button>
                    <p className="text-xs text-slate-500">{motive.billCount} bill(s)</p>
                  </div>
                  <button
                    onClick={() => !isProtected(motive.name) && handleStartEdit(motive)}
                    disabled={isProtected(motive.name)}
                    className={`text-sm ${
                      isProtected(motive.name)
                        ? 'text-slate-400 cursor-default'
                        : 'text-slate-600 hover:text-[var(--vb-accent)] cursor-pointer'
                    }`}
                  >
                    {formatCurrency(motive.budget)}
                  </button>
                </div>
                {!isProtected(motive.name) && (
                  <button
                    onClick={() => setDeleteDialog({ isOpen: true, motive })}
                    className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors ml-2"
                    title="Delete motive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </>
            )}
          </div>
        ))}

        {/* Add Motive Form */}
        {isAdding ? (
          <form onSubmit={handleAddSubmit} className="flex items-center gap-2 px-4 py-3">
            <input
              type="text"
              value={newMotive.name}
              onChange={(e) => setNewMotive({ ...newMotive, name: e.target.value })}
              placeholder="Motive name"
              maxLength={100}
              autoFocus
              className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--vb-accent)]"
            />
            <input
              type="number"
              value={newMotive.budget}
              onChange={(e) => setNewMotive({ ...newMotive, budget: e.target.value })}
              placeholder="Budget (€)"
              min={0}
              step={0.01}
              className="w-28 px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--vb-accent)]"
            />
            <button
              type="submit"
              disabled={!newMotive.name.trim()}
              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAdding(false);
                setNewMotive({ name: '', budget: '' });
              }}
              className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 w-full px-4 py-3 text-sm font-medium text-[var(--vb-accent)] bg-[var(--vb-accent-light)] rounded-lg border border-dashed border-[var(--vb-accent)] hover:bg-[rgba(250,204,21,0.14)] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Motive
          </button>
        )}
      </div>

      {/* Delete Confirmation */}
      <ConfirmationDialog
        isOpen={deleteDialog.isOpen}
        title="Delete Motive"
        message={
          deleteDialog.motive
            ? `Delete motive "${deleteDialog.motive.name}"? ${deleteDialog.motive.billCount > 0 ? `This motive is used by ${deleteDialog.motive.billCount} bill(s).` : ''} This action cannot be undone.`
            : ''
        }
        onConfirm={async () => {
          if (deleteDialog.motive) {
            await onDelete(deleteDialog.motive.id, deleteDialog.motive.name);
            setDeleteDialog({ isOpen: false, motive: null });
          }
        }}
        onCancel={() => setDeleteDialog({ isOpen: false, motive: null })}
        confirmText="Delete"
        isDestructive
      />
    </>
  );
}
