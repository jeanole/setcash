import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import { prisma } from '@/lib/db';

// POST /api/projects/[id]/resign - Resign from project
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Check membership
    const membership = await prisma.projectMember.findUnique({
      where: {
        projectId_userEmail: {
          projectId: id,
          userEmail: session.user.email,
        },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this project' }, { status: 403 });
    }

    // Owners cannot resign
    if (membership.role === 'owner') {
      return NextResponse.json(
        { error: 'Owners cannot resign. Transfer ownership first.' },
        { status: 400 }
      );
    }

    // Delete membership
    await prisma.projectMember.delete({
      where: {
        projectId_userEmail: {
          projectId: id,
          userEmail: session.user.email,
        },
      },
    });

    // Clear default project if it was this one
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (user?.defaultProjectId === id) {
      await prisma.user.update({
        where: { email: session.user.email },
        data: { defaultProjectId: null },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error resigning from project:', error);
    return NextResponse.json({ error: 'Failed to resign from project' }, { status: 500 });
  }
}
