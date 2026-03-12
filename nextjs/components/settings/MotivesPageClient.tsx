'use client';

import SettingsSection from '@/components/settings/SettingsSection';
import MotivesList from '@/components/settings/MotivesList';
import { useMotives } from '@/lib/hooks/useMotives';

interface MotivesPageClientProps {
  projectId: string;
}

export default function MotivesPageClient({ projectId }: MotivesPageClientProps) {
  const { motives, isLoading, createMotive, updateMotive, deleteMotive } = useMotives({ projectId });

  return (
    <SettingsSection
      title="Motives"
      description={`Manage budget motives for organizing expenses. ${motives.length} motive(s) defined.`}
    >
      <MotivesList
        motives={motives}
        isLoading={isLoading}
        onCreate={createMotive}
        onUpdate={updateMotive}
        onDelete={deleteMotive}
      />
    </SettingsSection>
  );
}
