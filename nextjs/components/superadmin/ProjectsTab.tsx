'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Users, Trash2, Pencil, X } from 'lucide-react';
import DataTable, { Column } from '@/components/ui/DataTable';
import ConfirmationDialog from '@/components/ui/ConfirmationDialog';
import { Project } from './types';
import { formatDate } from '@/lib/utils';
import { apiFetch } from './useSuperAdminApi';

interface ProjectsTabProps {
  projects: Project[];
  isLoading: boolean;
  onDeleteProject: (id: string) => Promise<void>;
  onOpenMembers: (project: Project) => void;
  onQuotaUpdated: () => void;
}

interface QuotaEditDialog {
  isOpen: boolean;
  project: Project | null;
  value: string;
  isSaving: boolean;
  error: string | null;
}

export default function ProjectsTab({
  projects,
  isLoading,
  onDeleteProject,
  onOpenMembers,
  onQuotaUpdated,
}: ProjectsTabProps) {
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; project: Project | null }>({
    isOpen: false,
    project: null,
  });

  const [quotaDialog, setQuotaDialog] = useState<QuotaEditDialog>({
    isOpen: false,
    project: null,
    value: '',
    isSaving: false,
    error: null,
  });

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (quotaDialog.isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [quotaDialog.isOpen]);

  const handleDeleteClick = useCallback((project: Project) => {
    setDeleteDialog({ isOpen: true, project });
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (deleteDialog.project) {
      await onDeleteProject(deleteDialog.project.id);
      setDeleteDialog({ isOpen: false, project: null });
    }
  }, [deleteDialog.project, onDeleteProject]);

  const handleCancelDelete = useCallback(() => {
    setDeleteDialog({ isOpen: false, project: null });
  }, []);

  const handleOpenQuotaEdit = useCallback((project: Project) => {
    setQuotaDialog({
      isOpen: true,
      project,
      value: project.uploadLimit !== null ? String(project.uploadLimit) : '',
      isSaving: false,
      error: null,
    });
  }, []);

  const handleCloseQuotaEdit = useCallback(() => {
    setQuotaDialog((prev) => ({ ...prev, isOpen: false, project: null, error: null }));
  }, []);

  const handleSaveQuota = useCallback(async () => {
    if (!quotaDialog.project) return;

    const rawValue = quotaDialog.value.trim();
    let uploadLimit: number | null = null;

    if (rawValue !== '') {
      const parsed = parseInt(rawValue, 10);
      if (isNaN(parsed) || parsed < 0) {
        setQuotaDialog((prev) => ({ ...prev, error: 'Please enter a valid positive number, or leave empty for no limit.' }));
        return;
      }
      uploadLimit = parsed;
    }

    setQuotaDialog((prev) => ({ ...prev, isSaving: true, error: null }));
    try {
      await apiFetch(`/api/admin/projects/${quotaDialog.project.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ uploadLimit }),
      });
      setQuotaDialog({ isOpen: false, project: null, value: '', isSaving: false, error: null });
      onQuotaUpdated();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save quota';
      setQuotaDialog((prev) => ({ ...prev, isSaving: false, error: message }));
    }
  }, [quotaDialog, onQuotaUpdated]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSaveQuota();
    if (e.key === 'Escape') handleCloseQuotaEdit();
  }, [handleSaveQuota, handleCloseQuotaEdit]);

  const columns: Column<Project>[] = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      cell: (row) => (
        <div className="font-medium text-slate-800">{row.name}</div>
      ),
    },
    {
      key: 'subtitle',
      header: 'Subtitle',
      cell: (row) => (
        <div className="text-slate-600">{row.subtitle || '—'}</div>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      sortable: true,
      cell: (row) => (
        <div className="text-slate-600">{formatDate(row.createdAt)}</div>
      ),
    },
    {
      key: 'memberCount',
      header: 'Members',
      sortable: true,
      width: '100px',
      cell: (row) => (
        <div className="text-slate-600">{row.memberCount}</div>
      ),
    },
    {
      key: 'uploadLimit',
      header: 'Quota',
      width: '130px',
      cell: (row) => (
        <div className="flex items-center gap-2">
          <span className="text-slate-600">
            {row.uploadLimit !== null ? `${row.billCount}/${row.uploadLimit}` : 'Unlimited'}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleOpenQuotaEdit(row);
            }}
            className="p-1 text-slate-400 hover:text-[var(--vb-accent)] hover:bg-indigo-50 rounded transition-colors"
            aria-label={`Edit quota for ${row.name}`}
            title="Edit quota"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '140px',
      cell: (row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenMembers(row);
            }}
            className="p-2 text-[var(--vb-accent)] hover:bg-indigo-50 rounded-lg transition-colors"
            aria-label={`Manage members for ${row.name}`}
            title="Members"
          >
            <Users className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteClick(row);
            }}
            className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
            aria-label={`Delete project ${row.name}`}
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto">
        <DataTable
          columns={columns}
          data={projects}
          keyExtractor={(row) => row.id}
          isLoading={isLoading}
          emptyMessage="No projects found"
        />
      </div>

      <ConfirmationDialog
        isOpen={deleteDialog.isOpen}
        title="Delete Project"
        message={
          deleteDialog.project
            ? `Delete project "${deleteDialog.project.name}"? This action cannot be undone.`
            : ''
        }
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        confirmText="Delete"
        isDestructive
      />

      {/* Quota Edit Modal */}
      {quotaDialog.isOpen && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70 animate-[fadeIn_0.15s_ease-out]"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseQuotaEdit();
          }}
        >
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full overflow-hidden animate-[scaleIn_0.15s_ease-out]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-semibold text-slate-800">Edit Upload Quota</h3>
              <button
                onClick={handleCloseQuotaEdit}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-4 space-y-3">
              <p className="text-sm text-slate-600">
                Set the maximum number of bills for{' '}
                <strong>{quotaDialog.project?.name}</strong>. Leave empty to remove the limit.
              </p>
              <div>
                <label htmlFor="quota-input" className="block text-xs font-medium text-slate-700 mb-1">
                  Upload limit (bills)
                </label>
                <input
                  id="quota-input"
                  ref={inputRef}
                  type="number"
                  min="0"
                  placeholder="No limit"
                  value={quotaDialog.value}
                  onChange={(e) => setQuotaDialog((prev) => ({ ...prev, value: e.target.value, error: null }))}
                  onKeyDown={handleKeyDown}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--vb-accent)] focus:border-transparent"
                  disabled={quotaDialog.isSaving}
                />
              </div>
              {quotaDialog.error && (
                <p className="text-xs text-rose-600">{quotaDialog.error}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button
                onClick={handleCloseQuotaEdit}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                disabled={quotaDialog.isSaving}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveQuota}
                className="px-4 py-2 bg-[var(--vb-accent)] text-white font-medium rounded-lg hover:bg-[var(--vb-accent-hover)] transition-colors disabled:opacity-50"
                disabled={quotaDialog.isSaving}
              >
                {quotaDialog.isSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
