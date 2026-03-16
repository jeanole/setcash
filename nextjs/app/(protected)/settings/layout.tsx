import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import SettingsTabs from '@/components/settings/SettingsTabs';
import DemoReadOnlyOverlay from '@/components/settings/DemoReadOnlyOverlay';

export default async function SettingsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  const userRole = (session?.user?.role as 'user' | 'admin' | 'owner' | 'superadmin') || 'user';
  const isDemoAccount = session?.user?.isDemoAccount ?? false;

  if (!session?.user) {
    redirect('/');
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-600">
          Manage your project settings, members, and preferences
        </p>
      </div>

      <SettingsTabs userRole={userRole} />

      <div className="space-y-6">
        <DemoReadOnlyOverlay isDemoAccount={isDemoAccount}>
          {children}
        </DemoReadOnlyOverlay>
      </div>
    </div>
  );
}
