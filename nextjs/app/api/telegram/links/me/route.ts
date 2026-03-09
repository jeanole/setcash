// ============================================================================
// DELETE /api/telegram/links/me
// ============================================================================
// Unlinks the current user's Telegram account from their current project.
// ============================================================================

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = session.user.currentProjectId;
    if (!projectId) {
      return NextResponse.json({ error: 'No project selected' }, { status: 400 });
    }

    const userEmail = session.user.email;
    if (!userEmail) {
      return NextResponse.json({ error: 'No email associated with account' }, { status: 400 });
    }

    await prisma.telegramLink.deleteMany({
      where: { projectId, userEmail },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error unlinking Telegram account:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
