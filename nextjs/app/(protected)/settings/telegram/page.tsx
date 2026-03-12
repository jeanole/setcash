import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import TelegramSettings from '@/components/settings/TelegramSettings';

export default async function TelegramSettingsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  const projectId = session.user.currentProjectId;
  if (!projectId) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-amber-800">No Project Selected</h3>
        <p className="mt-2 text-sm text-amber-700">
          Please select a project from the Projects tab to manage its Telegram settings.
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

  const userRole = session.user.role as string;
  const isAdmin =
    userRole === 'admin' ||
    userRole === 'owner' ||
    userRole === 'superadmin' ||
    session.user.currentProjectRole === 'admin' ||
    session.user.currentProjectRole === 'owner';

  // Load initial data
  const [settingsRows, telegramLink] = await Promise.all([
    prisma.projectSettings.findMany({
      where: { projectId, key: { in: ['telegramEnabled', 'telegramBotToken'] } },
    }),
    prisma.telegramLink.findFirst({
      where: { projectId, userEmail: session.user.email ?? '' },
      select: { linkedAt: true },
    }),
  ]);

  const map = Object.fromEntries(settingsRows.map((r) => [r.key, r.value]));

  const telegramEnabled =
    map.telegramEnabled === 'true' ||
    map.telegramEnabled === '"true"' ||
    map.telegramEnabled === '1';

  // Decrypt then mask — must use the Telegram encryption module, not OCR's
  const { decrypt } = await import('@/lib/telegram/encryption');
  const maskedToken = map.telegramBotToken
    ? (() => { const plain = decrypt(map.telegramBotToken); return plain ? `...${plain.slice(-4)}` : null; })()
    : null;

  return (
    <TelegramSettings
      isAdmin={isAdmin}
      initialEnabled={telegramEnabled}
      initialMaskedToken={maskedToken}
      initialLinked={!!telegramLink}
      initialLinkedAt={telegramLink?.linkedAt?.toISOString() ?? null}
    />
  );
}
