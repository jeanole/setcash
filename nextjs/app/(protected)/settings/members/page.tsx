import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import MembersPageClient from '@/components/settings/MembersPageClient';

export default async function MembersSettingsPage() {
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

  const currentUserRole = (projectRole ?? session.user.role) as 'user' | 'admin' | 'owner' | 'superadmin';

  return <MembersPageClient projectId={currentProjectId} currentUserRole={currentUserRole} />;
}
