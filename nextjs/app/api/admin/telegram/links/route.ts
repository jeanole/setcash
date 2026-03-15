// ============================================================================
// GET /api/admin/telegram/links
// ============================================================================
// Returns all Telegram links for the current project (admin only).
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
      return NextResponse.json({ error: 'No project selected' }, { status: 400 });
    }

    const isAdmin =
      session.user.role === 'superadmin' ||
      session.user.currentProjectRole === 'admin' ||
      session.user.currentProjectRole === 'owner';

    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const members = await prisma.projectMember.findMany({
      where: { projectId },
      select: { userEmail: true },
    });

    const links = await prisma.telegramLink.findMany({
      where: { projectId },
      orderBy: { linkedAt: 'desc' },
      select: {
        id: true,
        telegramUserId: true,
        userEmail: true,
        linkedAt: true,
      },
    });

    const linkedEmails = new Set(links.map((l) => l.userEmail));
    const unlinked = members.map((m) => m.userEmail).filter((e) => !linkedEmails.has(e));

    return NextResponse.json({ linked: links, unlinked });
  } catch (error) {
    console.error('Error fetching Telegram links:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
