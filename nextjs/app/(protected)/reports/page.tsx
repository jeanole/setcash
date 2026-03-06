import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import ReportsPageClient from '@/components/reports/ReportsPageClient';

export default async function ReportsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const projectId = session.user.currentProjectId;

  if (!projectId) {
    redirect('/settings/projects');
  }

  const projectRole = session.user.currentProjectRole;
  const isAdmin =
    session.user.role === 'superadmin' ||
    projectRole === 'admin' ||
    projectRole === 'owner';

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <ReportsPageClient
        isAdmin={isAdmin}
        currentUserEmail={session.user.email}
        projectId={projectId}
        projectName={session.user.currentProjectName ?? ''}
      />
    </div>
  );
}
