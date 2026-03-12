// ============================================================================
// POST /api/admin/telegram/restart
// ============================================================================
// Restarts the Telegram bot for the current project (admin only).
// Called after settings changes (e.g., token update).
// ============================================================================

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { startProjectBot, isBotRunning } from '@/lib/telegram/bot';

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = session.user.currentProjectId;
    if (!projectId) {
      return NextResponse.json({ error: 'No project selected' }, { status: 400 });
    }

    const isAdmin =
      session.user.role === 'superadmin' ||
      session.user.currentProjectRole === 'admin' ||
      session.user.currentProjectRole === 'owner';

    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await startProjectBot(projectId);

    return NextResponse.json({ running: isBotRunning(projectId) });
  } catch (error) {
    console.error('Error restarting Telegram bot:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
