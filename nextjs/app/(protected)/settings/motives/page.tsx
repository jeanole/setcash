import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import MotivesPageClient from '@/components/settings/MotivesPageClient';

export default async function MotivesSettingsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const projectRole = session.user.currentProjectRole;
  const isAdmin = projectRole === 'admin' || projectRole === 'owner';
  const isSuperAdmin = session.user.role === 'superadmin';

  if (!isAdmin && !isSuperAdmin) {
    redirect('/settings');
  }

  const currentProjectId = session.user.currentProjectId;

  if (!currentProjectId) {
    redirect('/settings/projects');
  }

  return <MotivesPageClient projectId={currentProjectId} />;
}
