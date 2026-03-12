import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import OcrSettingsForm from '@/components/settings/OcrSettingsForm';
import type { ProjectOcrSettings } from '@/lib/api/settings';
import { maskApiKey } from '@/lib/ocr';

export default async function AiAnalysisSettingsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const userRole = session.user.role as string;
  const isAdmin =
    userRole === 'admin' || userRole === 'owner' || userRole === 'superadmin';

  if (!isAdmin) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-amber-800">Admin Access Required</h3>
        <p className="mt-2 text-sm text-amber-700">
          Only project admins can manage AI Analysis settings.
        </p>
      </div>
    );
  }

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

  let settings: ProjectOcrSettings;
  try {
    const rows = await prisma.projectSettings.findMany({
      where: { projectId: currentProjectId },
    });

    const get = (key: string) => rows.find((r) => r.key === key)?.value ?? null;

    settings = {
      ocrEnabled: get('ocrEnabled') === 'true',
      ocrProvider: get('ocrProvider') ?? 'openai',
      ocrApiKey: maskApiKey(get('ocrApiKey') || '') || null,
      ocrBaseUrl: get('ocrBaseUrl') ?? null,
    };
  } catch {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-rose-800">Error Loading Settings</h3>
        <p className="mt-2 text-sm text-rose-700">
          Could not load AI Analysis settings. Please try again.
        </p>
      </div>
    );
  }

  return <OcrSettingsForm initialSettings={settings} />;
}
