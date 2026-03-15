'use client';

import { useState, useCallback, useRef } from 'react';
import { Trash2, Plus, Check, X } from 'lucide-react';
import { Position } from '@/lib/hooks/usePositions';
import ConfirmationDialog from '@/components/ui/ConfirmationDialog';

interface PositionsListProps {
  positions: Position[];
  isLoading: boolean;
  onCreate: (name: string) => Promise<boolean>;
  onUpdate: (positionId: string, name: string) => Promise<boolean>;
  onDelete: (positionId: string, name: string) => Promise<boolean>;
}

interface EditingPosition {
  id: string;
  name: string;
}

export default function PositionsList({
  positions,
  isLoading,
  onCreate,
  onUpdate,
  onDelete,
}: PositionsListProps) {
  const [newPositionName, setNewPositionName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editing, setEditing] = useState<EditingPosition | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; position: Position | null }>({
    isOpen: false,
    position: null,
  });
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAddSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPositionName.trim()) return;

    const success = await onCreate(newPositionName.trim());
    if (success) {
      setNewPositionName('');
      setIsAdding(false);
    }
  }, [newPositionName, onCreate]);

  const handleStartEdit = useCallback((position: Position) => {
    setEditing({ id: position.id, name: position.name });
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editing) return;

    if (!editing.name.trim() || editing.name === positions.find(p => p.id === editing.id)?.name) {
      setEditing(null);
      return;
    }

    const success = await onUpdate(editing.id, editing.name.trim());
    if (success) {
      setEditing(null);
    }
  }, [editing, positions, onUpdate]);

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

  const isProtected = (name: string) => name.toLowerCase() === 'misc';

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
        {positions.map((position) => (
          <div
            key={position.id}
            className="flex items-center justify-between px-4 py-3 bg-slate-50 rounded-lg border border-slate-200"
          >
            {editing?.id === position.id ? (
              <div className="flex-1 flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  onKeyDown={handleKeyDown}
                  onBlur={handleSaveEdit}
                  autoFocus
                  maxLength={50}
                  className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-[var(--vb-accent)]"
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
                <div className="flex-1">
                  <button
                    onClick={() => !isProtected(position.name) && handleStartEdit(position)}
                    className={`text-left ${
                      isProtected(position.name)
                        ? 'cursor-default font-medium text-slate-700'
                        : 'cursor-pointer hover:text-[var(--vb-accent)]'
                    }`}
                    disabled={isProtected(position.name)}
                  >
                    {position.name}
                    {isProtected(position.name) && (
                      <span className="ml-2 text-xs text-slate-400">(protected)</span>
                    )}
                  </button>
                  <p className="text-xs text-slate-500">{position.memberCount} member(s)</p>
                </div>
                {!isProtected(position.name) && (
                  <button
                    onClick={() => setDeleteDialog({ isOpen: true, position })}
                    className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Delete position"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </>
            )}
          </div>
        ))}

        {/* Add Position Form */}
        {isAdding ? (
          <form onSubmit={handleAddSubmit} className="flex items-center gap-2 px-4 py-3">
            <input
              type="text"
              value={newPositionName}
              onChange={(e) => setNewPositionName(e.target.value)}
              placeholder="Position name"
              maxLength={50}
              autoFocus
              className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--vb-accent)]"
            />
            <button
              type="submit"
              disabled={!newPositionName.trim()}
              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAdding(false);
                setNewPositionName('');
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
            Add Position
          </button>
        )}
      </div>

      {/* Delete Confirmation */}
      <ConfirmationDialog
        isOpen={deleteDialog.isOpen}
        title="Delete Position"
        message={
          deleteDialog.position
            ? `Delete position "${deleteDialog.position.name}"? Members assigned to this position will become unassigned.`
            : ''
        }
        onConfirm={async () => {
          if (deleteDialog.position) {
            await onDelete(deleteDialog.position.id, deleteDialog.position.name);
            setDeleteDialog({ isOpen: false, position: null });
          }
        }}
        onCancel={() => setDeleteDialog({ isOpen: false, position: null })}
        confirmText="Delete"
        isDestructive
      />
    </>
  );
}
