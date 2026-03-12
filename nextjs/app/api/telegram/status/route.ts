// ============================================================================
// GET /api/telegram/status
// ============================================================================
// Returns the Telegram link status for the current user in their current project.
// ============================================================================

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = session.user.currentProjectId;
    if (!projectId) {
      return NextResponse.json({ enabled: false, linked: false, linkedAt: null });
    }

    const userEmail = session.user.email;
    if (!userEmail) {
      return NextResponse.json({ enabled: false, linked: false, linkedAt: null });
    }

    // Check if Telegram is enabled
    const telegramEnabledSetting = await prisma.projectSettings.findUnique({
      where: { projectId_key: { projectId, key: 'telegramEnabled' } },
    });
    const telegramEnabled =
      telegramEnabledSetting?.value === 'true' ||
      telegramEnabledSetting?.value === '"true"' ||
      telegramEnabledSetting?.value === '1';

    // Check if user has a Telegram link
    const link = await prisma.telegramLink.findFirst({
      where: { projectId, userEmail },
      select: { telegramUserId: true, linkedAt: true },
    });

    return NextResponse.json({
      enabled: telegramEnabled,
      linked: !!link,
      linkedAt: link?.linkedAt ?? null,
      telegramUserId: link?.telegramUserId ?? undefined,
    });
  } catch (error) {
    console.error('Error fetching Telegram status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
