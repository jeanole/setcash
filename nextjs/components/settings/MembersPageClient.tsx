'use client';

import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import SettingsSection from '@/components/settings/SettingsSection';
import MembersTable from '@/components/settings/MembersTable';
import InviteMemberModal from '@/components/settings/InviteMemberModal';
import { useMembers } from '@/lib/hooks/useMembers';
import { usePositions } from '@/lib/hooks/usePositions';

interface MembersPageClientProps {
  projectId: string;
  currentUserRole: 'user' | 'admin' | 'owner' | 'superadmin';
}

export default function MembersPageClient({ projectId, currentUserRole }: MembersPageClientProps) {
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  const { members, isLoading: membersLoading, inviteMember, updateMemberRole, updateMemberPosition, removeMember } =
    useMembers({ projectId });
  const { positions, isLoading: positionsLoading } = usePositions({ projectId });

  const isLoading = membersLoading || positionsLoading;

  return (
    <>
      <SettingsSection
        title="Members"
        description={`Manage project members and their roles. ${members.length} member(s) total.`}
      >
        <div className="mb-4 flex justify-end">
          <button
            onClick={() => setIsInviteModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md font-medium hover:bg-indigo-700 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Invite Member
          </button>
        </div>

        <MembersTable
          members={members}
          positions={positions}
          isLoading={isLoading}
          currentUserRole={currentUserRole}
          onUpdateRole={updateMemberRole}
          onUpdatePosition={updateMemberPosition}
          onRemove={removeMember}
        />
      </SettingsSection>

      <InviteMemberModal
        isOpen={isInviteModalOpen}
        positions={positions}
        currentUserRole={currentUserRole}
        onClose={() => setIsInviteModalOpen(false)}
        onInvite={inviteMember}
      />
    </>
  );
}
