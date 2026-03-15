'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { ProjectPosition } from '@/lib/types';
import { Trash2, Check, X, Pencil } from 'lucide-react';

interface PositionRowProps {
  position: ProjectPosition;
  isProtected: boolean;
  onRename: (positionId: string, name: string) => Promise<void>;
  onDelete: (positionId: string) => Promise<void>;
}

export default function PositionRow({
  position,
  isProtected,
  onRename,
  onDelete,
}: PositionRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(position.name);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = () => {
    if (isProtected) return;
    setEditValue(position.name);
    setIsEditing(true);
  };

  const handleSave = async () => {
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === position.name) {
      setIsEditing(false);
      setEditValue(position.name);
      return;
    }

    setIsSaving(true);
    await onRename(position.id, trimmed);
    setIsSaving(false);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(position.name);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  return (
    <div
      className={cn(
        'flex items-center justify-between px-4 py-3 border-b border-slate-100 last:border-b-0',
        !isProtected && 'hover:bg-slate-50'
      )}
    >
      {isEditing ? (
        <div className="flex-1 flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            disabled={isSaving}
            className="flex-1 px-2 py-1 text-sm border border-indigo-300 rounded focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] outline-none"
            maxLength={50}
          />
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
            title="Save"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={handleCancel}
            disabled={isSaving}
            className="p-1 text-slate-400 hover:bg-slate-100 rounded transition-colors"
            title="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-800">{position.name}</span>
            {isProtected && (
              <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">
                Protected
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {!isProtected && (
              <>
                <button
                  onClick={handleStartEdit}
                  className="p-2 text-slate-400 hover:text-[var(--accent)] hover:bg-indigo-50 rounded-lg transition-colors"
                  title="Edit"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDelete(position.id)}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
