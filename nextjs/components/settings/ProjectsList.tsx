'use client';

import { useState, useCallback } from 'react';
import { SwitchCamera, LogOut, Trash2, Check } from 'lucide-react';
import { Project } from '@/lib/hooks/useProjects';
import RoleBadge from '@/components/ui/RoleBadge';
import ConfirmationDialog from '@/components/ui/ConfirmationDialog';

interface ProjectsListProps {
  projects: Project[];
  isLoading: boolean;
  onSwitch: (projectId: string) => Promise<boolean>;
  onResign: (projectId: string, name: string) => Promise<boolean>;
  onDelete: (projectId: string, name: string) => Promise<boolean>;
}

export default function ProjectsList({
  projects,
  isLoading,
  onSwitch,
  onResign,
  onDelete,
}: ProjectsListProps) {
  const [resignDialog, setResignDialog] = useState<{ isOpen: boolean; project: Project | null }>({
    isOpen: false,
    project: null,
  });
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; project: Project | null }>({
    isOpen: false,
    project: null,
  });

  const handleResignConfirm = useCallback(async () => {
    if (resignDialog.project) {
      await onResign(resignDialog.project.id, resignDialog.project.name);
      setResignDialog({ isOpen: false, project: null });
    }
  }, [resignDialog, onResign]);

  const handleDeleteConfirm = useCallback(async () => {
    if (deleteDialog.project) {
      await onDelete(deleteDialog.project.id, deleteDialog.project.name);
      setDeleteDialog({ isOpen: false, project: null });
    }
  }, [deleteDialog, onDelete]);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-slate-100 rounded-lg" />
        ))}
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="text-center py-12 bg-slate-50 rounded-lg border border-dashed border-slate-300">
        <p className="text-slate-600">You are not a member of any projects yet.</p>
        <a
          href="/settings/projects"
          className="mt-4 inline-block px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700"
        >
          Create Your First Project
        </a>
      </div>
    );
  }

  // Sort: current project first, then alphabetically
  const sortedProjects = [...projects].sort((a, b) => {
    if (a.isCurrent) return -1;
    if (b.isCurrent) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <>
      <div className="space-y-4">
        {sortedProjects.map((project) => (
          <div
            key={project.id}
            className={`p-4 rounded-lg border ${
              project.isCurrent
                ? 'bg-indigo-50 border-indigo-200'
                : 'bg-white border-slate-200'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-900">{project.name}</h3>
                  {project.isCurrent && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                      <Check className="w-3 h-3 mr-1" />
                      Current
                    </span>
                  )}
                </div>
                {project.subtitle && (
                  <p className="text-sm text-slate-600 mt-0.5">{project.subtitle}</p>
                )}
                <div className="flex items-center gap-3 mt-2">
                  <RoleBadge role={project.role} size="sm" />
                  <span className="text-xs text-slate-500">
                    {project.memberCount} member{project.memberCount !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!project.isCurrent && (
                  <button
                    onClick={() => onSwitch(project.id)}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-md hover:bg-indigo-100 transition-colors"
                  >
                    <SwitchCamera className="w-4 h-4" />
                    Switch
                  </button>
                )}

                {project.role !== 'owner' && (
                  <button
                    onClick={() => setResignDialog({ isOpen: true, project })}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-md hover:bg-slate-200 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Resign
                  </button>
                )}

                {project.role === 'owner' && project.memberCount === 1 && (
                  <button
                    onClick={() => setDeleteDialog({ isOpen: true, project })}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-rose-600 bg-rose-50 rounded-md hover:bg-rose-100 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Resign Confirmation */}
      <ConfirmationDialog
        isOpen={resignDialog.isOpen}
        title="Leave Project"
        message={
          resignDialog.project
            ? `Leave project "${resignDialog.project.name}"? You will lose access immediately.`
            : ''
        }
        onConfirm={handleResignConfirm}
        onCancel={() => setResignDialog({ isOpen: false, project: null })}
        confirmText="Leave"
        isDestructive
      />

      {/* Delete Confirmation */}
      <ConfirmationDialog
        isOpen={deleteDialog.isOpen}
        title="Delete Project"
        message={
          deleteDialog.project
            ? `Permanently delete "${deleteDialog.project.name}"? This cannot be undone. All bills, images, and data will be lost.`
            : ''
        }
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteDialog({ isOpen: false, project: null })}
        confirmText="Delete"
        isDestructive
      />
    </>
  );
}
