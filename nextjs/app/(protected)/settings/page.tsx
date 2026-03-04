import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import ProjectIdentityForm from '@/components/settings/ProjectIdentityForm';

export default async function GeneralSettingsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  // Get current project from session
  const currentProjectId = session.user.currentProjectId;
  
  if (!currentProjectId) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-amber-800">No Project Selected</h3>
        <p className="mt-2 text-sm text-amber-700">
          Please select a project from the Projects tab to manage its settings.
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

  // Fetch current project details
  const response = await fetch(`${process.env.NEXTAUTH_URL}/api/projects/${currentProjectId}`, {
    headers: {
      'Cookie': `next-auth.session-token=${session.sessionToken}`,
    },
  });

  if (!response.ok) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-rose-800">Error Loading Project</h3>
        <p className="mt-2 text-sm text-rose-700">
          Could not load project details. Please try again.
        </p>
      </div>
    );
  }

  const project = await response.json();

  return (
    <ProjectIdentityForm
      projectId={currentProjectId}
      initialName={project.name || ''}
      initialSubtitle={project.subtitle || ''}
    />
  );
}
