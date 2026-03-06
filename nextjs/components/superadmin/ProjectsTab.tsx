'use client';

import { useState, useCallback } from 'react';
import { Users, Trash2 } from 'lucide-react';
import DataTable, { Column } from '@/components/ui/DataTable';
import ConfirmationDialog from '@/components/ui/ConfirmationDialog';
import { Project } from './types';
import { formatDate } from '@/lib/utils';

interface ProjectsTabProps {
  projects: Project[];
  isLoading: boolean;
  onDeleteProject: (id: string) => Promise<void>;
  onOpenMembers: (project: Project) => void;
}

export default function ProjectsTab({
  projects,
  isLoading,
  onDeleteProject,
  onOpenMembers,
}: ProjectsTabProps) {
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; project: Project | null }>({
    isOpen: false,
    project: null,
  });

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
            className="p-2 text-[#7C6AF6] hover:bg-violet-50 rounded-lg transition-colors"
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
    </div>
  );
}
