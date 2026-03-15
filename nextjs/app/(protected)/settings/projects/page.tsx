'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import SettingsSection from '@/components/settings/SettingsSection';
import ProjectsList from '@/components/settings/ProjectsList';
import NewProjectModal from '@/components/settings/NewProjectModal';
import { useProjects } from '@/lib/hooks/useProjects';

export default function ProjectsSettingsPage() {
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const { projects, isLoading, createProject, switchProject, resignFromProject, deleteProject } = useProjects();

  return (
    <>
      <SettingsSection
        title="Your Projects"
        description="Manage your project memberships and switch between projects."
      >
        <div className="mb-6 flex justify-end">
          <button
            onClick={() => setIsNewProjectModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#6366f1] text-white rounded-md font-medium hover:bg-[#4f46e5] transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </div>

        <ProjectsList
          projects={projects}
          isLoading={isLoading}
          onSwitch={switchProject}
          onResign={resignFromProject}
          onDelete={deleteProject}
        />
      </SettingsSection>

      <NewProjectModal
        isOpen={isNewProjectModalOpen}
        onClose={() => setIsNewProjectModalOpen(false)}
        onCreate={createProject}
      />
    </>
  );
}
