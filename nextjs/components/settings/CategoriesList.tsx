'use client';

import { useState, useCallback, useRef } from 'react';
import { Trash2, Plus, Check, X, Lock } from 'lucide-react';
import { Category } from '@/lib/hooks/useCategories';
import ConfirmationDialog from '@/components/ui/ConfirmationDialog';

interface CategoriesListProps {
  categories: Category[];
  isLoading: boolean;
  onCreate: (name: string, budget: number) => Promise<boolean>;
  onUpdate: (categoryId: string, data: { name?: string; budget?: number }) => Promise<boolean>;
  onDelete: (categoryId: string, name: string) => Promise<boolean>;
}

interface EditingCategory {
  id: string;
  name: string;
  budget: string;
}

interface NewCategory {
  name: string;
  budget: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

export default function CategoriesList({
  categories,
  isLoading,
  onCreate,
  onUpdate,
  onDelete,
}: CategoriesListProps) {
  const [newCategory, setNewCategory] = useState<NewCategory>({ name: '', budget: '' });
  const [isAdding, setIsAdding] = useState(false);
  const [editing, setEditing] = useState<EditingCategory | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; category: Category | null }>({
    isOpen: false,
    category: null,
  });
  const nameInputRef = useRef<HTMLInputElement>(null);

  const isProtected = (name: string) => name === 'Uncategorized';

  const handleAddSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategory.name.trim()) return;

    const budget = parseFloat(newCategory.budget) || 0;
    const success = await onCreate(newCategory.name.trim(), budget);
    if (success) {
      setNewCategory({ name: '', budget: '' });
      setIsAdding(false);
    }
  }, [newCategory, onCreate]);

  const handleStartEdit = useCallback((category: Category) => {
    if (isProtected(category.name)) return;
    setEditing({
      id: category.id,
      name: category.name,
      budget: category.budget.toString(),
    });
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editing) return;

    const originalCategory = categories.find(c => c.id === editing.id);
    if (!originalCategory) {
      setEditing(null);
      return;
    }

    const updates: { name?: string; budget?: number } = {};
    const newName = editing.name.trim();
    const newBudget = parseFloat(editing.budget);

    // Only include changes
    if (newName && newName !== originalCategory.name) {
      updates.name = newName;
    }
    if (!isNaN(newBudget) && newBudget !== originalCategory.budget) {
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
  }, [editing, categories, onUpdate]);

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
        {categories.map((category) => (
          <div
            key={category.id}
            className={`flex items-center justify-between px-4 py-3 rounded-lg border ${
              isProtected(category.name)
                ? 'bg-slate-100 border-slate-200'
                : 'bg-slate-50 border-slate-200'
            }`}
          >
            {editing?.id === category.id ? (
              <div className="flex-1 flex items-center gap-2">
                <input
                  ref={nameInputRef}
                  type="text"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  onKeyDown={handleKeyDown}
                  autoFocus
                  maxLength={100}
                  className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-[#6366f1]"
                  placeholder="Category name"
                />
                <input
                  type="number"
                  value={editing.budget}
                  onChange={(e) => setEditing({ ...editing, budget: e.target.value })}
                  onKeyDown={handleBudgetKeyDown}
                  min={0}
                  step={0.01}
                  className="w-28 px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-[#6366f1]"
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
                      onClick={() => handleStartEdit(category)}
                      className={`text-left ${
                        isProtected(category.name)
                          ? 'cursor-default font-medium text-slate-600'
                          : 'cursor-pointer hover:text-[#6366f1] font-medium text-slate-700'
                      }`}
                      disabled={isProtected(category.name)}
                    >
                      <div className="flex items-center gap-2">
                        {category.name}
                        {isProtected(category.name) && (
                          <Lock className="w-3.5 h-3.5 text-slate-400" />
                        )}
                      </div>
                    </button>
                    <p className="text-xs text-slate-500">{category.billCount} bill(s)</p>
                  </div>
                  <button
                    onClick={() => !isProtected(category.name) && handleStartEdit(category)}
                    disabled={isProtected(category.name)}
                    className={`text-sm ${
                      isProtected(category.name)
                        ? 'text-slate-400 cursor-default'
                        : 'text-slate-600 hover:text-[#6366f1] cursor-pointer'
                    }`}
                  >
                    {formatCurrency(category.budget)}
                  </button>
                </div>
                {!isProtected(category.name) && (
                  <button
                    onClick={() => setDeleteDialog({ isOpen: true, category })}
                    className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors ml-2"
                    title="Delete category"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </>
            )}
          </div>
        ))}

        {/* Add Category Form */}
        {isAdding ? (
          <form onSubmit={handleAddSubmit} className="flex items-center gap-2 px-4 py-3">
            <input
              type="text"
              value={newCategory.name}
              onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
              placeholder="Category name"
              maxLength={100}
              autoFocus
              className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#6366f1]"
            />
            <input
              type="number"
              value={newCategory.budget}
              onChange={(e) => setNewCategory({ ...newCategory, budget: e.target.value })}
              placeholder="Budget (€)"
              min={0}
              step={0.01}
              className="w-28 px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#6366f1]"
            />
            <button
              type="submit"
              disabled={!newCategory.name.trim()}
              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAdding(false);
                setNewCategory({ name: '', budget: '' });
              }}
              className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 w-full px-4 py-3 text-sm font-medium text-[#6366f1] bg-indigo-50 rounded-lg border border-dashed border-indigo-200 hover:bg-indigo-100 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Category
          </button>
        )}
      </div>

      {/* Delete Confirmation */}
      <ConfirmationDialog
        isOpen={deleteDialog.isOpen}
        title="Delete Category"
        message={
          deleteDialog.category
            ? `Delete category "${deleteDialog.category.name}"? ${deleteDialog.category.billCount > 0 ? `This category is used by ${deleteDialog.category.billCount} bill(s).` : ''} This action cannot be undone.`
            : ''
        }
        onConfirm={async () => {
          if (deleteDialog.category) {
            await onDelete(deleteDialog.category.id, deleteDialog.category.name);
            setDeleteDialog({ isOpen: false, category: null });
          }
        }}
        onCancel={() => setDeleteDialog({ isOpen: false, category: null })}
        confirmText="Delete"
        isDestructive
      />
    </>
  );
}
