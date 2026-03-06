'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { X, Plus, Trash2, Edit2, Check, XCircle, Users, FolderTree } from 'lucide-react';
import DataTable, { Column } from '@/components/ui/DataTable';
import ConfirmationDialog from '@/components/ui/ConfirmationDialog';
import RoleBadge from '@/components/ui/RoleBadge';
import AddMemberForm from './AddMemberForm';
import ToastContainer from './ToastContainer';
import { Member, Position, Project, PositionWithCount } from './types';
import { useSuperAdminApi, apiFetch } from './useSuperAdminApi';

interface MembersSubModalProps {
  isOpen: boolean;
  project: Project | null;
  onClose: () => void;
}

export default function MembersSubModal({ isOpen, project, onClose }: MembersSubModalProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [editingPosition, setEditingPosition] = useState<string | null>(null);
  const [newPositionName, setNewPositionName] = useState('');
  const [deleteMemberDialog, setDeleteMemberDialog] = useState<{ isOpen: boolean; member: Member | null }>({
    isOpen: false,
    member: null,
  });
  const [deletePositionDialog, setDeletePositionDialog] = useState<{ isOpen: boolean; position: Position | null }>({
    isOpen: false,
    position: null,
  });

  const { toasts, showToast, removeToast, handleApiError } = useSuperAdminApi();

  // Fetch data when modal opens
  useEffect(() => {
    if (isOpen && project) {
      fetchMembersAndPositions();
    }
  }, [isOpen, project]);

  const fetchMembers = useCallback(async () => {
    if (!project) return;
    try {
      const data = await apiFetch<Member[]>(`/api/admin/projects/${project.id}/members`);
      setMembers(data);
    } catch (error) {
      handleApiError(error, 'Failed to fetch members');
    }
  }, [project, handleApiError]);

  const fetchPositions = useCallback(async () => {
    if (!project) return;
    try {
      const data = await apiFetch<Position[]>(`/api/admin/projects/${project.id}/positions`);
      setPositions(data);
    } catch (error) {
      handleApiError(error, 'Failed to fetch positions');
    }
  }, [project, handleApiError]);

  const fetchMembersAndPositions = useCallback(async () => {
    if (!project) return;

    setIsLoading(true);
    try {
      await Promise.all([fetchMembers(), fetchPositions()]);
    } finally {
      setIsLoading(false);
    }
  }, [project, fetchMembers, fetchPositions]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleAddMember = useCallback(
    async (email: string, role: 'user' | 'admin' | 'owner', positionId: string | null) => {
      if (!project) return;

      try {
        await apiFetch(`/api/admin/projects/${project.id}/members`, {
          method: 'POST',
          body: JSON.stringify({ email, projectRole: role, positionId }),
        });
        await fetchMembersAndPositions();
        setShowAddForm(false);
        showToast('Member added successfully');
      } catch (error) {
        handleApiError(error, 'Failed to add member');
        throw error;
      }
    },
    [project, fetchMembersAndPositions, showToast, handleApiError]
  );

  const handleUpdateMember = useCallback(
    async (memberId: string, role: 'user' | 'admin' | 'owner', positionId: string | null) => {
      if (!project) return;

      try {
        await apiFetch(`/api/admin/projects/${project.id}/members/${memberId}`, {
          method: 'PUT',
          body: JSON.stringify({ projectRole: role, positionId }),
        });
        await fetchMembersAndPositions();
        setEditingMember(null);
        showToast('Member updated successfully');
      } catch (error) {
        handleApiError(error, 'Failed to update member');
      }
    },
    [project, fetchMembersAndPositions, showToast, handleApiError]
  );

  const handleRemoveMember = useCallback(async () => {
    if (!project || !deleteMemberDialog.member) return;

    try {
      await apiFetch(`/api/admin/projects/${project.id}/members/${deleteMemberDialog.member.id}`, {
        method: 'DELETE',
      });
      await fetchMembersAndPositions();
      setDeleteMemberDialog({ isOpen: false, member: null });
      showToast('Member removed successfully');
    } catch (error) {
      handleApiError(error, 'Failed to remove member');
    }
  }, [project, deleteMemberDialog.member, fetchMembersAndPositions, showToast, handleApiError]);

  const handleAddPosition = useCallback(async () => {
    if (!project || !newPositionName.trim()) return;

    try {
      await apiFetch(`/api/admin/projects/${project.id}/positions`, {
        method: 'POST',
        body: JSON.stringify({ name: newPositionName.trim() }),
      });
      setNewPositionName('');
      await fetchPositions();
      showToast('Position created successfully');
    } catch (error) {
      handleApiError(error, 'Failed to create position');
    }
  }, [project, newPositionName, fetchPositions, showToast, handleApiError]);

  const handleRenamePosition = useCallback(
    async (positionId: string, newName: string) => {
      if (!project) return;

      try {
        await apiFetch(`/api/admin/projects/${project.id}/positions/${positionId}`, {
          method: 'PUT',
          body: JSON.stringify({ name: newName }),
        });
        setEditingPosition(null);
        await fetchPositions();
        showToast('Position renamed successfully');
      } catch (error) {
        handleApiError(error, 'Failed to rename position');
      }
    },
    [project, fetchPositions, showToast, handleApiError]
  );

  const handleDeletePosition = useCallback(async () => {
    if (!project || !deletePositionDialog.position) return;

    try {
      await apiFetch(`/api/admin/projects/${project.id}/positions/${deletePositionDialog.position.id}`, {
        method: 'DELETE',
      });
      await fetchMembersAndPositions();
      setDeletePositionDialog({ isOpen: false, position: null });
      showToast('Position deleted successfully');
    } catch (error) {
      handleApiError(error, 'Failed to delete position');
    }
  }, [project, deletePositionDialog.position, fetchMembersAndPositions, showToast, handleApiError]);

  const positionsWithCount = useMemo<PositionWithCount[]>(() => {
    return positions.map((pos) => ({
      ...pos,
      memberCount: members.filter((m) => m.positionId === pos.id).length,
    }));
  }, [positions, members]);

  const memberColumns: Column<Member>[] = [
    {
      key: 'email',
      header: 'Email',
      cell: (row) => <div className="font-medium text-slate-800">{row.email}</div>,
    },
    {
      key: 'projectRole',
      header: 'Role',
      width: '100px',
      cell: (row) => <RoleBadge role={row.projectRole} size="sm" />,
    },
    {
      key: 'positionName',
      header: 'Position',
      width: '120px',
      cell: (row) => <div className="text-slate-600">{row.positionName}</div>,
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '100px',
      cell: (row) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setEditingMember(row.id);
            }}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label={`Edit ${row.email}`}
            title="Edit"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDeleteMemberDialog({ isOpen: true, member: row });
            }}
            className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
            aria-label={`Remove ${row.email}`}
            title="Remove"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  if (!isOpen || !project) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 animate-[fadeIn_0.15s_ease-out]"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-[scaleIn_0.15s_ease-out]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-violet-100">
                <Users className="w-5 h-5 text-[#7C6AF6]" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Members: {project.name}</h3>
                <p className="text-xs text-slate-500">Manage project members and positions</p>
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

          {/* Content */}
          <div className="flex-1 overflow-auto p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Members Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Members
                  </h4>
                  {!showAddForm && (
                    <button
                      onClick={() => setShowAddForm(true)}
                      className="px-3 py-1.5 bg-[#7C6AF6] text-white text-sm font-medium rounded-lg hover:bg-[#6C5CE7] transition-colors flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      Add Member
                    </button>
                  )}
                </div>

                {showAddForm && (
                  <AddMemberForm
                    positions={positions}
                    onAdd={handleAddMember}
                    onCancel={() => setShowAddForm(false)}
                  />
                )}

                <DataTable
                  columns={memberColumns}
                  data={members}
                  keyExtractor={(row) => row.id}
                  isLoading={isLoading}
                  emptyMessage="No members found"
                />
              </div>

              {/* Positions Section */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <FolderTree className="w-4 h-4" />
                  Positions
                </h4>

                {/* Add Position */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newPositionName}
                    onChange={(e) => setNewPositionName(e.target.value)}
                    placeholder="New position name"
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#7C6AF6] focus:border-[#7C6AF6] text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleAddPosition();
                      }
                    }}
                  />
                  <button
                    onClick={handleAddPosition}
                    disabled={!newPositionName.trim()}
                    className="px-3 py-2 bg-[#7C6AF6] text-white rounded-lg hover:bg-[#6C5CE7] transition-colors disabled:opacity-50"
                    aria-label="Add position"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Positions List */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="divide-y divide-slate-100">
                    {positionsWithCount.map((pos) => {
                      const isMisc = pos.name === 'Misc';
                      const isEditing = editingPosition === pos.id;

                      return (
                        <div
                          key={pos.id}
                          className="flex items-center justify-between px-4 py-3 hover:bg-slate-50"
                        >
                          {isEditing ? (
                            <div className="flex-1 flex items-center gap-2">
                              <input
                                type="text"
                                defaultValue={pos.name}
                                autoFocus
                                className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleRenamePosition(pos.id, e.currentTarget.value);
                                  } else if (e.key === 'Escape') {
                                    setEditingPosition(null);
                                  }
                                }}
                                onBlur={(e) => {
                                  if (e.target.value !== pos.name) {
                                    handleRenamePosition(pos.id, e.target.value);
                                  } else {
                                    setEditingPosition(null);
                                  }
                                }}
                              />
                            </div>
                          ) : (
                            <div className="flex-1">
                              <span className="font-medium text-slate-800">{pos.name}</span>
                              <span className="text-xs text-slate-500 ml-2">
                                ({pos.memberCount} members)
                              </span>
                            </div>
                          )}

                          {!isEditing && !isMisc && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setEditingPosition(pos.id)}
                                className="p-1.5 text-slate-600 hover:bg-slate-200 rounded transition-colors"
                                aria-label={`Edit ${pos.name}`}
                                title="Rename"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setDeletePositionDialog({ isOpen: true, position: pos })}
                                className="p-1.5 text-rose-600 hover:bg-rose-100 rounded transition-colors"
                                aria-label={`Delete ${pos.name}`}
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end px-6 py-4 border-t border-slate-100">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Delete Member Confirmation */}
      <ConfirmationDialog
        isOpen={deleteMemberDialog.isOpen}
        title="Remove Member"
        message={
          deleteMemberDialog.member
            ? `Remove ${deleteMemberDialog.member.email} from this project?`
            : ''
        }
        onConfirm={handleRemoveMember}
        onCancel={() => setDeleteMemberDialog({ isOpen: false, member: null })}
        confirmText="Remove"
        isDestructive
      />

      {/* Delete Position Confirmation */}
      <ConfirmationDialog
        isOpen={deletePositionDialog.isOpen}
        title="Delete Position"
        message={
          deletePositionDialog.position
            ? `Delete position "${deletePositionDialog.position.name}"? Members with this position will be moved to "Misc".`
            : ''
        }
        onConfirm={handleDeletePosition}
        onCancel={() => setDeletePositionDialog({ isOpen: false, position: null })}
        confirmText="Delete"
        isDestructive
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
}
