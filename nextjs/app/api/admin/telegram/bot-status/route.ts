// ============================================================================
// GET /api/admin/telegram/bot-status
// ============================================================================
// Returns whether the Telegram bot is currently running for this project.
// ============================================================================

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isBotRunning } from '@/lib/telegram/bot';

export async function GET() {
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

    const running = isBotRunning(projectId);

    return NextResponse.json({ running });
  } catch (error) {
    console.error('Error fetching bot status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
