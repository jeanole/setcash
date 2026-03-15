'use client';

import { useState, useCallback } from 'react';
import { Trash2 } from 'lucide-react';
import DataTable, { Column } from '@/components/ui/DataTable';
import ConfirmationDialog from '@/components/ui/ConfirmationDialog';
import RoleBadge from '@/components/ui/RoleBadge';
import { Member } from '@/lib/hooks/useMembers';
import { Position } from '@/lib/hooks/usePositions';

interface MembersTableProps {
  members: Member[];
  positions: Position[];
  isLoading: boolean;
  currentUserRole: 'user' | 'admin' | 'owner' | 'superadmin';
  onUpdateRole: (memberId: string, role: string) => Promise<boolean>;
  onUpdatePosition: (memberId: string, positionId: string | null) => Promise<boolean>;
  onRemove: (memberId: string, email: string) => Promise<boolean>;
}

const ROLES = [
  { value: 'user', label: 'User' },
  { value: 'admin', label: 'Admin' },
  { value: 'owner', label: 'Owner' },
];

export default function MembersTable({
  members,
  positions,
  isLoading,
  currentUserRole,
  onUpdateRole,
  onUpdatePosition,
  onRemove,
}: MembersTableProps) {
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; member: Member | null }>({
    isOpen: false,
    member: null,
  });
  const [confirmOwnerDialog, setConfirmOwnerDialog] = useState<{ isOpen: boolean; member: Member | null; newRole: string }>({
    isOpen: false,
    member: null,
    newRole: '',
  });

  const canChangeToOwner = currentUserRole === 'owner' || currentUserRole === 'superadmin';
  const canRemove = currentUserRole === 'admin' || currentUserRole === 'owner' || currentUserRole === 'superadmin';

  const handleRoleChange = useCallback(async (member: Member, newRole: string) => {
    if (newRole === 'owner' && !canChangeToOwner) {
      return;
    }

    if (newRole === 'owner' || member.role === 'owner') {
      setConfirmOwnerDialog({ isOpen: true, member, newRole });
      return;
    }

    await onUpdateRole(member.id, newRole);
  }, [canChangeToOwner, onUpdateRole]);

  const handleConfirmOwnerChange = useCallback(async () => {
    if (confirmOwnerDialog.member) {
      await onUpdateRole(confirmOwnerDialog.member.id, confirmOwnerDialog.newRole);
      setConfirmOwnerDialog({ isOpen: false, member: null, newRole: '' });
    }
  }, [confirmOwnerDialog, onUpdateRole]);

  const handlePositionChange = useCallback(async (member: Member, positionId: string) => {
    await onUpdatePosition(member.id, positionId === 'none' ? null : positionId);
  }, [onUpdatePosition]);

  const columns: Column<Member>[] = [
    {
      key: 'email',
      header: 'Email',
      sortable: true,
      cell: (row) => <div className="font-medium text-slate-800">{row.email}</div>,
    },
    {
      key: 'role',
      header: 'Role',
      width: '140px',
      cell: (row) => {
        const isOwnerChangeDisabled = row.role === 'owner' && !canChangeToOwner;
        const isPromoteToOwnerDisabled = !canChangeToOwner;

        return (
          <select
            value={row.role}
            onChange={(e) => handleRoleChange(row, e.target.value)}
            disabled={isOwnerChangeDisabled}
            className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:bg-slate-100 disabled:cursor-not-allowed"
          >
            {ROLES.map((role) => (
              <option
                key={role.value}
                value={role.value}
                disabled={role.value === 'owner' && isPromoteToOwnerDisabled}
              >
                {role.label}
              </option>
            ))}
          </select>
        );
      },
    },
    {
      key: 'position',
      header: 'Position',
      width: '160px',
      cell: (row) => (
        <select
          value={row.positionId || 'none'}
          onChange={(e) => handlePositionChange(row, e.target.value)}
          className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        >
          <option value="none">—</option>
          {positions.map((pos) => (
            <option key={pos.id} value={pos.id}>
              {pos.name}
            </option>
          ))}
        </select>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '60px',
      cell: (row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setDeleteDialog({ isOpen: true, member: row });
          }}
          disabled={!canRemove}
          className={`p-2 rounded-lg transition-colors ${
            canRemove
              ? 'text-rose-600 hover:bg-rose-50'
              : 'text-slate-300 cursor-not-allowed'
          }`}
          title={canRemove ? 'Remove member' : 'You cannot remove members'}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={members}
        keyExtractor={(row) => row.id}
        isLoading={isLoading}
        emptyMessage="No members yet"
      />

      {/* Delete Confirmation */}
      <ConfirmationDialog
        isOpen={deleteDialog.isOpen}
        title="Remove Member"
        message={
          deleteDialog.member
            ? `Remove ${deleteDialog.member.email} from the project? They will lose all access.`
            : ''
        }
        onConfirm={async () => {
          if (deleteDialog.member) {
            await onRemove(deleteDialog.member.id, deleteDialog.member.email);
            setDeleteDialog({ isOpen: false, member: null });
          }
        }}
        onCancel={() => setDeleteDialog({ isOpen: false, member: null })}
        confirmText="Remove"
        isDestructive
      />

      {/* Owner Change Confirmation */}
      <ConfirmationDialog
        isOpen={confirmOwnerDialog.isOpen}
        title={confirmOwnerDialog.newRole === 'owner' ? 'Grant Owner Privileges' : 'Revoke Owner Privileges'}
        message={
          confirmOwnerDialog.member
            ? confirmOwnerDialog.newRole === 'owner'
              ? `Grant owner privileges to ${confirmOwnerDialog.member.email}? Owners have full control including project deletion.`
              : `Revoke owner privileges from ${confirmOwnerDialog.member.email}? They will become ${confirmOwnerDialog.newRole}.`
            : ''
        }
        onConfirm={handleConfirmOwnerChange}
        onCancel={() => setConfirmOwnerDialog({ isOpen: false, member: null, newRole: '' })}
        confirmText={confirmOwnerDialog.newRole === 'owner' ? 'Grant' : 'Revoke'}
        isDestructive={confirmOwnerDialog.newRole !== 'owner'}
      />
    </>
  );
}
