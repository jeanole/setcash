'use client';

import SettingsSection from '@/components/settings/SettingsSection';
import PositionsList from '@/components/settings/PositionsList';
import { usePositions } from '@/lib/hooks/usePositions';

interface PositionsPageClientProps {
  projectId: string;
}

export default function PositionsPageClient({ projectId }: PositionsPageClientProps) {
  const { positions, isLoading, createPosition, updatePosition, deletePosition } = usePositions({ projectId });

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
