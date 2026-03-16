'use client';

import { useState, useCallback } from 'react';
import { Shield, ShieldOff, KeyRound, Trash2, UserPlus } from 'lucide-react';
import DataTable, { Column } from '@/components/ui/DataTable';
import ConfirmationDialog from '@/components/ui/ConfirmationDialog';
import RoleBadge from '@/components/ui/RoleBadge';
import { User } from './types';

interface UsersTabProps {
  users: User[];
  isLoading: boolean;
  currentUserEmail: string;
  onToggleAdmin: (email: string, isSuperAdmin: boolean) => Promise<void>;
  onDeleteUser: (email: string) => Promise<void>;
  onResetPassword: (user: User) => void;
  onCreateUser: () => void;
}

export default function UsersTab({
  users,
  isLoading,
  currentUserEmail,
  onToggleAdmin,
  onDeleteUser,
  onResetPassword,
  onCreateUser,
}: UsersTabProps) {
  const [toggleDialog, setToggleDialog] = useState<{ isOpen: boolean; user: User | null }>({
    isOpen: false,
    user: null,
  });
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; user: User | null }>({
    isOpen: false,
    user: null,
  });

  const handleToggleClick = useCallback((user: User) => {
    setToggleDialog({ isOpen: true, user });
  }, []);

  const handleConfirmToggle = useCallback(async () => {
    if (toggleDialog.user) {
      await onToggleAdmin(toggleDialog.user.email, !toggleDialog.user.isSuperAdmin);
      setToggleDialog({ isOpen: false, user: null });
    }
  }, [toggleDialog.user, onToggleAdmin]);

  const handleCancelToggle = useCallback(() => {
    setToggleDialog({ isOpen: false, user: null });
  }, []);

  const handleDeleteClick = useCallback((user: User) => {
    setDeleteDialog({ isOpen: true, user });
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (deleteDialog.user) {
      await onDeleteUser(deleteDialog.user.email);
      setDeleteDialog({ isOpen: false, user: null });
    }
  }, [deleteDialog.user, onDeleteUser]);

  const handleCancelDelete = useCallback(() => {
    setDeleteDialog({ isOpen: false, user: null });
  }, []);

  const isSelf = useCallback(
    (email: string) => email.toLowerCase() === currentUserEmail.toLowerCase(),
    [currentUserEmail]
  );

  const columns: Column<User>[] = [
    {
      key: 'email',
      header: 'Email',
      sortable: true,
      cell: (row) => (
        <div className="font-medium text-slate-800">{row.email}</div>
      ),
    },
    {
      key: 'isSuperAdmin',
      header: 'Super Admin',
      width: '120px',
      cell: (row) => (
        <div>
          {row.isSuperAdmin ? (
            <RoleBadge role="superadmin" size="sm" />
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </div>
      ),
    },
    {
      key: 'projectCount',
      header: 'Projects',
      sortable: true,
      width: '100px',
      cell: (row) => (
        <div className="text-slate-600">{row.projectCount}</div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '180px',
      cell: (row) => {
        const self = isSelf(row.email);
        return (
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleToggleClick(row);
              }}
              className={`p-2 rounded-lg transition-colors ${
                row.isSuperAdmin
                  ? 'text-amber-600 hover:bg-amber-50'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
              aria-label={
                row.isSuperAdmin ? `Revoke admin from ${row.email}` : `Make ${row.email} admin`
              }
              title={row.isSuperAdmin ? 'Revoke Admin' : 'Make Admin'}
            >
              {row.isSuperAdmin ? (
                <ShieldOff className="w-4 h-4" />
              ) : (
                <Shield className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onResetPassword(row);
              }}
              className="p-2 text-[var(--vb-accent)] hover:bg-indigo-50 rounded-lg transition-colors"
              aria-label={`Reset password for ${row.email}`}
              title="Reset Password"
            >
              <KeyRound className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!self) {
                  handleDeleteClick(row);
                }
              }}
              disabled={self}
              className={`p-2 rounded-lg transition-colors ${
                self
                  ? 'text-slate-300 cursor-not-allowed'
                  : 'text-rose-600 hover:bg-rose-50'
              }`}
              aria-label={self ? 'Cannot delete yourself' : `Delete user ${row.email}`}
              title={self ? 'Cannot delete yourself' : 'Delete'}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">{users.length} user{users.length !== 1 ? 's' : ''}</p>
        <button
          onClick={onCreateUser}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--vb-accent)] text-white text-sm font-medium rounded-lg hover:bg-[var(--vb-accent-hover)] transition-colors"
          aria-label="Create new user"
        >
          <UserPlus className="w-4 h-4" />
          Create User
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        <DataTable
          columns={columns}
          data={users}
          keyExtractor={(row) => row.id}
          isLoading={isLoading}
          emptyMessage="No users found"
        />
      </div>

      {/* Toggle Admin Dialog */}
      <ConfirmationDialog
        isOpen={toggleDialog.isOpen}
        title={toggleDialog.user?.isSuperAdmin ? 'Revoke Admin' : 'Grant Admin'}
        message={
          toggleDialog.user
            ? toggleDialog.user.isSuperAdmin
              ? `Revoke super-admin privileges from ${toggleDialog.user.email}?`
              : `Grant super-admin privileges to ${toggleDialog.user.email}?`
            : ''
        }
        onConfirm={handleConfirmToggle}
        onCancel={handleCancelToggle}
        confirmText={toggleDialog.user?.isSuperAdmin ? 'Revoke' : 'Grant'}
        isDestructive={!!toggleDialog.user?.isSuperAdmin}
      />

      {/* Delete User Dialog */}
      <ConfirmationDialog
        isOpen={deleteDialog.isOpen}
        title="Delete User"
        message={
          deleteDialog.user
            ? `Delete user ${deleteDialog.user.email}? This cannot be undone.`
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
