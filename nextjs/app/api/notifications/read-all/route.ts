import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

export async function POST() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await prisma.notification.updateMany({
    where: { userEmail: session.user.email, isRead: false },
    data: { isRead: true },
  });

  return NextResponse.json({ ok: true, count: result.count });
}
