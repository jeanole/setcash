'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Shield, FolderKanban, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import ProjectsTab from './ProjectsTab';
import UsersTab from './UsersTab';
import MembersSubModal from './MembersSubModal';
import PasswordResetModal from './PasswordResetModal';
import ToastContainer from './ToastContainer';
import { Project, User, TabType } from './types';
import { useSuperAdminApi, apiFetch } from './useSuperAdminApi';

interface SuperAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserEmail: string;
}

export default function SuperAdminModal({ isOpen, onClose, currentUserEmail }: SuperAdminModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('projects');
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
  const [isPasswordResetModalOpen, setIsPasswordResetModalOpen] = useState(false);

  const { toasts, showToast, removeToast, handleApiError } = useSuperAdminApi();

  // Fetch data when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchProjects();
      fetchUsers();
    }
  }, [isOpen]);

  const fetchProjects = useCallback(async () => {
    setIsLoadingProjects(true);
    try {
      const data = await apiFetch<Project[]>('/api/admin/projects');
      setProjects(data);
    } catch (error) {
      handleApiError(error, 'Failed to fetch projects');
    } finally {
      setIsLoadingProjects(false);
    }
  }, [handleApiError]);

  const fetchUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    try {
      const data = await apiFetch<User[]>('/api/admin/users');
      setUsers(data);
    } catch (error) {
      handleApiError(error, 'Failed to fetch users');
    } finally {
      setIsLoadingUsers(false);
    }
  }, [handleApiError]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        // Don't close if nested modals are open
        if (isMembersModalOpen || isPasswordResetModalOpen) {
          return;
        }
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, isMembersModalOpen, isPasswordResetModalOpen]);

  const handleDeleteProject = useCallback(async (id: string) => {
    try {
      await apiFetch(`/api/admin/projects/${id}`, { method: 'DELETE' });
      await fetchProjects();
      showToast('Project deleted successfully');
    } catch (error) {
      handleApiError(error, 'Failed to delete project');
    }
  }, [fetchProjects, showToast, handleApiError]);

  const handleOpenMembers = useCallback((project: Project) => {
    setSelectedProject(project);
    setIsMembersModalOpen(true);
  }, []);

  const handleCloseMembers = useCallback(() => {
    setIsMembersModalOpen(false);
    setSelectedProject(null);
  }, []);

  const handleToggleAdmin = useCallback(async (email: string, isSuperAdmin: boolean) => {
    try {
      await apiFetch(`/api/admin/users/${encodeURIComponent(email)}`, {
        method: 'PUT',
        body: JSON.stringify({ isSuperAdmin }),
      });
      await fetchUsers();
      showToast(`Admin privileges ${isSuperAdmin ? 'granted' : 'revoked'}`);
    } catch (error) {
      handleApiError(error, 'Failed to update admin privileges');
    }
  }, [fetchUsers, showToast, handleApiError]);

  const handleDeleteUser = useCallback(async (email: string) => {
    try {
      await apiFetch(`/api/admin/users/${encodeURIComponent(email)}`, {
        method: 'DELETE',
      });
      await fetchUsers();
      showToast('User deleted successfully');
    } catch (error) {
      handleApiError(error, 'Failed to delete user');
    }
  }, [fetchUsers, showToast, handleApiError]);

  const handleResetPassword = useCallback((user: User) => {
    setResetPasswordUser(user);
    setIsPasswordResetModalOpen(true);
  }, []);

  const handleClosePasswordReset = useCallback(() => {
    setIsPasswordResetModalOpen(false);
    setResetPasswordUser(null);
  }, []);

  const handleConfirmResetPassword = useCallback(async (email: string): Promise<string> => {
    const response = await apiFetch<{ ok: boolean; password?: string }>(
      `/api/admin/users/${encodeURIComponent(email)}`,
      {
        method: 'PUT',
        body: JSON.stringify({ resetPassword: true }),
      }
    );
    
    if (!response.password) {
      throw new Error('Password was not returned from server');
    }
    
    await fetchUsers();
    showToast('Password reset successfully');
    return response.password;
  }, [fetchUsers, showToast]);

  if (!isOpen) return null;

  return (
    <>
      {/* Main Modal */}
      <div
        className="fixed inset-0 z-50 flex flex-col bg-black/70 animate-[fadeIn_0.2s_ease-out]"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <div className="flex-1 bg-white m-0 md:m-4 lg:m-8 rounded-none md:rounded-2xl shadow-xl flex flex-col overflow-hidden animate-[slideUp_0.2s_ease-out]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-100">
                <Shield className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-800">Super Admin</h2>
                <p className="text-xs text-slate-500">System-wide administration panel</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="px-6 border-b border-slate-100 bg-slate-50/50">
            <div className="flex gap-1">
              <button
                onClick={() => setActiveTab('projects')}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2',
                  activeTab === 'projects'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-600 hover:text-slate-800 hover:bg-slate-100'
                )}
                aria-selected={activeTab === 'projects'}
                role="tab"
              >
                <FolderKanban className="w-4 h-4" />
                Projects
                <span className="ml-1 text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">
                  {projects.length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('users')}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2',
                  activeTab === 'users'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-600 hover:text-slate-800 hover:bg-slate-100'
                )}
                aria-selected={activeTab === 'users'}
                role="tab"
              >
                <Users className="w-4 h-4" />
                Users
                <span className="ml-1 text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">
                  {users.length}
                </span>
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden p-6 bg-slate-50/30">
            {activeTab === 'projects' ? (
              <ProjectsTab
                projects={projects}
                isLoading={isLoadingProjects}
                onDeleteProject={handleDeleteProject}
                onOpenMembers={handleOpenMembers}
              />
            ) : (
              <UsersTab
                users={users}
                isLoading={isLoadingUsers}
                currentUserEmail={currentUserEmail}
                onToggleAdmin={handleToggleAdmin}
                onDeleteUser={handleDeleteUser}
                onResetPassword={handleResetPassword}
              />
            )}
          </div>
        </div>
      </div>

      {/* Nested Modals */}
      <MembersSubModal
        isOpen={isMembersModalOpen}
        project={selectedProject}
        onClose={handleCloseMembers}
      />

      <PasswordResetModal
        isOpen={isPasswordResetModalOpen}
        user={resetPasswordUser}
        onClose={handleClosePasswordReset}
        onConfirmReset={handleConfirmResetPassword}
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
}
