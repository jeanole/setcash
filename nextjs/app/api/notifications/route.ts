import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userEmail: session.user.email },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { project: { select: { name: true } } },
    }),
    // Count across all notifications, not just the 50 returned above
    prisma.notification.count({
      where: { userEmail: session.user.email, isRead: false },
    }),
  ]);

  return NextResponse.json({
    notifications: notifications.map((n) => ({
      id: n.id,
      type: n.type,
      message: n.message,
      projectId: n.projectId,
      projectName: n.project?.name ?? null,
      isRead: n.isRead,
      createdAt: n.createdAt.toISOString(),
    })),
    unreadCount,
  });
}
