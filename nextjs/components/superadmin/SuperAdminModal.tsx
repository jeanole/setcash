'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Shield, FolderKanban, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import ProjectsTab from './ProjectsTab';
import UsersTab from './UsersTab';
import MembersSubModal from './MembersSubModal';
import PasswordResetModal from './PasswordResetModal';
import { Project, User, TabType } from './types';

interface SuperAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserEmail: string;
}

// Mock data for development
const mockProjects: Project[] = [
  {
    id: '1',
    name: 'Project Alpha',
    subtitle: 'Main development project',
    createdAt: '2024-01-15T10:00:00Z',
    memberCount: 5,
  },
  {
    id: '2',
    name: 'Project Beta',
    subtitle: null,
    createdAt: '2024-02-20T14:30:00Z',
    memberCount: 3,
  },
  {
    id: '3',
    name: 'Project Gamma',
    subtitle: 'Internal tools',
    createdAt: '2024-03-10T09:15:00Z',
    memberCount: 8,
  },
];

const mockUsers: User[] = [
  {
    id: '1',
    email: 'admin@example.com',
    isSuperAdmin: true,
    projectCount: 3,
  },
  {
    id: '2',
    email: 'user1@example.com',
    isSuperAdmin: false,
    projectCount: 2,
  },
  {
    id: '3',
    email: 'user2@example.com',
    isSuperAdmin: false,
    projectCount: 1,
  },
];

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
      // Mock API call - replace with actual API
      // const response = await fetch('/api/admin/projects');
      // const data = await response.json();
      // setProjects(data);

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 300));
      setProjects(mockProjects);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    } finally {
      setIsLoadingProjects(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    try {
      // Mock API call - replace with actual API
      // const response = await fetch('/api/admin/users');
      // const data = await response.json();
      // setUsers(data);

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 300));
      setUsers(mockUsers);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

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
    // Mock API call - replace with actual API
    // await fetch(`/api/admin/projects/${id}`, { method: 'DELETE' });

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Refresh projects
    await fetchProjects();

    // Show success toast (to be implemented with actual toast system)
    console.log('Project deleted successfully');
  }, [fetchProjects]);

  const handleOpenMembers = useCallback((project: Project) => {
    setSelectedProject(project);
    setIsMembersModalOpen(true);
  }, []);

  const handleCloseMembers = useCallback(() => {
    setIsMembersModalOpen(false);
    setSelectedProject(null);
  }, []);

  const handleToggleAdmin = useCallback(async (email: string, isSuperAdmin: boolean) => {
    // Mock API call - replace with actual API
    // await fetch(`/api/admin/users/${encodeURIComponent(email)}`, {
    //   method: 'PUT',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ isSuperAdmin }),
    // });

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Refresh users
    await fetchUsers();

    // Show success toast
    console.log(`Admin privileges ${isSuperAdmin ? 'granted' : 'revoked'} for ${email}`);
  }, [fetchUsers]);

  const handleDeleteUser = useCallback(async (email: string) => {
    // Mock API call - replace with actual API
    // await fetch(`/api/admin/users/${encodeURIComponent(email)}`, { method: 'DELETE' });

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Refresh users
    await fetchUsers();

    // Show success toast
    console.log(`User ${email} deleted successfully`);
  }, [fetchUsers]);

  const handleResetPassword = useCallback((user: User) => {
    setResetPasswordUser(user);
    setIsPasswordResetModalOpen(true);
  }, []);

  const handleClosePasswordReset = useCallback(() => {
    setIsPasswordResetModalOpen(false);
    setResetPasswordUser(null);
  }, []);

  const handleConfirmResetPassword = useCallback(async (email: string): Promise<string> => {
    // Mock API call - replace with actual API
    // const response = await fetch(`/api/admin/users/${encodeURIComponent(email)}`, {
    //   method: 'PUT',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ resetPassword: true }),
    // });
    // const data = await response.json();
    // return data.password;

    // For now, return a mock password
    await new Promise((resolve) => setTimeout(resolve, 500));
    return 'MockPassword123!';
  }, []);

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
    </>
  );
}
