'use client';

import { useSession } from 'next-auth/react';
import SettingsSection from '@/components/settings/SettingsSection';
import PositionsList from '@/components/settings/PositionsList';
import { usePositions } from '@/lib/hooks/usePositions';

export default function PositionsSettingsPage() {
  const { data: session } = useSession();
  const currentProjectId = session?.user?.currentProjectId as string | undefined;

  if (!currentProjectId) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-amber-800">No Project Selected</h3>
        <p className="mt-2 text-sm text-amber-700">
          Please select a project to manage its positions.
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

  const { positions, isLoading, createPosition, updatePosition, deletePosition } = usePositions({
    projectId: currentProjectId,
  });

  return (
    <SettingsSection
      title="Positions"
      description={`Manage project-specific positions for organizing team members. ${positions.length} position(s) defined.`}
    >
      <PositionsList
        positions={positions}
        isLoading={isLoading}
        onCreate={createPosition}
        onUpdate={updatePosition}
        onDelete={deletePosition}
      />
    </SettingsSection>
  );
}
