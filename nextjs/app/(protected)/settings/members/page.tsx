'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { UserPlus } from 'lucide-react';
import SettingsSection from '@/components/settings/SettingsSection';
import MembersTable from '@/components/settings/MembersTable';
import InviteMemberModal from '@/components/settings/InviteMemberModal';
import { useMembers } from '@/lib/hooks/useMembers';
import { usePositions } from '@/lib/hooks/usePositions';

export default function MembersSettingsPage() {
  const { data: session } = useSession();
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  const currentProjectId = session?.user?.currentProjectId as string | undefined;
  const currentUserRole = (session?.user?.role as 'user' | 'admin' | 'owner' | 'superadmin') || 'user';

  if (!currentProjectId) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-amber-800">No Project Selected</h3>
        <p className="mt-2 text-sm text-amber-700">
          Please select a project to manage its members.
        </p>
        <a
          href="/settings/projects"
          className="mt-4 inline-block px-4 py-2 bg-amber-600 text-white rounded-md text-sm font-medium hover:bg-amber-700"
        >
          Go to Projects
        </a>
      </div>
    );
  }

  const { members, isLoading: membersLoading, inviteMember, updateMemberRole, updateMemberPosition, removeMember } =
    useMembers({ projectId: currentProjectId });
  const { positions, isLoading: positionsLoading } = usePositions({ projectId: currentProjectId });

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
