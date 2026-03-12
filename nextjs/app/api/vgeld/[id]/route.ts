// ============================================================================
// V-Geld API - DELETE /api/vgeld/[id]
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db as prisma } from '@/lib/db';

// DELETE /api/vgeld/[id] - Delete a V-Geld transfer
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = session.user.currentProjectId;
    if (!projectId) {
      return NextResponse.json({ error: 'No project selected' }, { status: 400 });
    }

    // Verify project membership and admin role
    const membership = await prisma.projectMember.findUnique({
      where: {
        projectId_userEmail: {
          projectId,
          userEmail: session.user.email,
        },
      },
    });

    const isSuperAdmin = session.user.role === 'superadmin';
    const isAdmin = membership?.role === 'admin' || membership?.role === 'owner';

    if (!isSuperAdmin && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 });
    }

    const { id } = params;

    // Verify the transfer exists and belongs to this project
    const transfer = await prisma.vgeld.findUnique({
      where: { id },
    });

    if (!transfer || transfer.projectId !== projectId) {
      return NextResponse.json({ error: 'Transfer not found' }, { status: 404 });
    }

    await prisma.vgeld.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error deleting V-Geld transfer:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
